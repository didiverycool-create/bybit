"""Strategy execution-event sync helpers extracted from ``main.py``.

The cluster fans Bybit-side exchange-order lifecycle and runtime-snapshot
state into the ``exchange_order.*`` audit family, the strategy-runtime
``AlertRecord`` queue and the ``_apply_live_strategy_stop_loss_guards``
guard rail.  Until R122 these helpers lived inline in
``services/control-api/main.py`` (post-R120 regions ~5950-6210 + 7505-7882):

* parameter-reading helpers (``_strategy_parameter_float`` /
  ``_strategy_parameter_int``)
* strategy-summary cooldown / threshold lookups
  (``_strategy_live_stop_loss_cooldown_remaining_minutes``,
  ``_strategy_exchange_rejection_guard_*``,
  ``_strategy_exchange_order_stale_minutes``)
* exchange-order status classifier (R101 ``_classify_exchange_order_status_event``)
* the four ``_sync_strategy_*`` synchronizers that fan
  ``OrderRecord`` / ``StrategyRuntimeSnapshot`` lists into audit events,
  alerts and queued review jobs
* the live ``_apply_live_strategy_stop_loss_guards`` guard rail

Following the pattern established by :mod:`alert_and_guard_sync`,
:mod:`audit_aggregators`, :mod:`execution_health` and :mod:`strategy_alerts`,
this module exposes pure functions that accept their collaborators as
explicit keyword arguments.  ``main.py`` keeps thin wrappers under the
original ``_strategy_…`` / ``_sync_strategy_…`` / ``_apply_live_…``
names so every existing call site (and the test surface, which patches
``control_main._strategy_live_stop_loss_cooldown_remaining_minutes``,
``control_main._strategy_exchange_rejection_guard_remaining_minutes`` etc.)
stays untouched.

Internal cross-references between this module's helpers
(``_sync_strategy_stale_order_issues`` calling
``_is_strategy_active_order_stale`` calling
``_strategy_active_order_stale_age_minutes`` etc.) resolve as ordinary
module-internal lookups, so the wrapper layer in ``main.py`` only needs to
thread the few external collaborators (``repo``, ``parameter_resolver``,
the strategy parameter snapshot resolver, the per-strategy
``_clear_strategy_…_alerts`` upserters from :mod:`strategy_alerts`, the
order-summary/positions builders, ``parse_*`` / ``cancel_*`` order helpers
and the typed ``_NON_RUNNING_STRATEGY_STATUSES`` set) through to the public
entry points.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, FrozenSet, List, Optional, Tuple

from models import (
    AccountMode,
    EventSeverity,
    ExecutionEvent,
    NON_PAPER_ACCOUNT_MODES,
    OrderRecord,
    PositionRecord,
    StrategyRuntimeSnapshot,
    StrategySummary,
)


def strategy_parameter_float(strategy: StrategySummary, key: str) -> Optional[float]:
    for parameter in strategy.parameters:
        if parameter.key != key:
            continue
        try:
            return float(parameter.value)
        except (TypeError, ValueError):
            return None
    return None


def strategy_parameter_int(strategy: StrategySummary, key: str) -> Optional[int]:
    value = strategy_parameter_float(strategy, key)
    if value is None:
        return None
    return int(round(value))


def strategy_live_stop_loss_cooldown_remaining_minutes(
    strategy: StrategySummary,
    *,
    repo: Any,
) -> Optional[int]:
    cooldown_minutes = strategy_parameter_float(strategy, "cooldown_minutes") or 0.0
    if cooldown_minutes <= 0:
        return None
    latest_guard_event = next(
        (
            event
            for event in repo.snapshot().audit_events
            if event.event_type == "strategy.exchange_stop_loss.alerted"
            and event.strategy_id == strategy.id
        ),
        None,
    )
    if latest_guard_event is None:
        return None
    try:
        occurred_at = datetime.fromisoformat(latest_guard_event.occurred_at)
    except ValueError:
        return None
    elapsed_minutes = (datetime.now(timezone.utc).astimezone() - occurred_at).total_seconds() / 60
    remaining = int(round(cooldown_minutes - elapsed_minutes))
    return remaining if remaining > 0 else None


def strategy_exchange_rejection_guard_threshold(strategy: StrategySummary) -> int:
    return max(strategy_parameter_int(strategy, "rejection_guard_count") or 2, 1)


def strategy_exchange_rejection_guard_window_minutes(strategy: StrategySummary) -> int:
    return max(strategy_parameter_int(strategy, "rejection_guard_window_minutes") or 15, 1)


def strategy_exchange_rejection_guard_cooldown_minutes(strategy: StrategySummary) -> int:
    return max(strategy_parameter_int(strategy, "rejection_cooldown_minutes") or 20, 1)


def strategy_exchange_rejection_event_time(event: ExecutionEvent) -> datetime:
    raw_value = event.payload.get("order_created_at") or event.occurred_at
    try:
        return datetime.fromisoformat(str(raw_value))
    except (TypeError, ValueError):
        return datetime.fromtimestamp(0, tz=timezone.utc)


def strategy_exchange_rejection_recent_count(
    strategy: StrategySummary,
    *,
    repo: Any,
) -> int:
    threshold_window = strategy_exchange_rejection_guard_window_minutes(strategy)
    cutoff = datetime.now(timezone.utc).astimezone() - timedelta(minutes=threshold_window)
    return sum(
        1
        for event in repo.snapshot().audit_events
        if event.strategy_id == strategy.id
        and event.event_type == "exchange_order.rejected"
        and strategy_exchange_rejection_event_time(event) >= cutoff
    )


def strategy_exchange_rejection_guard_remaining_minutes(
    strategy: StrategySummary,
    *,
    repo: Any,
    non_running_strategy_statuses: FrozenSet[str],
) -> Optional[int]:
    if strategy.mode == AccountMode.PAPER or strategy.status in non_running_strategy_statuses:
        return None
    threshold = strategy_exchange_rejection_guard_threshold(strategy)
    cooldown_minutes = strategy_exchange_rejection_guard_cooldown_minutes(strategy)
    threshold_window = strategy_exchange_rejection_guard_window_minutes(strategy)
    if threshold <= 0 or cooldown_minutes <= 0 or threshold_window <= 0:
        return None

    cutoff = datetime.now(timezone.utc).astimezone() - timedelta(minutes=threshold_window)
    recent_events = [
        event
        for event in repo.snapshot().audit_events
        if event.strategy_id == strategy.id
        and event.event_type == "exchange_order.rejected"
        and strategy_exchange_rejection_event_time(event) >= cutoff
    ]
    if len(recent_events) < threshold:
        return None
    latest_event = max(recent_events, key=strategy_exchange_rejection_event_time)
    latest_at = strategy_exchange_rejection_event_time(latest_event)
    elapsed_minutes = (datetime.now(timezone.utc).astimezone() - latest_at).total_seconds() / 60
    remaining = int(round(cooldown_minutes - elapsed_minutes))
    return remaining if remaining > 0 else None


def strategy_exchange_order_stale_minutes(strategy: StrategySummary) -> int:
    return max(strategy_parameter_int(strategy, "stale_order_minutes") or 20, 1)


def parse_order_created_at(value: Optional[str]) -> datetime:
    if not value:
        return datetime.fromtimestamp(0, tz=timezone.utc)
    try:
        return datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return datetime.fromtimestamp(0, tz=timezone.utc)


def strategy_active_order_stale_age_minutes(order: OrderRecord) -> int:
    created_at = parse_order_created_at(order.created_at)
    elapsed_minutes = (datetime.now(timezone.utc).astimezone() - created_at).total_seconds() / 60
    return max(int(round(elapsed_minutes)), 0)


def is_strategy_active_order_stale(strategy: StrategySummary, order: Optional[OrderRecord]) -> bool:
    if order is None or strategy.mode == AccountMode.PAPER:
        return False
    return strategy_active_order_stale_age_minutes(order) >= strategy_exchange_order_stale_minutes(strategy)


# Round 101 — classify a Bybit exchange-order status string onto the typed
# ``(event_type, severity)`` tuple shared by every consumer that projects
# external order history onto the ``exchange_order.*`` audit family.  Bybit
# returns mixed-case variants (``"Filled"`` / ``"PartiallyFilled"`` /
# ``"Cancelled"`` / ``"PartiallyFilledCanceled"`` / ``"Rejected"`` / …) so the
# classifier lowercases first and matches substrings.  Callers that treat an
# unknown status as a no-op short-circuit on ``None``; callers that want an
# ``exchange_order.updated`` fallback apply it at the callsite.
def classify_exchange_order_status_event(
    status: str,
) -> Optional[Tuple[str, EventSeverity]]:
    normalized = status.lower()
    if "fill" in normalized:
        return "exchange_order.filled", EventSeverity.INFO
    if "cancel" in normalized:
        return "exchange_order.cancelled", EventSeverity.WARNING
    if "reject" in normalized:
        return "exchange_order.rejected", EventSeverity.ERROR
    return None


def sync_strategy_exchange_order_history_events(
    history_items: List[OrderRecord],
    *,
    repo: Any,
    resolve_strategy_parameter_snapshot: Callable[[Optional[str]], Optional[Dict[str, Any]]],
) -> None:
    def _event_payload_matches(item: ExecutionEvent, event_type: str, order_id: str) -> bool:
        return item.event_type == event_type and str(item.payload.get("order_id") or "") == order_id

    changed = False
    with repo._lock:  # type: ignore[attr-defined]
        for order in history_items:
            if order.origin != "strategy" or not order.strategy_id:
                continue
            classified = classify_exchange_order_status_event(order.status)
            if classified is None:
                continue
            event_type, severity = classified
            if event_type == "exchange_order.filled":
                detail = f"真实策略委托已成交 {order.qty}@{order.price} ({order.status})"
            elif event_type == "exchange_order.cancelled":
                detail = f"真实策略委托已撤销 {order.qty}@{order.price} ({order.status})"
            else:
                detail = f"真实策略委托被拒绝 {order.qty}@{order.price} ({order.status})"
            if any(_event_payload_matches(event, event_type, order.order_id) for event in repo.state.audit_events):  # type: ignore[attr-defined]
                continue
            repo.add_event(
                event_type=event_type,
                source="quant-core",
                severity=severity,
                payload={
                    "order_id": order.order_id,
                    "order_created_at": order.created_at,
                    "strategy_id": order.strategy_id,
                    "symbol": order.symbol,
                    "market": order.market,
                    "status": order.status,
                    "qty": order.qty,
                    "price": order.price,
                    "detail": detail,
                },
                symbol=order.symbol,
                strategy_id=order.strategy_id,
                parameter_snapshot=resolve_strategy_parameter_snapshot(order.strategy_id),
            )
            changed = True
        if changed:
            repo._persist()  # type: ignore[attr-defined]


def sync_strategy_exchange_order_history_alerts(
    history_items: List[OrderRecord],
    *,
    repo: Any,
    clear_strategy_exchange_rejected_alerts: Callable[..., bool],
    queue_strategy_issue_review_locked: Callable[..., None],
) -> None:
    snapshot_state = repo.snapshot()
    strategies_by_id = {item.id: item for item in snapshot_state.strategies}
    fallback_mode = snapshot_state.workspace_preferences.selected_mode

    def _parse_order_time(value: Optional[str]) -> datetime:
        if not value:
            return datetime.fromtimestamp(0, tz=timezone.utc)
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return datetime.fromtimestamp(0, tz=timezone.utc)

    latest_by_strategy: Dict[str, OrderRecord] = {}
    for order in history_items:
        if order.origin != "strategy" or not order.strategy_id:
            continue
        current = latest_by_strategy.get(order.strategy_id)
        if current is None or _parse_order_time(order.created_at) >= _parse_order_time(current.created_at):
            latest_by_strategy[order.strategy_id] = order

    for strategy_id, order in latest_by_strategy.items():
        if "reject" not in order.status.lower():
            clear_strategy_exchange_rejected_alerts(
                strategy_id,
                resolution_detail="最新真实策略委托已不再处于拒单状态，异常提醒已收起。",
            )
            continue
        strategy = strategies_by_id.get(strategy_id)
        strategy_name = strategy.name if strategy is not None else strategy_id
        issue_mode = strategy.mode if strategy is not None else fallback_mode
        changed = False
        with repo._lock:  # type: ignore[attr-defined]
            changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=f"strategy-exchange-rejected:{strategy_id}:{order.order_id}",
                severity="P1",
                symbol=order.symbol,
                title=f"{order.symbol} 策略真实委托被拒绝",
                description=(
                    f"{strategy_name} 最近一笔真实策略委托被交易所拒绝。"
                    f"委托参数 {order.qty}@{order.price}，状态 {order.status}。"
                ),
                suggested_action="打开策略页、交易记录和账户页复核真实仓位、委托参数与模式配置。",
                strategy_id=strategy_id,
            )
            if changed:
                queue_strategy_issue_review_locked(
                    strategy_id=strategy_id,
                    strategy_name=strategy_name,
                    symbol=order.symbol,
                    mode=issue_mode,
                    issue_type="exchange_order_rejected",
                    summary=f"{order.symbol} 策略真实委托被拒绝",
                    detail=f"委托参数 {order.qty}@{order.price}，状态 {order.status}。",
                    rule_key=f"strategy-exchange-rejected:{strategy_id}:{order.order_id}",
                )
                repo._refresh_derived_state()  # type: ignore[attr-defined]
                repo._persist()  # type: ignore[attr-defined]


def sync_strategy_exchange_rejection_guards(
    current_items: List[StrategyRuntimeSnapshot],
    *,
    repo: Any,
    parameter_resolver_module: Any,
    non_running_strategy_statuses: FrozenSet[str],
    clear_strategy_exchange_rejection_guard_alerts: Callable[..., bool],
    queue_strategy_issue_review_locked: Callable[..., None],
) -> None:
    state = repo.snapshot()
    strategies_by_id = {item.id: item for item in state.strategies}
    for snapshot in current_items:
        strategy = strategies_by_id.get(snapshot.strategy_id)
        if strategy is None:
            continue
        remaining = strategy_exchange_rejection_guard_remaining_minutes(
            strategy,
            repo=repo,
            non_running_strategy_statuses=non_running_strategy_statuses,
        )
        if remaining is None:
            clear_strategy_exchange_rejection_guard_alerts(
                snapshot.strategy_id,
                resolution_detail="连续拒单熔断已结束，真实策略自动执行可在人工确认后恢复。",
            )
            continue
        rejection_count = strategy_exchange_rejection_recent_count(strategy, repo=repo)
        detail = (
            f"最近 {strategy_exchange_rejection_guard_window_minutes(strategy)} 分钟真实策略委托已连续拒绝 "
            f"{rejection_count} 次，自动执行冷却剩余约 {remaining} 分钟。"
        )
        with repo._lock:  # type: ignore[attr-defined]
            changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=f"strategy-exchange-rejection-guard:{snapshot.strategy_id}:{snapshot.mode.value}",
                severity="P1",
                symbol=snapshot.symbol,
                title=f"{snapshot.symbol} 策略连续拒单已熔断",
                description=f"{snapshot.strategy_name} 当前已进入连续拒单冷却期。{detail}",
                suggested_action="先复核交易所模式、仓位、委托参数和最小下单约束，确认后再恢复自动执行。",
                strategy_id=snapshot.strategy_id,
            )
            if changed:
                queue_strategy_issue_review_locked(
                    strategy_id=snapshot.strategy_id,
                    strategy_name=snapshot.strategy_name,
                    symbol=snapshot.symbol,
                    mode=snapshot.mode,
                    issue_type="exchange_rejection_guard",
                    summary=f"{snapshot.symbol} 策略连续拒单已熔断",
                    detail=detail,
                    rule_key=f"strategy-exchange-rejection-guard:{snapshot.strategy_id}:{snapshot.mode.value}",
                )
                repo.add_event(
                    event_type="strategy.exchange_order.rejection_guard.alerted",
                    source="quant-core",
                    severity=EventSeverity.WARNING,
                    payload={
                        "strategy_id": snapshot.strategy_id,
                        "strategy_name": snapshot.strategy_name,
                        "symbol": snapshot.symbol,
                        "mode": snapshot.mode.value,
                        "rejection_count": rejection_count,
                        "window_minutes": strategy_exchange_rejection_guard_window_minutes(strategy),
                        "cooldown_remaining_minutes": remaining,
                        "detail": detail,
                    },
                    symbol=snapshot.symbol,
                    strategy_id=snapshot.strategy_id,
                    parameter_snapshot=parameter_resolver_module.snapshot_parameters(strategy),
                )
                repo._refresh_derived_state()  # type: ignore[attr-defined]
                repo._persist()  # type: ignore[attr-defined]


def sync_strategy_stale_order_issues(
    current_items: List[StrategyRuntimeSnapshot],
    *,
    repo: Any,
    parameter_resolver_module: Any,
    build_strategy_active_order_summary: Callable[..., Tuple[int, Optional[OrderRecord]]],
    clear_strategy_stale_order_alerts: Callable[..., bool],
    queue_strategy_issue_review_locked: Callable[..., None],
) -> None:
    state = repo.snapshot()
    strategies_by_id = {item.id: item for item in state.strategies}
    for snapshot in current_items:
        strategy = strategies_by_id.get(snapshot.strategy_id)
        if strategy is None:
            continue
        active_order_count, active_order = build_strategy_active_order_summary(
            snapshot.strategy_id,
            snapshot.mode,
            snapshot.symbol,
            snapshot.market,
        )
        if (
            snapshot.mode == AccountMode.PAPER
            or snapshot.runtime_status != "running"
            or active_order_count == 0
            or active_order is None
            or not is_strategy_active_order_stale(strategy, active_order)
        ):
            clear_strategy_stale_order_alerts(
                snapshot.strategy_id,
                resolution_detail="当前已不再存在长时间未处理的策略挂单，停滞提醒已收起。",
            )
            continue

        stale_age_minutes = strategy_active_order_stale_age_minutes(active_order)
        detail = (
            f"当前真实策略委托已挂单约 {stale_age_minutes} 分钟仍未成交或撤单，"
            f"超过 { strategy_exchange_order_stale_minutes(strategy) } 分钟阈值。"
        )
        with repo._lock:  # type: ignore[attr-defined]
            changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=f"strategy-stale-order:{snapshot.strategy_id}:{active_order.order_id}",
                severity="P1",
                symbol=snapshot.symbol,
                title=f"{snapshot.symbol} 策略挂单停滞",
                description=f"{snapshot.strategy_name} 当前存在长时间未处理的真实策略委托。{detail}",
                suggested_action="先复核委托价格是否偏离、交易所限制与市场状态；必要时改价、撤单或人工接管。",
                strategy_id=snapshot.strategy_id,
            )
            if changed:
                queue_strategy_issue_review_locked(
                    strategy_id=snapshot.strategy_id,
                    strategy_name=snapshot.strategy_name,
                    symbol=snapshot.symbol,
                    mode=snapshot.mode,
                    issue_type="stale_order",
                    summary=f"{snapshot.symbol} 策略挂单停滞",
                    detail=detail,
                    rule_key=f"strategy-stale-order:{snapshot.strategy_id}:{active_order.order_id}",
                )
                repo.add_event(
                    event_type="strategy.exchange_order.stale_alerted",
                    source="quant-core",
                    severity=EventSeverity.WARNING,
                    payload={
                        "strategy_id": snapshot.strategy_id,
                        "strategy_name": snapshot.strategy_name,
                        "symbol": snapshot.symbol,
                        "mode": snapshot.mode.value,
                        "order_id": active_order.order_id,
                        "stale_age_minutes": stale_age_minutes,
                        "threshold_minutes": strategy_exchange_order_stale_minutes(strategy),
                        "detail": detail,
                    },
                    symbol=snapshot.symbol,
                    strategy_id=snapshot.strategy_id,
                    parameter_snapshot=parameter_resolver_module.snapshot_parameters(strategy),
                )
                repo._refresh_derived_state()  # type: ignore[attr-defined]
                repo._persist()  # type: ignore[attr-defined]


def sync_strategy_position_drift_issues(
    current_items: List[StrategyRuntimeSnapshot],
    *,
    build_strategy_active_order_summary: Callable[..., Tuple[int, Optional[OrderRecord]]],
    build_strategy_position_alignment_summary: Callable[..., Tuple[str, Optional[str], str, Optional[str]]],
    sync_strategy_position_drift_issue: Callable[..., None],
) -> None:
    for snapshot in current_items:
        active_order_count, _active_order = build_strategy_active_order_summary(
            snapshot.strategy_id,
            snapshot.mode,
            snapshot.symbol,
            snapshot.market,
        )
        (
            target_position_side,
            target_position_size,
            position_alignment,
            position_alignment_detail,
        ) = build_strategy_position_alignment_summary(
            snapshot.strategy_id,
            snapshot.mode,
            snapshot.symbol,
            snapshot.market,
            active_order_count,
        )
        enriched = snapshot.model_copy(
            update={
                "target_position_side": target_position_side,
                "target_position_size": target_position_size,
                "position_alignment": position_alignment,
                "position_alignment_detail": position_alignment_detail,
            }
        )
        sync_strategy_position_drift_issue(enriched, active_order_count=active_order_count)


def apply_live_strategy_stop_loss_guards(
    current_items: List[StrategyRuntimeSnapshot],
    *,
    repo: Any,
    non_running_strategy_statuses: FrozenSet[str],
    parse_positions: Callable[..., List[PositionRecord]],
    parse_metric_number: Callable[[Any], float],
    clear_strategy_live_stop_loss_alerts: Callable[[str], bool],
    has_active_strategy_live_stop_loss_alert: Callable[[str], bool],
    cancel_strategy_exchange_orders: Callable[..., int],
    record_strategy_live_stop_loss_issue: Callable[..., None],
) -> None:
    state = repo.snapshot()
    strategies_by_id = {item.id: item for item in state.strategies}
    positions = parse_positions(use_private_only=True)
    positions_by_key = {(item.symbol, item.market): item for item in positions}

    for snapshot in current_items:
        strategy = strategies_by_id.get(snapshot.strategy_id)
        if strategy is None:
            continue
        if strategy.mode not in NON_PAPER_ACCOUNT_MODES:
            clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue
        if strategy.status in non_running_strategy_statuses or snapshot.runtime_status != "running":
            clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        stop_loss_pct = strategy_parameter_float(strategy, "stop_loss_pct")
        cooldown_remaining = strategy_live_stop_loss_cooldown_remaining_minutes(strategy, repo=repo)
        if stop_loss_pct is None or stop_loss_pct <= 0:
            if cooldown_remaining is not None:
                continue
            clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        position = positions_by_key.get((snapshot.symbol, snapshot.market))
        if position is None:
            if cooldown_remaining is not None:
                continue
            clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        current_qty = parse_metric_number(position.size) * (1 if position.side == "long" else -1)
        current_avg = parse_metric_number(position.avg_price)
        if abs(current_qty) <= 1e-9 or current_avg <= 0:
            if cooldown_remaining is not None:
                continue
            clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        stop_triggered = False
        if current_qty > 0 and snapshot.last_price <= current_avg * (1 - stop_loss_pct / 100):
            stop_triggered = True
        elif current_qty < 0 and snapshot.last_price >= current_avg * (1 + stop_loss_pct / 100):
            stop_triggered = True

        if not stop_triggered:
            if has_active_strategy_live_stop_loss_alert(snapshot.strategy_id) or cooldown_remaining is not None:
                continue
            clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        cancelled_count = cancel_strategy_exchange_orders(
            snapshot.strategy_id,
            snapshot.symbol,
            snapshot.market,
            strategy.mode,
            "strategy_runtime_worker",
            "当前参考价已触发真实模式止损保护，自动撤销旧策略委托并暂停后台自动执行。",
        )
        record_strategy_live_stop_loss_issue(
            strategy,
            snapshot,
            position,
            stop_loss_pct=stop_loss_pct,
            cancelled_count=cancelled_count,
        )
