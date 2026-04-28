"""DAO for ``backtest_runs``.

Per ``docs/P0-5.1-persistence-design.md`` §B.4, BacktestRun stores its full
``result_blob`` as a TEXT column (decision §G.2 — single-blob is sufficient
until P0-4.4 evaluates whether to split into ``backtest_run_trades``). The
DAO simply round-trips the blob; structured metric fields live in
``metrics_json`` and the curated columns (``sample_quality`` etc.) below.
"""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional, TypedDict


class BacktestRunRow(TypedDict, total=False):
    id: str
    strategy_id: str
    status: str
    timeframe: str  # '15m' | '1h' | '4h' | '1d'
    data_range_text: str
    requested_range_start: Optional[str]
    requested_range_end: Optional[str]
    parameter_snapshot_id: Optional[int]
    history_source: Optional[str]
    history_source_reason: Optional[str]
    history_source_detail: Optional[str]
    sample_quality: Optional[str]
    decision_readiness: Optional[str]
    history_truncated: int
    history_gap_reason: Optional[str]
    requested_candle_estimate: Optional[int]
    requested_candle_limit: Optional[int]
    retrieved_candle_count: Optional[int]
    used_candle_count: Optional[int]
    source_change_request_id: Optional[str]
    source_backtest_id: Optional[str]
    source_review_id: Optional[str]
    source_proposal_id: Optional[str]
    trigger_reason: Optional[str]
    metrics_json: Optional[str]
    result_blob: Optional[str]
    requested_by: str
    created_at: str
    completed_at: Optional[str]


_INSERT_OR_REPLACE_SQL = """
INSERT OR REPLACE INTO backtest_runs (
    id, strategy_id, status, timeframe, data_range_text,
    requested_range_start, requested_range_end, parameter_snapshot_id,
    history_source, history_source_reason, history_source_detail,
    sample_quality, decision_readiness,
    history_truncated, history_gap_reason,
    requested_candle_estimate, requested_candle_limit,
    retrieved_candle_count, used_candle_count,
    source_change_request_id, source_backtest_id, source_review_id, source_proposal_id,
    trigger_reason, metrics_json, result_blob,
    requested_by, created_at, completed_at
) VALUES (
    :id, :strategy_id, :status, :timeframe, :data_range_text,
    :requested_range_start, :requested_range_end, :parameter_snapshot_id,
    :history_source, :history_source_reason, :history_source_detail,
    :sample_quality, :decision_readiness,
    :history_truncated, :history_gap_reason,
    :requested_candle_estimate, :requested_candle_limit,
    :retrieved_candle_count, :used_candle_count,
    :source_change_request_id, :source_backtest_id, :source_review_id, :source_proposal_id,
    :trigger_reason, :metrics_json, :result_blob,
    :requested_by, :created_at, :completed_at
)
"""

_BASE_SELECT = (
    "SELECT id, strategy_id, status, timeframe, data_range_text, "
    "requested_range_start, requested_range_end, parameter_snapshot_id, "
    "history_source, history_source_reason, history_source_detail, "
    "sample_quality, decision_readiness, history_truncated, history_gap_reason, "
    "requested_candle_estimate, requested_candle_limit, "
    "retrieved_candle_count, used_candle_count, "
    "source_change_request_id, source_backtest_id, source_review_id, source_proposal_id, "
    "trigger_reason, metrics_json, result_blob, "
    "requested_by, created_at, completed_at FROM backtest_runs"
)


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {key: row[key] for key in row.keys()}


class BacktestDao:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self._conn = connection

    # ------------------------------------------------------------- write paths
    def upsert(self, row: BacktestRunRow) -> str:
        params: Dict[str, Any] = {
            "id": row["id"],
            "strategy_id": row["strategy_id"],
            "status": row["status"],
            "timeframe": row["timeframe"],
            "data_range_text": row["data_range_text"],
            "requested_range_start": row.get("requested_range_start"),
            "requested_range_end": row.get("requested_range_end"),
            "parameter_snapshot_id": row.get("parameter_snapshot_id"),
            "history_source": row.get("history_source"),
            "history_source_reason": row.get("history_source_reason"),
            "history_source_detail": row.get("history_source_detail"),
            "sample_quality": row.get("sample_quality"),
            "decision_readiness": row.get("decision_readiness"),
            "history_truncated": 1 if row.get("history_truncated") else 0,
            "history_gap_reason": row.get("history_gap_reason"),
            "requested_candle_estimate": row.get("requested_candle_estimate"),
            "requested_candle_limit": row.get("requested_candle_limit"),
            "retrieved_candle_count": row.get("retrieved_candle_count"),
            "used_candle_count": row.get("used_candle_count"),
            "source_change_request_id": row.get("source_change_request_id"),
            "source_backtest_id": row.get("source_backtest_id"),
            "source_review_id": row.get("source_review_id"),
            "source_proposal_id": row.get("source_proposal_id"),
            "trigger_reason": row.get("trigger_reason"),
            "metrics_json": row.get("metrics_json"),
            "result_blob": row.get("result_blob"),
            "requested_by": row["requested_by"],
            "created_at": row["created_at"],
            "completed_at": row.get("completed_at"),
        }
        self._conn.execute(_INSERT_OR_REPLACE_SQL, params)
        return params["id"]

    def update_status(
        self,
        backtest_id: str,
        *,
        status: str,
        completed_at: Optional[str] = None,
    ) -> int:
        cursor = self._conn.execute(
            "UPDATE backtest_runs SET status = ?, completed_at = COALESCE(?, completed_at) "
            "WHERE id = ?",
            (status, completed_at, backtest_id),
        )
        rowcount = cursor.rowcount
        cursor.close()
        return rowcount

    def update_result(
        self,
        backtest_id: str,
        *,
        metrics_json: Optional[str],
        result_blob: Optional[str],
        completed_at: Optional[str] = None,
        status: Optional[str] = None,
    ) -> int:
        sets = ["metrics_json = ?", "result_blob = ?"]
        params: List[Any] = [metrics_json, result_blob]
        if completed_at is not None:
            sets.append("completed_at = ?")
            params.append(completed_at)
        if status is not None:
            sets.append("status = ?")
            params.append(status)
        params.append(backtest_id)
        sql = f"UPDATE backtest_runs SET {', '.join(sets)} WHERE id = ?"
        cursor = self._conn.execute(sql, tuple(params))
        rowcount = cursor.rowcount
        cursor.close()
        return rowcount

    # -------------------------------------------------------------- read paths
    def get(self, backtest_id: str) -> Optional[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE id = ?", (backtest_id,)
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    def list(
        self,
        *,
        status: Optional[str] = None,
        strategy_id: Optional[str] = None,
        source_change_request_id: Optional[str] = None,
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
        if source_change_request_id is not None:
            conditions.append("source_change_request_id = ?")
            params.append(source_change_request_id)
        where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        sql = f"{_BASE_SELECT}{where_clause} ORDER BY created_at DESC"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        cursor = self._conn.execute(sql, tuple(params))
        rows = [_row_to_dict(r) for r in cursor.fetchall()]
        cursor.close()
        return rows


__all__ = ["BacktestDao", "BacktestRunRow"]
