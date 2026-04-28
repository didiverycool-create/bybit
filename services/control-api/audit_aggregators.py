"""Audit-event / scheduler-command aggregation helpers extracted from ``main.py``.

``_build_scheduler_command_impact_detail``, ``_build_latest_scheduler_command``
and ``_build_control_snapshot_response`` previously lived inline in
``services/control-api/main.py``.  They are pure aggregators that stitch
together state snapshots and helper outputs into the response models served by
``GET /api/control/snapshot`` (and the SSE / scheduler / agent live endpoints
that share the same enriched ``ControlSnapshot``).

Following the same pattern as :mod:`alert_and_guard_sync`, this module exposes
pure functions that accept their collaborators as explicit arguments.
``main.py`` keeps thin wrappers with the original names so every existing call
site stays untouched.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from models import (
    AccountMode,
    ControlSnapshot,
    ExecutionEvent,
    ExecutionHealthSummary,
    LatestSchedulerCommand,
    NON_PAPER_ACCOUNT_MODES,
    SchedulerCommandType,
)
from repository import AppRepository


def build_scheduler_command_impact_detail(payload: Dict[str, Any]) -> Optional[str]:
    return AppRepository._build_audit_event_impact_detail(payload)


def build_latest_scheduler_command(
    audit_events: List[ExecutionEvent],
    *,
    non_empty_string: Callable[[Any], Optional[str]],
    non_empty_string_list: Callable[[Any], List[str]],
    single_or_none: Callable[[List[str]], Optional[str]],
) -> Optional[LatestSchedulerCommand]:
    event = next((item for item in audit_events if item.event_type == "scheduler.command"), None)
    if event is None:
        return None
    payload = event.payload if isinstance(event.payload, dict) else {}
    command_text = non_empty_string(payload.get("command"))
    command = None
    if command_text:
        try:
            command = SchedulerCommandType(command_text)
        except ValueError:
            command = None
    return LatestSchedulerCommand(
        command=command,
        summary=non_empty_string(payload.get("summary")) or f"已执行调度命令：{command_text or 'unknown'}",
        impact_detail=build_scheduler_command_impact_detail(payload),
        job_id=non_empty_string(payload.get("retry_job_id")) or non_empty_string(payload.get("job_id")),
        strategy_id=non_empty_string(payload.get("strategy_id"))
        or single_or_none(non_empty_string_list(payload.get("cancelled_strategy_ids"))),
        linked_review_id=non_empty_string(payload.get("linked_review_id")) or non_empty_string(payload.get("review_id")),
        backtest_id=non_empty_string(payload.get("backtest_id"))
        or single_or_none(non_empty_string_list(payload.get("cancelled_backtest_ids"))),
        source_change_request_id=non_empty_string(payload.get("source_change_request_id"))
        or single_or_none(non_empty_string_list(payload.get("cancelled_source_change_request_ids"))),
        source_backtest_id=non_empty_string(payload.get("source_backtest_id"))
        or single_or_none(non_empty_string_list(payload.get("cancelled_source_backtest_ids"))),
        source_review_id=non_empty_string(payload.get("source_review_id"))
        or single_or_none(non_empty_string_list(payload.get("cancelled_source_review_ids"))),
        source_proposal_id=non_empty_string(payload.get("source_proposal_id"))
        or single_or_none(non_empty_string_list(payload.get("cancelled_source_proposal_ids"))),
        occurred_at=event.occurred_at,
        severity=event.severity,
    )


def build_control_snapshot_response(
    *,
    repo: Any,
    build_strategy_runtime_worker_health: Callable[[], Dict[str, Any]],
    collect_dynamic_auto_dispatch_blocked_contexts: Callable[[Any], List[Dict[str, Optional[str]]]],
    resolve_strategy_primary_market: Callable[[Any, Any], str],
    build_public_execution_channel_health: Callable[[str, str], Dict[str, Any]],
    get_private_execution_channel_issue: Callable[[AccountMode], Optional[str]],
    build_private_realtime_health: Callable[[], Dict[str, Any]],
    has_active_strategy_live_stop_loss_alert: Callable[[str], bool],
    strategy_live_stop_loss_cooldown_remaining_minutes: Callable[[Any], Optional[int]],
    has_active_strategy_auto_dispatch_alert: Callable[[str], bool],
    strategy_exchange_rejection_guard_remaining_minutes: Callable[[Any], Optional[int]],
    has_active_strategy_stale_order_alert: Callable[[str], bool],
    build_strategy_active_order_summary: Callable[..., Any],
    build_strategy_position_alignment_summary: Callable[..., Any],
    build_execution_health_top_issue_context: Callable[..., Dict[str, Any]],
    build_latest_scheduler_command: Callable[[List[ExecutionEvent]], Optional[LatestSchedulerCommand]],
) -> ControlSnapshot:
    state = repo.snapshot()
    snapshot = state.control_snapshot
    runtime_health = build_strategy_runtime_worker_health()
    dynamic_auto_dispatch_blocked_contexts = collect_dynamic_auto_dispatch_blocked_contexts(state)
    dynamic_auto_dispatch_blocked_strategy_ids = {
        str(item.get("top_issue_strategy_id") or "") for item in dynamic_auto_dispatch_blocked_contexts if item.get("top_issue_strategy_id")
    }
    selected_mode = state.workspace_preferences.selected_mode
    strategies_by_id = {item.id: item for item in state.strategies}
    real_execution_modes: set[AccountMode] = set()
    if selected_mode in NON_PAPER_ACCOUNT_MODES:
        real_execution_modes.add(selected_mode)
    for strategy in state.strategies:
        if strategy.mode in NON_PAPER_ACCOUNT_MODES and strategy.status == "running":
            real_execution_modes.add(strategy.mode)
    public_execution_issue_detail = None
    public_execution_stale = False
    public_execution_stale_seconds = 0
    for strategy in state.strategies:
        if strategy.status != "running" or strategy.mode not in NON_PAPER_ACCOUNT_MODES:
            continue
        symbol = strategy.symbols[0] if strategy.symbols else None
        if not symbol:
            continue
        market = resolve_strategy_primary_market(state, strategy)
        public_health = build_public_execution_channel_health(market, symbol)
        issue = public_health.get("issue")
        if issue is None:
            continue
        public_execution_issue_detail = str(issue)
        public_execution_stale = bool(public_health.get("stale"))
        public_execution_stale_seconds = int(public_health.get("stale_seconds") or 0)
        break
    public_execution_channel_issue = public_execution_issue_detail is not None
    private_execution_issue_detail = None
    for mode in real_execution_modes:
        private_execution_issue_detail = get_private_execution_channel_issue(mode)
        if private_execution_issue_detail is not None:
            break
    private_execution_channel_issue = private_execution_issue_detail is not None
    private_realtime_health = build_private_realtime_health() if real_execution_modes else {"stale": False, "stale_seconds": 0}
    private_execution_stale = bool(private_realtime_health.get("stale")) if private_execution_channel_issue else False
    private_execution_stale_seconds = (
        int(private_realtime_health.get("stale_seconds") or 0) if private_execution_stale else 0
    )
    runtime_worker_running = bool(runtime_health["runtime_worker_running"])
    runtime_last_refresh_at = runtime_health["runtime_last_refresh_at"]
    runtime_last_error = runtime_health["runtime_last_error"]
    runtime_stale_seconds = int(runtime_health["runtime_stale_seconds"])
    runtime_worker_stale = bool(runtime_health["runtime_worker_stale"])
    runtime_worker_stopped = bool(runtime_health["runtime_worker_stopped"])
    runtime_worker_issue = bool(runtime_health["runtime_worker_issue"])
    active_guard_count = sum(1 for strategy in state.strategies if has_active_strategy_live_stop_loss_alert(strategy.id))
    cooldown_count = sum(
        1 for strategy in state.strategies if strategy_live_stop_loss_cooldown_remaining_minutes(strategy) is not None
    )
    auto_dispatch_blocked_strategy_ids = {
        strategy.id for strategy in state.strategies if has_active_strategy_auto_dispatch_alert(strategy.id)
    } | dynamic_auto_dispatch_blocked_strategy_ids
    auto_dispatch_blocked_count = len(auto_dispatch_blocked_strategy_ids)
    rejection_guard_count = sum(
        1 for strategy in state.strategies if strategy_exchange_rejection_guard_remaining_minutes(strategy) is not None
    )
    stale_order_count = sum(1 for strategy in state.strategies if has_active_strategy_stale_order_alert(strategy.id))
    drift_count = 0
    for runtime_snapshot in state.strategy_runtime_snapshots:
        active_order_count, _active_order = build_strategy_active_order_summary(
            runtime_snapshot.strategy_id,
            runtime_snapshot.mode,
            runtime_snapshot.symbol,
            runtime_snapshot.market,
        )
        (
            _target_position_side,
            _target_position_size,
            position_alignment,
            _position_alignment_detail,
        ) = build_strategy_position_alignment_summary(
            runtime_snapshot.strategy_id,
            runtime_snapshot.mode,
            runtime_snapshot.symbol,
            runtime_snapshot.market,
            active_order_count,
        )
        if position_alignment == "drifted":
            drift_count += 1
    strategy_metrics = list(snapshot.strategy_metrics)
    if len(strategy_metrics) >= 1:
        primary_delta = None
        if runtime_last_error:
            primary_delta = "运行线程异常"
        elif runtime_worker_stale:
            primary_delta = "运行线程停滞"
        elif runtime_worker_stopped:
            primary_delta = "运行线程未运行"
        elif public_execution_channel_issue:
            primary_delta = "公有链路失活" if public_execution_stale else "公有链路异常"
        elif private_execution_channel_issue:
            primary_delta = "私有链路失活" if private_execution_stale else "私有链路异常"
        elif active_guard_count:
            primary_delta = f"止损保护 {active_guard_count}"
        elif rejection_guard_count:
            primary_delta = f"连续拒单 {rejection_guard_count}"
        elif stale_order_count:
            primary_delta = f"挂单停滞 {stale_order_count}"
        elif auto_dispatch_blocked_count:
            primary_delta = f"执行受阻 {auto_dispatch_blocked_count}"
        elif drift_count:
            primary_delta = f"偏离 {drift_count}"
        elif cooldown_count:
            primary_delta = f"冷却中 {cooldown_count}"
        strategy_metrics[0] = strategy_metrics[0].model_copy(
            update={
                "delta": primary_delta,
                "tone": (
                    "critical"
                    if runtime_last_error
                    or runtime_worker_stale
                    or public_execution_channel_issue
                    or private_execution_channel_issue
                    or active_guard_count
                    or rejection_guard_count
                    or (
                        runtime_worker_stopped
                        and not stale_order_count
                        and not auto_dispatch_blocked_count
                        and not drift_count
                        and not cooldown_count
                    )
                    else ("warning" if stale_order_count or auto_dispatch_blocked_count else "positive")
                ),
            }
        )
    if len(strategy_metrics) >= 3:
        strategy_metrics[2] = strategy_metrics[2].model_copy(
            update={
                "delta": f"冷却中 {cooldown_count}" if cooldown_count else None,
                "tone": "critical" if cooldown_count else "warning",
            }
        )
    if len(strategy_metrics) >= 2:
        strategy_metrics[1] = strategy_metrics[1].model_copy(
            update={
                "delta": f"偏离 {drift_count}" if drift_count else None,
                "tone": "warning" if drift_count else strategy_metrics[1].tone,
            }
        )
    top_issue = None
    if runtime_last_error:
        top_issue = "运行线程异常"
    elif runtime_worker_stale:
        top_issue = "运行线程停滞"
    elif runtime_worker_stopped:
        top_issue = "运行线程未运行"
    elif public_execution_channel_issue:
        top_issue = "公有链路失活" if public_execution_stale else "公有链路异常"
    elif private_execution_channel_issue:
        top_issue = "私有链路失活" if private_execution_stale else "私有链路异常"
    elif active_guard_count:
        top_issue = f"止损保护 {active_guard_count}"
    elif rejection_guard_count:
        top_issue = f"连续拒单 {rejection_guard_count}"
    elif stale_order_count:
        top_issue = f"挂单停滞 {stale_order_count}"
    elif auto_dispatch_blocked_count:
        top_issue = f"执行受阻 {auto_dispatch_blocked_count}"
    elif drift_count:
        top_issue = f"仓位偏离 {drift_count}"
    elif cooldown_count:
        top_issue = f"冷却中 {cooldown_count}"
    top_issue_context = build_execution_health_top_issue_context(
        state,
        runtime_health,
        dynamic_auto_dispatch_blocked_contexts,
    )
    execution_health = ExecutionHealthSummary(
        runtime_worker_running=runtime_worker_running,
        runtime_worker_issue=runtime_worker_issue,
        runtime_worker_stale=runtime_worker_stale,
        runtime_worker_stopped=runtime_worker_stopped,
        runtime_stale_seconds=runtime_stale_seconds,
        runtime_last_refresh_at=runtime_last_refresh_at,
        runtime_last_error=runtime_last_error,
        public_execution_channel_issue=public_execution_channel_issue,
        public_execution_stale=public_execution_stale,
        public_execution_stale_seconds=public_execution_stale_seconds,
        private_execution_channel_issue=private_execution_channel_issue,
        private_execution_stale=private_execution_stale,
        private_execution_stale_seconds=private_execution_stale_seconds,
        active_stop_loss_guards=active_guard_count,
        cooldowns=cooldown_count,
        auto_dispatch_blocked=auto_dispatch_blocked_count,
        rejection_guards=rejection_guard_count,
        stale_order_guards=stale_order_count,
        drifts=drift_count,
        top_issue=top_issue,
        top_issue_strategy_id=top_issue_context.get("top_issue_strategy_id"),
        top_issue_strategy_name=top_issue_context.get("top_issue_strategy_name"),
        top_issue_symbol=top_issue_context.get("top_issue_symbol"),
        top_issue_detail=top_issue_context.get("top_issue_detail"),
        top_issue_recommended_action=top_issue_context.get("top_issue_recommended_action"),
    )
    return snapshot.model_copy(
        update={
            "strategy_metrics": strategy_metrics,
            "execution_health": execution_health,
            "latest_scheduler_command": build_latest_scheduler_command(state.audit_events),
        }
    )
