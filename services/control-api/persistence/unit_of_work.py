"""Transactional unit-of-work helper.

``PersistenceUnit`` is a lightweight context manager that wraps a connection in
``BEGIN ... COMMIT`` and rolls back on any exception. It exists for the
"multi-DAO transaction" cases listed in
``docs/P0-5.1-persistence-design.md`` §D.2:

* Submitting a ChangeRequest:
  ``change_requests.upsert + change_request_history.insert + audit_events.insert``
* Editing strategy parameters:
  ``parameter_versions.insert + change_requests.upsert + audit_events.insert``
* ExecutionEngine state transition:
  ``execution_events.insert + audit_events.insert (if user-visible)``
* Backtest completion:
  ``backtest_runs.update + agent_jobs.upsert + audit_events.insert``
* Agent job state transition:
  ``agent_jobs.update + audit_events.insert``

The DAOs themselves do not call BEGIN/COMMIT; they just queue writes on the
connection. Use ``PersistenceUnit`` whenever the writes must be atomic.

Example::

    with PersistenceUnit(conn) as unit:
        change_request_dao.upsert(row)
        change_request_dao.insert_history(row)
        audit_dao.insert(audit_event)
        # implicit commit on context exit
"""

from __future__ import annotations

import sqlite3
from typing import Optional


class PersistenceUnit:
    """Context manager for atomic SQLite transactions."""

    def __init__(
        self,
        connection: sqlite3.Connection,
        *,
        immediate: bool = False,
    ) -> None:
        self._connection = connection
        # ``BEGIN IMMEDIATE`` acquires the write lock up front, useful for
        # "guaranteed write" paths where we don't want to discover the lock
        # is taken halfway through. ``BEGIN`` (deferred) is the default.
        self._mode = "BEGIN IMMEDIATE" if immediate else "BEGIN"
        self._active = False

    @property
    def connection(self) -> sqlite3.Connection:
        return self._connection

    def __enter__(self) -> "PersistenceUnit":
        if self._active:
            raise RuntimeError("PersistenceUnit is not re-entrant")
        # If the underlying connection happens to be inside an implicit
        # transaction (sqlite3's autocommit-off default), commit it first to
        # establish a clean baseline. This is safe because at this point no
        # DAO calls have run inside us yet.
        if self._connection.in_transaction:
            self._connection.commit()
        self._connection.execute(self._mode)
        self._active = True
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> Optional[bool]:
        if not self._active:
            return False
        try:
            if exc_type is None:
                self._connection.commit()
            else:
                self._connection.rollback()
        finally:
            self._active = False
        return False  # do not suppress exceptions

    # Convenience helpers — rarely needed because __exit__ handles the common
    # case, but useful when a caller wants to abort early without raising.
    def commit(self) -> None:
        if self._active:
            self._connection.commit()
            self._active = False

    def rollback(self) -> None:
        if self._active:
            self._connection.rollback()
            self._active = False


__all__ = ["PersistenceUnit"]
