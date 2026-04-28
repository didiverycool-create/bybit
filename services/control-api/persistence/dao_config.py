"""DAO for ``config_snapshots``.

Per ``docs/P0-5.1-persistence-design.md`` §B.7 + decision §G.3, configuration
state (settings, workspace preferences, feature flags) is stored as
event-sourced rows: each save inserts a new row, the most recent row wins.
"current value" reads use ``ORDER BY created_at DESC LIMIT 1`` (or
``MAX(created_at)``) keyed by ``snapshot_kind``.

Round 131 — wave-3-A's §F.1 Shadow Mode adds the ``feature_flags`` helpers
:meth:`ConfigDao.get_feature_flags` / :meth:`ConfigDao.set_feature_flag` so
the engine can read the ``execution_engine.shadow`` flag without exposing
SQL details to call-sites.  The helpers wrap the existing ``get_current``
/ ``insert`` paths so they participate in the same audit trail and do not
introduce any new SQL.  Callers that need a default value when no flag
snapshot exists can pass ``default=`` to :meth:`get_feature_flags`.
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, List, Optional, TypedDict


class ConfigSnapshotRow(TypedDict, total=False):
    id: int  # auto-assigned on insert
    snapshot_kind: str  # 'settings' | 'workspace_preferences' | 'feature_flags'
    payload_json: str
    edited_by: str
    edit_reason: Optional[str]
    created_at: str


_INSERT_SQL = """
INSERT INTO config_snapshots (
    snapshot_kind, payload_json, edited_by, edit_reason, created_at
) VALUES (
    :snapshot_kind, :payload_json, :edited_by, :edit_reason, :created_at
)
"""

_BASE_SELECT = (
    "SELECT id, snapshot_kind, payload_json, edited_by, edit_reason, "
    "created_at FROM config_snapshots"
)


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {key: row[key] for key in row.keys()}


class ConfigDao:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self._conn = connection

    # ------------------------------------------------------------- write paths
    def insert(self, row: ConfigSnapshotRow) -> int:
        params: Dict[str, Any] = {
            "snapshot_kind": row["snapshot_kind"],
            "payload_json": row["payload_json"],
            "edited_by": row["edited_by"],
            "edit_reason": row.get("edit_reason"),
            "created_at": row["created_at"],
        }
        cursor = self._conn.execute(_INSERT_SQL, params)
        last_id = int(cursor.lastrowid) if cursor.lastrowid is not None else 0
        cursor.close()
        return last_id

    # -------------------------------------------------------------- read paths
    def get(self, snapshot_id: int) -> Optional[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE id = ?", (int(snapshot_id),)
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    def get_current(self, snapshot_kind: str) -> Optional[Dict[str, Any]]:
        """Return the most recent snapshot for ``snapshot_kind``.

        Implements the design's "MAX(created_at) read" pattern using
        ``ORDER BY created_at DESC LIMIT 1`` (so we get the full row, not just
        the timestamp).
        """

        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE snapshot_kind = ? "
            "ORDER BY created_at DESC LIMIT 1",
            (snapshot_kind,),
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    def get_max_created_at(self, snapshot_kind: str) -> Optional[str]:
        """Return ``MAX(created_at)`` for ``snapshot_kind``, or None if absent."""

        cursor = self._conn.execute(
            "SELECT MAX(created_at) FROM config_snapshots WHERE snapshot_kind = ?",
            (snapshot_kind,),
        )
        row = cursor.fetchone()
        cursor.close()
        if row is None or row[0] is None:
            return None
        return str(row[0])

    def list(
        self,
        *,
        snapshot_kind: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        conditions: List[str] = []
        params: List[Any] = []
        if snapshot_kind is not None:
            conditions.append("snapshot_kind = ?")
            params.append(snapshot_kind)
        where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        sql = f"{_BASE_SELECT}{where_clause} ORDER BY created_at DESC"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        cursor = self._conn.execute(sql, tuple(params))
        rows = [_row_to_dict(r) for r in cursor.fetchall()]
        cursor.close()
        return rows

    # ------------------------------------------------------ feature-flag helpers
    def get_feature_flags(
        self, *, default: Optional[Dict[str, bool]] = None
    ) -> Dict[str, bool]:
        """Return the most recent ``feature_flags`` snapshot as a typed
        ``Dict[str, bool]``.

        Wraps :meth:`get_current` and JSON-decodes the payload.  When no
        flags snapshot has been written yet, returns ``default or {}`` so
        the engine's "default-on / default-off" decision lives at the call
        site (P0-design-decisions §G.3 enforces "no row → safe default").
        """

        row = self.get_current("feature_flags")
        if row is None:
            return dict(default or {})
        try:
            payload = json.loads(row["payload_json"])
        except (TypeError, ValueError):
            return dict(default or {})
        if not isinstance(payload, dict):
            return dict(default or {})
        # Coerce values to bool to defend against legacy rows that stored
        # truthy ints / strings; flags are intentionally limited to bool to
        # keep the desktop "Settings" UI typed.
        return {str(key): bool(value) for key, value in payload.items()}

    def set_feature_flag(
        self,
        flag: str,
        value: bool,
        *,
        edited_by: str,
        created_at: str,
        edit_reason: Optional[str] = None,
    ) -> int:
        """Update a single feature flag by inserting a new row that merges
        ``flag=value`` onto the latest snapshot.  Returns the new row id.

        The merge-then-insert pattern preserves the event-sourced semantics
        (every change creates an audit row) while letting callers update one
        flag at a time without having to re-read the full set.
        """

        current = self.get_feature_flags()
        current[str(flag)] = bool(value)
        return self.insert(
            ConfigSnapshotRow(
                snapshot_kind="feature_flags",
                payload_json=json.dumps(current, separators=(",", ":")),
                edited_by=edited_by,
                edit_reason=edit_reason,
                created_at=created_at,
            )
        )


__all__ = ["ConfigDao", "ConfigSnapshotRow"]
