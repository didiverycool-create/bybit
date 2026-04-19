from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, List, Optional

from datetime_utils import parse_optional_iso_datetime
from models import (
    AlertRecord,
    ExecutionEvent,
    OrderRecord,
    StrategyActivityLatestOpsSnapshot,
    TradeRecord,
)
from repository import AppRepository

if TYPE_CHECKING:
    from strategy_activity_payload import StrategyActivityRecentData


@dataclass(frozen=True)
class StrategyActivityLatestOpsRecords:
    latest_active_order_record: Optional[OrderRecord]
    latest_historical_order_record: Optional[OrderRecord]
    latest_order_record: Optional[OrderRecord]
    latest_pending_alert_record: Optional[AlertRecord]
    latest_trade_record: Optional[TradeRecord]
    latest_alert_record: Optional[AlertRecord]
    latest_audit_event_record: Optional[ExecutionEvent]


def build_strategy_activity_latest_ops_records(
    *,
    active_orders: List[OrderRecord],
    recent_orders: List[OrderRecord],
    recent_trades: List[TradeRecord],
    recent_alerts: List[AlertRecord],
    recent_audit_events: List[ExecutionEvent],
) -> StrategyActivityLatestOpsRecords:
    latest_active_order_record = next(iter(active_orders), None)
    latest_historical_order_record = next(iter(recent_orders), None)
    latest_order_record = latest_active_order_record
    if latest_historical_order_record is not None:
        if latest_order_record is None:
            latest_order_record = latest_historical_order_record
        else:
            latest_order_created_at = parse_optional_iso_datetime(latest_order_record.created_at)
            latest_historical_order_created_at = parse_optional_iso_datetime(latest_historical_order_record.created_at)
            if (
                latest_order_created_at is None
                or (
                    latest_historical_order_created_at is not None
                    and latest_historical_order_created_at > latest_order_created_at
                )
            ):
                latest_order_record = latest_historical_order_record
    latest_trade_record = next(iter(recent_trades), None)
    latest_alert_record = None
    latest_pending_alert_record = None
    for alert_record in recent_alerts:
        if latest_alert_record is None:
            latest_alert_record = alert_record
        if latest_pending_alert_record is None and not alert_record.acknowledged:
            latest_pending_alert_record = alert_record
        if latest_alert_record is not None and latest_pending_alert_record is not None:
            break
    latest_audit_event_record = AppRepository._pick_latest_key_execution_event(recent_audit_events)
    return StrategyActivityLatestOpsRecords(
        latest_active_order_record=latest_active_order_record,
        latest_historical_order_record=latest_historical_order_record,
        latest_order_record=latest_order_record,
        latest_pending_alert_record=latest_pending_alert_record,
        latest_trade_record=latest_trade_record,
        latest_alert_record=latest_alert_record,
        latest_audit_event_record=latest_audit_event_record,
    )


def summarize_strategy_activity_order(order: OrderRecord) -> str:
    side = "买" if order.side == "buy" else "卖"
    return f"{order.symbol} {side} {order.qty}@{order.price} · {order.status}"


def summarize_strategy_activity_trade(trade: TradeRecord) -> str:
    side = "买" if trade.side == "buy" else "卖"
    parts = [f"{trade.symbol} {side} {trade.quantity}@{trade.price}", str(trade.status or "filled")]
    pnl = str(trade.pnl or "").strip()
    if pnl and pnl != "--":
        parts.append(f"pnl {pnl}")
    return " · ".join(parts)


def summarize_strategy_activity_alert(alert: AlertRecord) -> str:
    detail = alert.description.strip()
    action = str(alert.suggested_action or "").strip()
    if action:
        detail = f"{detail} · {action}" if detail else action
    return f"{alert.severity} {alert.title}{f' · {detail}' if detail else ''}"


def summarize_strategy_activity_audit_event(event: ExecutionEvent) -> str:
    return AppRepository._summarize_execution_event(event)


