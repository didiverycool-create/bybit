"""DAO for the ``audit_events`` table.

Per ``docs/P0-5.1-persistence-design.md`` §B.1 this table is append-only — the
schema installs ``BEFORE UPDATE`` and ``BEFORE DELETE`` triggers that abort any
mutating statement. As a result this DAO exposes ``insert``, ``get``, ``list``
and several filtered list helpers, but **not** ``update`` or ``delete``.

``AuditEventRow`` is a thin :class:`TypedDict` describing the row shape so
callers can pass plain dicts without depending on the Pydantic models in
``models.py`` (the persistence layer is intentionally decoupled from the
application's domain layer per the wave-2 ground rules).
"""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional, TypedDict


class AuditEventRow(TypedDict, total=False):
    id: str
    event_type: str
    severity: str  # 'INFO' | 'WARNING' | 'ERROR'
    source: str
    symbol: Optional[str]
    strategy_id: Optional[str]
    payload_json: str
    summary: Optional[str]
    impact_detail: Optional[str]
    priority: int
    is_key_event: int  # 0 or 1
    trace_id: Optional[str]
    occurred_at: str
    created_at: str


_INSERT_SQL = """
INSERT INTO audit_events (
    id, event_type, severity, source, symbol, strategy_id, payload_json,
    summary, impact_detail, priority, is_key_event, trace_id, occurred_at
) VALUES (
    :id, :event_type, :severity, :source, :symbol, :strategy_id, :payload_json,
    :summary, :impact_detail, :priority, :is_key_event, :trace_id, :occurred_at
)
"""

_BASE_SELECT = (
    "SELECT id, event_type, severity, source, symbol, strategy_id, "
    "payload_json, summary, impact_detail, priority, is_key_event, "
    "trace_id, occurred_at, created_at FROM audit_events"
)


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {key: row[key] for key in row.keys()}


class AuditDao:
    """Thin CRUD wrapper around ``audit_events``."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._conn = connection

    def insert(self, event: AuditEventRow) -> str:
        """Insert a single event. Returns the inserted ``id``."""

        params: Dict[str, Any] = {
            "id": event["id"],
            "event_type": event["event_type"],
            "severity": event["severity"],
            "source": event["source"],
            "symbol": event.get("symbol"),
            "strategy_id": event.get("strategy_id"),
            "payload_json": event["payload_json"],
            "summary": event.get("summary"),
            "impact_detail": event.get("impact_detail"),
            "priority": int(event.get("priority", 6)),
            "is_key_event": 1 if event.get("is_key_event") else 0,
            "trace_id": event.get("trace_id"),
            "occurred_at": event["occurred_at"],
        }
        self._conn.execute(_INSERT_SQL, params)
        return params["id"]

    def insert_many(self, events: List[AuditEventRow]) -> int:
        for event in events:
            self.insert(event)
        return len(events)

    def get(self, event_id: str) -> Optional[Dict[str, Any]]:
        cursor = self._conn.execute(
            f"{_BASE_SELECT} WHERE id = ?", (event_id,)
        )
        row = cursor.fetchone()
        cursor.close()
        return _row_to_dict(row) if row is not None else None

    # --------------------------------------------------------------- listings
    def list(
        self,
        *,
        strategy_id: Optional[str] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        source: Optional[str] = None,
        symbol: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: Optional[int] = None,
        order: str = "DESC",
    ) -> List[Dict[str, Any]]:
        """Return events matching the supplied filters, newest first by default."""

        conditions: List[str] = []
        params: List[Any] = []
        if strategy_id is not None:
            conditions.append("strategy_id = ?")
            params.append(strategy_id)
        if event_type is not None:
            conditions.append("event_type = ?")
            params.append(event_type)
        if severity is not None:
            conditions.append("severity = ?")
            params.append(severity)
        if source is not None:
            conditions.append("source = ?")
            params.append(source)
        if symbol is not None:
            conditions.append("symbol = ?")
            params.append(symbol)
        if since is not None:
            conditions.append("occurred_at >= ?")
            params.append(since)
        if until is not None:
            conditions.append("occurred_at <= ?")
            params.append(until)

        where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        order_dir = "DESC" if order.upper() == "DESC" else "ASC"
        sql = f"{_BASE_SELECT}{where_clause} ORDER BY occurred_at {order_dir}"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))

        cursor = self._conn.execute(sql, tuple(params))
        rows = [_row_to_dict(row) for row in cursor.fetchall()]
        cursor.close()
        return rows

    def count(
        self,
        *,
        strategy_id: Optional[str] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> int:
        conditions: List[str] = []
        params: List[Any] = []
        if strategy_id is not None:
            conditions.append("strategy_id = ?")
            params.append(strategy_id)
        if event_type is not None:
            conditions.append("event_type = ?")
            params.append(event_type)
        if severity is not None:
            conditions.append("severity = ?")
            params.append(severity)
        where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        cursor = self._conn.execute(
            f"SELECT COUNT(*) FROM audit_events{where_clause}", tuple(params)
        )
        row = cursor.fetchone()
        cursor.close()
        return int(row[0]) if row is not None else 0


__all__ = ["AuditDao", "AuditEventRow"]
