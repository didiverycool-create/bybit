"""DAO for ``change_requests`` and ``change_request_history``.

Per ``docs/P0-5.1-persistence-design.md`` §B.2 the design splits the
ChangeRequest mutation surface into two tables: ``change_requests`` is the
"current state" table (one row per ChangeRequest, mutable) and
``change_request_history`` is an append-only trail of state transitions.

The DAO exposes:

* :meth:`upsert` — insert or replace the current-state row.
* :meth:`update_status` — promote a row to a new status, leaving every other
  field untouched (the most common operation in the wave-3 integration).
* :meth:`insert_history` — append a transition row.
* :meth:`get`, :meth:`list`, :meth:`list_history` — read paths.

It deliberately does **not** wrap multiple statements in a transaction; callers
are expected to use :class:`PersistenceUnit` when atomicity matters.
"""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional, TypedDict


class ChangeRequestRow(TypedDict, total=False):
    id: str
    type: str
    status: str
    strategy_id: Optional[str]
    payload_json: str
    source_change_request_id: Optional[str]
    source_backtest_id: Optional[str]
    source_review_id: Optional[str]
    source_proposal_id: Optional[str]
    trigger_reason: Optional[str]
    linked_backtest_id: Optional[str]
    linked_review_id: Optional[str]
    follow_up_job_id: Optional[str]
    follow_up_job_type: Optional[str]
    follow_up_job_status: Optional[str]
    manual_followup_required: int
    manual_followup_detail: Optional[str]
    requested_by: str
    created_at: str
    updated_at: str
    applied_at: Optional[str]


class ChangeRequestHistoryRow(TypedDict, total=False):
    history_id: int  # auto-assigned on insert
    change_request_id: str
    status_from: Optional[str]
    status_to: str
    payload_json: str
    audit_event_id: Optional[str]
    transition_at: str


_INSERT_OR_REPLACE_SQL = """
INSERT OR REPLACE INTO change_requests (
    id, type, status, strategy_id, payload_json,
    source_change_request_id, source_backtest_id, source_review_id, source_proposal_id,
    trigger_reason, linked_backtest_id, linked_review_id,
    follow_up_job_id, follow_up_job_type, follow_up_job_status,
    manual_followup_required, manual_followup_detail,
    requested_by, created_at, updated_at, applied_at
) VALUES (
    :id, :type, :status, :strategy_id, :payload_json,
    :source_change_request_id, :source_backtest_id, :source_review_id, :source_proposal_id,
    :trigger_reason, :linked_backtest_id, :linked_review_id,
    :follow_up_job_id, :follow_up_job_type, :follow_up_job_status,
    :manual_followup_required, :manual_followup_detail,
    :requested_by, :created_at, :updated_at, :applied_at
)
"""

_HISTORY_INSERT_SQL = """
INSERT INTO change_request_history (
    change_request_id, status_from, status_to, payload_json,
    audit_event_id, transition_at
) VALUES (
    :change_request_id, :status_from, :status_to, :payload_json,
    :audit_event_id, :transition_at
)
"""

_BASE_SELECT = (
    "SELECT id, type, status, strategy_id, payload_json, "
    "source_change_request_id, source_backtest_id, source_review_id, source_proposal_id, "
    "trigger_reason, linked_backtest_id, linked_review_id, "
    "follow_up_job_id, follow_up_job_type, follow_up_job_status, "
    "manual_followup_required, manual_followup_detail, requested_by, "
    "created_at, updated_at, applied_at FROM change_requests"
)


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {key: row[key] for key in row.keys()}


class ChangeRequestDao:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self._conn = connection

    # ------------------------------------------------------------- write paths
    def upsert(self, row: ChangeRequestRow) -> str:
        params: Dict[str, Any] = {
            "id": row["id"],
            "type": row["type"],
            "status": row["status"],
            "strategy_id": row.get("strategy_id"),
            "payload_json": row["payload_json"],
            "source_change_request_id": row.get("source_change_request_id"),
            "source_backtest_id": row.get("source_backtest_id"),
            "source_review_id": row.get("source_review_id"),
            "source_proposal_id": row.get("source_proposal_id"),
            "trigger_reason": row.get("trigger_reason"),
            "linked_backtest_id": row.get("linked_backtest_id"),
            "linked_review_id": row.get("linked_review_id"),
            "follow_up_job_id": row.get("follow_up_job_id"),
            "follow_up_job_type": row.get("follow_up_job_type"),
            "follow_up_job_status": row.get("follow_up_job_status"),
            "manual_followup_required": 1 if row.get("manual_followup_required") else 0,
            "manual_followup_detail": row.get("manual_followup_detail"),
            "requested_by": row["requested_by"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "applied_at": row.get("applied_at"),
        }
        self._conn.execute(_INSERT_OR_REPLACE_SQL, params)
        return params["id"]

    def update_status(
        self,
        change_request_id: str,
        *,
        status: str,
        updated_at: str,
        applied_at: Optional[str] = None,
    ) -> int:
        cursor = self._conn.execute(
            "UPDATE change_requests SET status = ?, updated_at = ?, applied_at = ? "
            "WHERE id = ?",
            (status, updated_at, applied_at, change_request_id),
        )
        rowcount = cursor.rowcount
        cursor.close()
        return rowcount

    def insert_history(self, row: ChangeRequestHistoryRow) -> None:
        params = {
            "change_request_id": row["change_request_id"],
            "status_from": row.get("status_from"),
            "status_to": row["status_to"],
            "payload_json": row["payload_json"],
            "audit_event_id": row.get("audit_event_id"),
            "transition_at": row["transition_at"],
        }
        self._conn.execute(_HISTORY_INSERT_SQL, params)

    # -------------------------------------------------------------- read paths
    def get(self, change_request_id: str) -> Optional[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE id = ?", (change_request_id,)
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    def list(
        self,
        *,
        status: Optional[str] = None,
        strategy_id: Optional[str] = None,
        source_proposal_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        conditions: List[str] = []
        params: List[Any] = []
        if status is not None:
            conditions.append("status = ?")
            params.append(status)
        if strategy_id is not None:
            conditions.append("strategy_id = ?")
            params.append(strategy_id)
        if source_proposal_id is not None:
            conditions.append("source_proposal_id = ?")
            params.append(source_proposal_id)
        where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        sql = f"{_BASE_SELECT}{where_clause} ORDER BY updated_at DESC"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        cursor = self._conn.execute(sql, tuple(params))
        rows = [_row_to_dict(r) for r in cursor.fetchall()]
        cursor.close()
        return rows

    def list_history(
        self,
        change_request_id: str,
        *,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        sql = (
            "SELECT history_id, change_request_id, status_from, status_to, "
            "payload_json, audit_event_id, transition_at "
            "FROM change_request_history WHERE change_request_id = ? "
            "ORDER BY transition_at DESC"
        )
        params: List[Any] = [change_request_id]
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        cursor = self._conn.execute(sql, tuple(params))
        rows = [_row_to_dict(r) for r in cursor.fetchall()]
        cursor.close()
        return rows


__all__ = [
    "ChangeRequestDao",
    "ChangeRequestRow",
    "ChangeRequestHistoryRow",
]
