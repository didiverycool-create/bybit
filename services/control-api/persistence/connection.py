"""SQLite connection management.

Per ``docs/P0-5.1-persistence-design.md`` §D.1, all production connections must
enable WAL journaling, foreign keys, and a 5s busy timeout. This module exposes
a single :func:`connect` helper that builds a connection at the requested path
(or ``:memory:`` for tests) and applies the required pragmas.

The helper is intentionally minimal — it does not pool connections. The
persistence design assumes one connection per thread (the FastAPI request
thread, the strategy runtime thread, and the agent worker thread each hold
their own); wave-3 wiring will hand those connections out via
``threading.local`` if needed.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Optional, Union


class PersistenceConnectionError(RuntimeError):
    """Raised when a SQLite connection cannot be configured as required."""


def apply_pragmas(conn: sqlite3.Connection) -> None:
    """Apply the production PRAGMAs from §D.1 of the persistence design.

    The settings are idempotent — calling this multiple times on the same
    connection is safe. ``journal_mode`` is *not* applied for in-memory
    databases because SQLite ignores WAL there; instead we leave the default
    ``memory`` journal which still provides ACID semantics within a process.
    """

    try:
        # foreign_keys + busy_timeout always make sense, even for :memory:.
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
        conn.execute("PRAGMA synchronous = NORMAL")
        # WAL is only meaningful for file-backed databases. Trying it on
        # :memory: just falls back to "memory" silently — but for clarity we
        # only request WAL when we have a non-empty filename.
        cursor = conn.execute("PRAGMA database_list")
        rows = cursor.fetchall()
        cursor.close()
        is_file_backed = any(
            row[2] not in ("", ":memory:") for row in rows  # row[2] is filename
        )
        if is_file_backed:
            conn.execute("PRAGMA journal_mode = WAL")
    except sqlite3.Error as exc:  # pragma: no cover - defensive
        raise PersistenceConnectionError(
            f"failed to apply SQLite pragmas: {exc}"
        ) from exc


def connect(
    path: Union[str, Path, None] = None,
    *,
    detect_types: int = 0,
    isolation_level: Optional[str] = None,
    check_same_thread: bool = False,
) -> sqlite3.Connection:
    """Open a SQLite connection with control-api's required pragmas applied.

    Parameters
    ----------
    path:
        Either ``":memory:"`` (default), a string path, or a :class:`Path`. The
        parent directory is created if it does not yet exist when a real
        filesystem path is supplied.
    detect_types:
        Forwarded to :func:`sqlite3.connect`.
    isolation_level:
        Forwarded to :func:`sqlite3.connect`. Defaults to ``None`` which means
        "autocommit off; sqlite3 starts implicit transactions" — the standard
        DBAPI behaviour. The :class:`unit_of_work.PersistenceUnit` helper
        relies on this default to manage transactions explicitly.
    check_same_thread:
        Defaults to ``False`` because connections may legitimately move
        between threads (FastAPI background tasks, lifespan startup, etc.).
        Caller is responsible for serializing concurrent writes per
        ``docs/P0-5.1-persistence-design.md`` §D.3.
    """

    if path is None or path == ":memory:":
        target: str = ":memory:"
    else:
        path_obj = Path(path)
        if path_obj.parent and not path_obj.parent.exists():
            path_obj.parent.mkdir(parents=True, exist_ok=True)
        target = str(path_obj)

    conn = sqlite3.connect(
        target,
        detect_types=detect_types,
        isolation_level=isolation_level,
        check_same_thread=check_same_thread,
    )
    conn.row_factory = sqlite3.Row
    apply_pragmas(conn)
    return conn


__all__ = ["PersistenceConnectionError", "apply_pragmas", "connect"]
