"""DAO for ``agent_jobs``.

Per ``docs/P0-5.1-persistence-design.md`` §B.3, agent jobs carry an
``idempotency_key UNIQUE`` constraint. The DAO surfaces:

* :meth:`upsert` — insert or replace by primary key (``id``).
* :meth:`update_status` — promote a job to a new status.
* :meth:`update_result` — record ``result_json`` + ``finished_at``.
* :meth:`get`, :meth:`get_by_idempotency_key`, :meth:`list`.
"""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional, TypedDict


class AgentJobRow(TypedDict, total=False):
    id: str
    job_type: str
    status: str
    idempotency_key: Optional[str]
    strategy_id: Optional[str]
    backtest_id: Optional[str]
    context_json: str
    allowed_actions_json: str
    timeout_seconds: Optional[int]
    writeback_target: Optional[str]
    linked_review_id: Optional[str]
    linked_review_title: Optional[str]
    linked_review_period: Optional[str]
    retried_from_job_id: Optional[str]
    retry_count: int
    result_json: Optional[str]
    requested_by: str
    queued_at: str
    started_at: Optional[str]
    finished_at: Optional[str]


# NB: this INSERT uses ON CONFLICT(id) DO UPDATE rather than
# `INSERT OR REPLACE` because the latter would silently overwrite a
# DIFFERENT row that happens to share the UNIQUE idempotency_key — that
# would defeat the whole point of the idempotency_key UNIQUE constraint.
# By scoping the conflict resolution to the primary key we still allow
# upsert-by-id semantics while letting UNIQUE(idempotency_key) raise
# when a caller tries to claim an already-used key with a new id.
_INSERT_SQL = """
INSERT INTO agent_jobs (
    id, job_type, status, idempotency_key, strategy_id, backtest_id,
    context_json, allowed_actions_json, timeout_seconds, writeback_target,
    linked_review_id, linked_review_title, linked_review_period,
    retried_from_job_id, retry_count, result_json,
    requested_by, queued_at, started_at, finished_at
) VALUES (
    :id, :job_type, :status, :idempotency_key, :strategy_id, :backtest_id,
    :context_json, :allowed_actions_json, :timeout_seconds, :writeback_target,
    :linked_review_id, :linked_review_title, :linked_review_period,
    :retried_from_job_id, :retry_count, :result_json,
    :requested_by, :queued_at, :started_at, :finished_at
)
ON CONFLICT(id) DO UPDATE SET
    job_type = excluded.job_type,
    status = excluded.status,
    idempotency_key = excluded.idempotency_key,
    strategy_id = excluded.strategy_id,
    backtest_id = excluded.backtest_id,
    context_json = excluded.context_json,
    allowed_actions_json = excluded.allowed_actions_json,
    timeout_seconds = excluded.timeout_seconds,
    writeback_target = excluded.writeback_target,
    linked_review_id = excluded.linked_review_id,
    linked_review_title = excluded.linked_review_title,
    linked_review_period = excluded.linked_review_period,
    retried_from_job_id = excluded.retried_from_job_id,
    retry_count = excluded.retry_count,
    result_json = excluded.result_json,
    requested_by = excluded.requested_by,
    queued_at = excluded.queued_at,
    started_at = excluded.started_at,
    finished_at = excluded.finished_at
"""

_BASE_SELECT = (
    "SELECT id, job_type, status, idempotency_key, strategy_id, backtest_id, "
    "context_json, allowed_actions_json, timeout_seconds, writeback_target, "
    "linked_review_id, linked_review_title, linked_review_period, "
    "retried_from_job_id, retry_count, result_json, "
    "requested_by, queued_at, started_at, finished_at FROM agent_jobs"
)


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {key: row[key] for key in row.keys()}


class AgentJobDao:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self._conn = connection

    # ------------------------------------------------------------- write paths
    def upsert(self, row: AgentJobRow) -> str:
        params: Dict[str, Any] = {
            "id": row["id"],
            "job_type": row["job_type"],
            "status": row["status"],
            "idempotency_key": row.get("idempotency_key"),
            "strategy_id": row.get("strategy_id"),
            "backtest_id": row.get("backtest_id"),
            "context_json": row["context_json"],
            "allowed_actions_json": row["allowed_actions_json"],
            "timeout_seconds": row.get("timeout_seconds"),
            "writeback_target": row.get("writeback_target"),
            "linked_review_id": row.get("linked_review_id"),
            "linked_review_title": row.get("linked_review_title"),
            "linked_review_period": row.get("linked_review_period"),
            "retried_from_job_id": row.get("retried_from_job_id"),
            "retry_count": int(row.get("retry_count", 0)),
            "result_json": row.get("result_json"),
            "requested_by": row["requested_by"],
            "queued_at": row["queued_at"],
            "started_at": row.get("started_at"),
            "finished_at": row.get("finished_at"),
        }
        self._conn.execute(_INSERT_SQL, params)
        return params["id"]

    def update_status(
        self,
        job_id: str,
        *,
        status: str,
        started_at: Optional[str] = None,
        finished_at: Optional[str] = None,
    ) -> int:
        cursor = self._conn.execute(
            "UPDATE agent_jobs SET status = ?, started_at = COALESCE(?, started_at), "
            "finished_at = COALESCE(?, finished_at) WHERE id = ?",
            (status, started_at, finished_at, job_id),
        )
        rowcount = cursor.rowcount
        cursor.close()
        return rowcount

    def update_result(
        self,
        job_id: str,
        *,
        result_json: str,
        finished_at: str,
        status: Optional[str] = None,
    ) -> int:
        if status is not None:
            cursor = self._conn.execute(
                "UPDATE agent_jobs SET result_json = ?, finished_at = ?, status = ? "
                "WHERE id = ?",
                (result_json, finished_at, status, job_id),
            )
        else:
            cursor = self._conn.execute(
                "UPDATE agent_jobs SET result_json = ?, finished_at = ? WHERE id = ?",
                (result_json, finished_at, job_id),
            )
        rowcount = cursor.rowcount
        cursor.close()
        return rowcount

    # -------------------------------------------------------------- read paths
    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE id = ?", (job_id,)
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    def get_by_idempotency_key(self, key: str) -> Optional[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE idempotency_key = ?", (key,)
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    def list(
        self,
        *,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        strategy_id: Optional[str] = None,
        backtest_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        conditions: List[str] = []
        params: List[Any] = []
        if status is not None:
            conditions.append("status = ?")
            params.append(status)
        if job_type is not None:
            conditions.append("job_type = ?")
            params.append(job_type)
        if strategy_id is not None:
            conditions.append("strategy_id = ?")
            params.append(strategy_id)
        if backtest_id is not None:
            conditions.append("backtest_id = ?")
            params.append(backtest_id)
        where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        sql = f"{_BASE_SELECT}{where_clause} ORDER BY queued_at DESC"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        cursor = self._conn.execute(sql, tuple(params))
        rows = [_row_to_dict(r) for r in cursor.fetchall()]
        cursor.close()
        return rows


__all__ = ["AgentJobDao", "AgentJobRow"]
