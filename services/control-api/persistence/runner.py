"""Schema migration runner.

The runner is intentionally tiny — there is no DSL, no Python migration steps,
no down-migrations (decision §G.5: forward-only). It simply scans
``persistence/migrations/*.sql`` files, parses ``NNN_name.sql`` filenames into
``(version, name)`` pairs, compares against ``schema_migrations``, and applies
the missing ones in ascending order.

Per the persistence design §C.1:

* If the database is empty (no ``schema_migrations`` row), apply every
  available migration in order.
* If ``MAX(applied) < MAX(in dir)``, apply the missing tail.
* If ``MAX(applied) > MAX(in dir)``, refuse to start — the user has rolled the
  code back to a version older than the live database.

Any failure inside a single migration rolls that migration back. No partial
writes — each migration runs inside its own ``BEGIN ... COMMIT``.
"""

from __future__ import annotations

import hashlib
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Sequence


_MIGRATION_FILENAME_RE = re.compile(r"^(\d+)_([A-Za-z0-9][A-Za-z0-9_\-]*)\.sql$")


class MigrationError(RuntimeError):
    """Raised when migrations cannot be applied (e.g. version skew)."""


@dataclass(frozen=True)
class Migration:
    """A single ``NNN_name.sql`` migration on disk."""

    version: int
    name: str
    path: Path

    @property
    def filename(self) -> str:
        return self.path.name

    def read_sql(self) -> str:
        return self.path.read_text(encoding="utf-8")

    def checksum(self) -> str:
        return hashlib.sha256(self.read_sql().encode("utf-8")).hexdigest()


def discover_migrations(directory: Path) -> List[Migration]:
    """Return migrations in ``directory`` sorted ascending by version.

    Filenames must match ``NNN_name.sql`` where ``NNN`` is one or more digits.
    Files that do not match are silently ignored — they may be helper SQL
    fragments or the package's own ``__init__.py``.
    """

    if not directory.is_dir():
        raise MigrationError(f"migrations directory not found: {directory}")

    migrations: List[Migration] = []
    seen_versions: set[int] = set()
    for entry in sorted(directory.iterdir()):
        if not entry.is_file():
            continue
        match = _MIGRATION_FILENAME_RE.match(entry.name)
        if not match:
            continue
        version = int(match.group(1))
        if version in seen_versions:
            raise MigrationError(
                f"duplicate migration version {version} in {directory}"
            )
        seen_versions.add(version)
        migrations.append(
            Migration(version=version, name=match.group(2), path=entry)
        )

    migrations.sort(key=lambda m: m.version)
    return migrations


class MigrationRunner:
    """Applies pending migrations against a single SQLite connection."""

    DEFAULT_DIRECTORY = Path(__file__).resolve().parent / "migrations"

    def __init__(
        self,
        connection: sqlite3.Connection,
        *,
        directory: Optional[Path] = None,
        migrations: Optional[Sequence[Migration]] = None,
    ) -> None:
        self.connection = connection
        self.directory = directory or self.DEFAULT_DIRECTORY
        if migrations is not None:
            # Caller supplied an explicit list (used by tests or callers that
            # want to apply migrations from outside the on-disk directory).
            self._migrations: List[Migration] = sorted(
                migrations, key=lambda m: m.version
            )
        else:
            self._migrations = discover_migrations(self.directory)

    # ------------------------------------------------------------------ helpers
    @property
    def available_versions(self) -> List[int]:
        return [m.version for m in self._migrations]

    def applied_versions(self) -> List[int]:
        """Return the set of migration versions already in the database.

        If ``schema_migrations`` does not exist yet (i.e. this is a fresh
        database), return an empty list rather than raising.
        """

        cursor = self.connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
        )
        if cursor.fetchone() is None:
            cursor.close()
            return []
        cursor.close()
        cursor = self.connection.execute(
            "SELECT version FROM schema_migrations ORDER BY version"
        )
        rows = [int(row[0]) for row in cursor.fetchall()]
        cursor.close()
        return rows

    def pending_migrations(self) -> List[Migration]:
        """Return migrations that have not yet been applied.

        Raises :class:`MigrationError` if the database has migrations newer
        than what this checkout knows about (per design §C.1).
        """

        applied = set(self.applied_versions())
        max_applied = max(applied) if applied else 0
        max_available = max(self.available_versions) if self._migrations else 0

        if max_applied > max_available:
            raise MigrationError(
                "database has migrations newer than code knows about: "
                f"max(applied)={max_applied}, max(available)={max_available}. "
                "upgrade the code or restore from a backup."
            )

        return [m for m in self._migrations if m.version not in applied]

    # ------------------------------------------------------------------ apply
    def apply_pending(self) -> List[Migration]:
        """Apply all pending migrations and return the list that ran."""

        pending = self.pending_migrations()
        applied_now: List[Migration] = []
        for migration in pending:
            self._apply_one(migration)
            applied_now.append(migration)
        return applied_now

    def _apply_one(self, migration: Migration) -> None:
        sql = migration.read_sql()
        # We deliberately DO NOT run user SQL inside an explicit transaction —
        # SQLite's executescript() implicitly commits any pending tx and runs
        # statements one at a time. We need the migration *and* the
        # schema_migrations bookkeeping row to be all-or-nothing, so we manage
        # the BEGIN/COMMIT manually using execute() pieces.
        try:
            self.connection.execute("BEGIN")
            self.connection.executescript(sql)
            self.connection.execute(
                "INSERT INTO schema_migrations (version, name, checksum) "
                "VALUES (?, ?, ?)",
                (migration.version, migration.name, migration.checksum()),
            )
            self.connection.commit()
        except Exception as exc:
            self.connection.rollback()
            raise MigrationError(
                f"migration {migration.filename} failed: {exc}"
            ) from exc


def run_migrations(
    connection: sqlite3.Connection,
    *,
    directory: Optional[Path] = None,
) -> List[Migration]:
    """Convenience wrapper: discover + apply pending migrations."""

    return MigrationRunner(connection, directory=directory).apply_pending()


__all__ = [
    "MigrationError",
    "Migration",
    "MigrationRunner",
    "discover_migrations",
    "run_migrations",
]
