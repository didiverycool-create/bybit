"""DAO for ``execution_events``.

Per ``docs/P0-5.1-persistence-design.md`` §B.5, this table is the
event-sourced state-machine log for the upcoming P0-4.2 ExecutionEngine. Like
``audit_events`` it is append-only conceptually, but the schema does **not**
install update/delete triggers — replays and recovery flows may need to scan
and re-emit historical rows. The ``UNIQUE (intent_id, state_to, occurred_at)``
constraint is what enforces "no duplicate transition" semantics.
"""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional, TypedDict


class ExecutionEventRow(TypedDict, total=False):
    id: str
    intent_id: str
    intent_seq: int
    strategy_id: str
    exchange_link_id: Optional[str]
    state_from: Optional[str]
    state_to: str
    verb: Optional[str]
    order_id: Optional[str]
    risk_decision_json: Optional[str]
    payload_json: str
    audit_event_id: Optional[str]
    occurred_at: str


_INSERT_SQL = """
INSERT INTO execution_events (
    id, intent_id, intent_seq, strategy_id, exchange_link_id,
    state_from, state_to, verb, order_id, risk_decision_json,
    payload_json, audit_event_id, occurred_at
) VALUES (
    :id, :intent_id, :intent_seq, :strategy_id, :exchange_link_id,
    :state_from, :state_to, :verb, :order_id, :risk_decision_json,
    :payload_json, :audit_event_id, :occurred_at
)
"""

_BASE_SELECT = (
    "SELECT id, intent_id, intent_seq, strategy_id, exchange_link_id, "
    "state_from, state_to, verb, order_id, risk_decision_json, "
    "payload_json, audit_event_id, occurred_at FROM execution_events"
)


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {key: row[key] for key in row.keys()}


class ExecutionEventDao:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self._conn = connection

    # ------------------------------------------------------------- write paths
    def insert(self, row: ExecutionEventRow) -> str:
        params: Dict[str, Any] = {
            "id": row["id"],
            "intent_id": row["intent_id"],
            "intent_seq": int(row["intent_seq"]),
            "strategy_id": row["strategy_id"],
            "exchange_link_id": row.get("exchange_link_id"),
            "state_from": row.get("state_from"),
            "state_to": row["state_to"],
            "verb": row.get("verb"),
            "order_id": row.get("order_id"),
            "risk_decision_json": row.get("risk_decision_json"),
            "payload_json": row["payload_json"],
            "audit_event_id": row.get("audit_event_id"),
            "occurred_at": row["occurred_at"],
        }
        self._conn.execute(_INSERT_SQL, params)
        return params["id"]

    # -------------------------------------------------------------- read paths
    def get(self, event_id: str) -> Optional[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE id = ?", (event_id,)
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    def list_by_intent(self, intent_id: str) -> List[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE intent_id = ? ORDER BY occurred_at ASC",
            (intent_id,),
        )
        rows = [_row_to_dict(r) for r in cursor.fetchall()]
        cursor.close()
        return rows

    def list(
        self,
        *,
        intent_id: Optional[str] = None,
        strategy_id: Optional[str] = None,
        state_to: Optional[str] = None,
        exchange_link_id: Optional[str] = None,
        limit: Optional[int] = None,
        order: str = "DESC",
    ) -> List[Dict[str, Any]]:
        conditions: List[str] = []
        params: List[Any] = []
        if intent_id is not None:
            conditions.append("intent_id = ?")
            params.append(intent_id)
        if strategy_id is not None:
            conditions.append("strategy_id = ?")
            params.append(strategy_id)
        if state_to is not None:
            conditions.append("state_to = ?")
            params.append(state_to)
        if exchange_link_id is not None:
            conditions.append("exchange_link_id = ?")
            params.append(exchange_link_id)
        where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        order_dir = "DESC" if order.upper() == "DESC" else "ASC"
        sql = f"{_BASE_SELECT}{where_clause} ORDER BY occurred_at {order_dir}"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        cursor = self._conn.execute(sql, tuple(params))
        rows = [_row_to_dict(r) for r in cursor.fetchall()]
        cursor.close()
        return rows


__all__ = ["ExecutionEventDao", "ExecutionEventRow"]
