"""DAO for ``parameter_versions``.

Per ``docs/P0-5.1-persistence-design.md`` §B.6 each row freezes the strategy
parameter set at the moment of an edit. The ``UNIQUE (strategy_id,
version_no)`` invariant means callers must look up the current max
``version_no`` for a strategy and pass ``next = max + 1`` when inserting.
"""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional, TypedDict


class ParameterVersionRow(TypedDict, total=False):
    id: int  # auto-assigned on insert
    strategy_id: str
    version_no: int
    parameters_json: str
    risk_budget: Optional[float]
    edited_by: str
    change_request_id: Optional[str]
    created_at: str


_INSERT_SQL = """
INSERT INTO parameter_versions (
    strategy_id, version_no, parameters_json, risk_budget,
    edited_by, change_request_id, created_at
) VALUES (
    :strategy_id, :version_no, :parameters_json, :risk_budget,
    :edited_by, :change_request_id, :created_at
)
"""

_BASE_SELECT = (
    "SELECT id, strategy_id, version_no, parameters_json, risk_budget, "
    "edited_by, change_request_id, created_at FROM parameter_versions"
)


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {key: row[key] for key in row.keys()}


class ParameterVersionDao:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self._conn = connection

    # ------------------------------------------------------------- write paths
    def insert(self, row: ParameterVersionRow) -> int:
        """Insert a new version row. Returns the auto-assigned ``id``."""

        params: Dict[str, Any] = {
            "strategy_id": row["strategy_id"],
            "version_no": int(row["version_no"]),
            "parameters_json": row["parameters_json"],
            "risk_budget": row.get("risk_budget"),
            "edited_by": row["edited_by"],
            "change_request_id": row.get("change_request_id"),
            "created_at": row["created_at"],
        }
        cursor = self._conn.execute(_INSERT_SQL, params)
        last_id = int(cursor.lastrowid) if cursor.lastrowid is not None else 0
        cursor.close()
        return last_id

    # -------------------------------------------------------------- read paths
    def get(self, version_id: int) -> Optional[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE id = ?", (int(version_id),)
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    def get_latest(self, strategy_id: str) -> Optional[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE strategy_id = ? "
            "ORDER BY version_no DESC LIMIT 1",
            (strategy_id,),
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    def get_max_version(self, strategy_id: str) -> int:
        """Return the largest ``version_no`` for ``strategy_id``, or 0."""

        cursor = self._conn.execute(
            "SELECT MAX(version_no) FROM parameter_versions WHERE strategy_id = ?",
            (strategy_id,),
        )
        row = cursor.fetchone()
        cursor.close()
        if row is None or row[0] is None:
            return 0
        return int(row[0])

    def list(
        self,
        *,
        strategy_id: Optional[str] = None,
        change_request_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        conditions: List[str] = []
        params: List[Any] = []
        if strategy_id is not None:
            conditions.append("strategy_id = ?")
            params.append(strategy_id)
        if change_request_id is not None:
            conditions.append("change_request_id = ?")
            params.append(change_request_id)
        where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        sql = (
            f"{_BASE_SELECT}{where_clause} "
            "ORDER BY strategy_id ASC, version_no DESC"
        )
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        cursor = self._conn.execute(sql, tuple(params))
        rows = [_row_to_dict(r) for r in cursor.fetchall()]
        cursor.close()
        return rows


__all__ = ["ParameterVersionDao", "ParameterVersionRow"]
