"""DAO for ``config_snapshots``.

Per ``docs/P0-5.1-persistence-design.md`` §B.7 + decision §G.3, configuration
state (settings, workspace preferences, feature flags) is stored as
event-sourced rows: each save inserts a new row, the most recent row wins.
"current value" reads use ``ORDER BY created_at DESC LIMIT 1`` (or
``MAX(created_at)``) keyed by ``snapshot_kind``.
"""

from __future__ import annotations

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


__all__ = ["ConfigDao", "ConfigSnapshotRow"]