def build_strategy_activity_latest_ops_snapshot(
    *,
    latest_active_order_summary: Optional[str],
    latest_historical_order_summary: Optional[str],
    latest_order_summary: Optional[str],
    latest_pending_alert_summary: Optional[str],
    latest_trade_summary: Optional[str],
    latest_alert_summary: Optional[str],
    latest_audit_event_summary: Optional[str],
    latest_active_order_record: Optional[OrderRecord],
    latest_historical_order_record: Optional[OrderRecord],
    latest_order_record: Optional[OrderRecord],
    latest_pending_alert_record: Optional[AlertRecord],
    latest_trade_record: Optional[TradeRecord],
    latest_alert_record: Optional[AlertRecord],
    latest_audit_event_record: Optional[ExecutionEvent],
) -> StrategyActivityLatestOpsSnapshot:
    return StrategyActivityLatestOpsSnapshot(
        latest_active_order=latest_active_order_summary,
        latest_historical_order=latest_historical_order_summary,
        latest_order=latest_order_summary,
        latest_pending_alert=latest_pending_alert_summary,
        latest_trade=latest_trade_summary,
        latest_alert=latest_alert_summary,
        latest_audit_event=latest_audit_event_summary,
        latest_active_order_record=latest_active_order_record,
        latest_historical_order_record=latest_historical_order_record,
        latest_order_record=latest_order_record,
        latest_pending_alert_record=latest_pending_alert_record,
        latest_trade_record=latest_trade_record,
        latest_alert_record=latest_alert_record,
        latest_audit_event_record=latest_audit_event_record,
    )


def build_strategy_activity_latest_ops(
    recent_data: StrategyActivityRecentData,
) -> StrategyActivityLatestOpsSnapshot:
    latest_ops_records = build_strategy_activity_latest_ops_records(
        active_orders=recent_data.active_orders,
        recent_orders=recent_data.recent_orders,
        recent_trades=recent_data.recent_trades,
        recent_alerts=recent_data.recent_alerts,
        recent_audit_events=recent_data.recent_audit_events,
    )
    return build_strategy_activity_latest_ops_snapshot(
        latest_active_order_summary=(
            summarize_strategy_activity_order(latest_ops_records.latest_active_order_record)
            if latest_ops_records.latest_active_order_record
            else None
        ),
        latest_historical_order_summary=(
            summarize_strategy_activity_order(latest_ops_records.latest_historical_order_record)
            if latest_ops_records.latest_historical_order_record
            else None
        ),
        latest_order_summary=(
            summarize_strategy_activity_order(latest_ops_records.latest_order_record)
            if latest_ops_records.latest_order_record
            else None
        ),
        latest_pending_alert_summary=(
            summarize_strategy_activity_alert(latest_ops_records.latest_pending_alert_record)
            if latest_ops_records.latest_pending_alert_record
            else None
        ),
        latest_trade_summary=(
            summarize_strategy_activity_trade(latest_ops_records.latest_trade_record)
            if latest_ops_records.latest_trade_record
            else None
        ),
        latest_alert_summary=(
            summarize_strategy_activity_alert(latest_ops_records.latest_alert_record)
            if latest_ops_records.latest_alert_record
            else None
        ),
        latest_audit_event_summary=(
            summarize_strategy_activity_audit_event(latest_ops_records.latest_audit_event_record)
            if latest_ops_records.latest_audit_event_record
            else None
        ),
        latest_active_order_record=latest_ops_records.latest_active_order_record,
        latest_historical_order_record=latest_ops_records.latest_historical_order_record,
        latest_order_record=latest_ops_records.latest_order_record,
        latest_pending_alert_record=latest_ops_records.latest_pending_alert_record,
        latest_trade_record=latest_ops_records.latest_trade_record,
        latest_alert_record=latest_ops_records.latest_alert_record,
        latest_audit_event_record=latest_ops_records.latest_audit_event_record,
    )
