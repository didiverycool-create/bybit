"""Execution-health helpers extracted from ``main.py``.

These helpers were previously defined inline in ``services/control-api/main.py``.
They were moved here to keep ``main.py`` easier to navigate while preserving the
original behaviour.  Because the original implementations relied on several
module-level globals (``market_data``, ``private_realtime``, a number of small
helper functions, etc.), every callable in this module accepts those
collaborators as explicit parameters.  ``main.py`` wraps each function so the
public call sites stay unchanged.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional


def public_channel_for_market(market: str) -> str:
    """Return the Bybit public realtime channel name for a market."""

    return "spot" if market == "spot" else "linear"


def build_public_execution_channel_health(
    market: str,
    symbol: str,
    *,
    realtime: Any,
    realtime_status_builder: Callable[[], Dict[str, Any]],
    rest_probe_fn: Callable[[], Dict[str, Optional[object]]],
    recommended_action_builder: Callable[..., str],
    stale_threshold_seconds: int,
    rest_probe: Optional[Dict[str, Optional[object]]] = None,
) -> Dict[str, Any]:
    """Return the execution-channel health summary for a given market/symbol."""

    if realtime is None or not hasattr(realtime, "get_status"):
        return {
            "enabled": False,
            "connected": False,
            "stale": False,
            "stale_seconds": 0,
            "has_symbol_feed": False,
            "issue": None,
            "recommended_action": None,
            "channel": public_channel_for_market(market),
            "symbol": symbol.upper(),
            "rest_reachable": None,
            "rest_last_error": None,
            "rest_tested_at": None,
        }

    realtime_status = realtime_status_builder()
    channel = public_channel_for_market(market)
    symbol_upper = symbol.upper()
    connected = bool(realtime_status.get(f"connected_{channel}"))
    enabled = bool(realtime_status.get("enabled", True))
    last_error = str(realtime_status.get("last_error") or "").strip() or None
    has_symbol_feed = (
        bool(realtime.has_ticker(symbol_upper, market=market))
        if hasattr(realtime, "has_ticker")
        else False
    )
    raw_symbol_last_message_at = (
        realtime.get_symbol_last_message_at(symbol_upper, market=market)
        if hasattr(realtime, "get_symbol_last_message_at")
        else None
    )
    stale_seconds = 0
    stale = False
    if raw_symbol_last_message_at:
        try:
            last_message_at = datetime.fromisoformat(str(raw_symbol_last_message_at))
            stale_seconds = max(
                int((datetime.now(timezone.utc).astimezone() - last_message_at).total_seconds()),
                0,
            )
            stale = stale_seconds >= stale_threshold_seconds
        except ValueError:
            stale_seconds = 0
            stale = False
    elif has_symbol_feed:
        stale = bool(realtime_status.get(f"{channel}_stale"))
        stale_seconds = int(realtime_status.get(f"{channel}_stale_seconds") or 0)

    issue: Optional[str] = None
    if not enabled:
        issue = "当前 Bybit 公共 WS 未启用，无法安全执行真实策略委托，请先恢复公共实时链路。"
    elif not connected:
        issue = (
            f"当前 Bybit 公共 WS ({channel}) 未连通，无法安全执行真实策略委托，请先恢复公共实时链路。"
        )
    elif not has_symbol_feed:
        issue = (
            f"当前 Bybit 公共 WS 尚未收到 {symbol_upper} 的实时行情，"
            "无法安全执行真实策略委托，请先恢复公共实时链路。"
        )
    elif stale:
        issue = (
            f"当前 Bybit 公共 WS 已超过约 {stale_seconds} 秒未收到 {symbol_upper} 的实时行情，"
            "无法安全执行真实策略委托，请先恢复公共实时链路。"
        )
    if issue is not None and last_error:
        issue = f"{issue} 最近错误：{last_error}"
    resolved_rest_probe = rest_probe or (rest_probe_fn() if issue is not None else {})
    recommended_action = (
        recommended_action_builder(
            issue,
            last_error=last_error,
            rest_reachable=resolved_rest_probe.get("reachable") if resolved_rest_probe else None,
        )
        if issue is not None
        else None
    )

    return {
        "enabled": enabled,
        "connected": connected,
        "stale": stale,
        "stale_seconds": stale_seconds,
        "has_symbol_feed": has_symbol_feed,
        "last_message_at": raw_symbol_last_message_at,
        "last_error": last_error,
        "issue": issue,
        "recommended_action": recommended_action,
        "channel": channel,
        "symbol": symbol_upper,
        "rest_reachable": resolved_rest_probe.get("reachable") if resolved_rest_probe else None,
        "rest_last_error": resolved_rest_probe.get("last_error") if resolved_rest_probe else None,
        "rest_tested_at": resolved_rest_probe.get("tested_at") if resolved_rest_probe else None,
    }


def get_public_execution_channel_issue(
    market: str,
    symbol: str,
    *,
    build_channel_health: Callable[..., Dict[str, Any]],
) -> Optional[str]:
    """Return the top-level public execution-channel issue for a market/symbol."""

    return build_channel_health(market, symbol).get("issue")


def build_execution_health_top_issue_context(
    state: Any,
    runtime_health: Dict[str, Any],
    dynamic_auto_dispatch_blocked_contexts: Optional[List[Dict[str, Optional[str]]]] = None,
    *,
    account_mode_cls: Any,
    has_active_strategy_live_stop_loss_alert: Callable[[str], bool],
    strategy_live_stop_loss_cooldown_remaining_minutes: Callable[[Any], Optional[int]],
    strategy_exchange_rejection_guard_remaining_minutes: Callable[[Any], Optional[int]],
    has_active_strategy_stale_order_alert: Callable[[str], bool],
    has_active_strategy_auto_dispatch_alert: Callable[[str], bool],
    find_latest_active_system_alert_by_prefix: Callable[[Any, str], Any],
    resolve_auto_dispatch_top_issue_recommended_action: Callable[[Any, Any, Any], Optional[str]],
    build_execution_issue_strategy_context: Callable[..., Dict[str, Optional[str]]],
    resolve_strategy_primary_market: Callable[[Any, Any], str],
    build_public_channel_health: Callable[..., Dict[str, Any]],
    collect_dynamic_auto_dispatch_blocked_contexts: Callable[[Any], List[Dict[str, Optional[str]]]],
    build_strategy_active_order_summary: Callable[..., Any],
    build_strategy_position_alignment_summary: Callable[..., Any],
    get_private_execution_channel_issue: Callable[[Any], Optional[str]],
    build_private_execution_channel_recommended_action: Callable[..., str],
    private_realtime: Any,
) -> Dict[str, Optional[str]]:
    """Compute the top execution-health issue context for the dashboard."""

    if runtime_health["runtime_last_error"]:
        return {
            "top_issue_strategy_id": None,
            "top_issue_strategy_name": None,
            "top_issue_symbol": None,
            "top_issue_detail": f"后台策略运行线程最近一次报错：{runtime_health['runtime_last_error']}",
            "top_issue_recommended_action": "打开设置页点击“恢复运行线程”，并检查最近审计日志。",
        }
    if runtime_health["runtime_worker_stale"]:
        return {
            "top_issue_strategy_id": None,
            "top_issue_strategy_name": None,
            "top_issue_symbol": None,
            "top_issue_detail": f"后台策略运行线程最近约 {runtime_health['runtime_stale_seconds']} 秒未成功刷新。",
            "top_issue_recommended_action": "打开设置页点击“恢复运行线程”，并确认行情链路与最新信号。",
        }
    selected_mode = state.workspace_preferences.selected_mode
    real_execution_modes: set = set()
    for strategy in state.strategies:
        if has_active_strategy_live_stop_loss_alert(strategy.id):
            return build_execution_issue_strategy_context(
                state,
                strategy.id,
                alert_prefix=f"strategy-live-stop-loss:{strategy.id}:",
            )

    for strategy in state.strategies:
        if strategy.mode not in {account_mode_cls.DEMO, account_mode_cls.LIVE} or strategy.status != "running":
            continue
        market = resolve_strategy_primary_market(state, strategy)
        symbol = strategy.symbols[0] if strategy.symbols else None
        if not symbol:
            continue
        public_health = build_public_channel_health(market, symbol)
        public_issue = public_health.get("issue")
        if public_issue is not None:
            return build_execution_issue_strategy_context(
                state,
                strategy.id,
                symbol=symbol,
                detail=public_issue,
                recommended_action=public_health.get("recommended_action"),
            )

    for strategy in state.strategies:
        remaining = strategy_live_stop_loss_cooldown_remaining_minutes(strategy)
        if remaining is not None:
            return build_execution_issue_strategy_context(
                state,
                strategy.id,
                symbol=strategy.symbols[0] if strategy.symbols else None,
                detail=f"{strategy.name} 当前处于真实模式止损后冷却期，剩余约 {remaining} 分钟。",
                recommended_action="冷却结束前不再恢复自动执行；请先人工复核真实仓位和策略参数。",
            )

    for strategy in state.strategies:
        remaining = strategy_exchange_rejection_guard_remaining_minutes(strategy)
        if remaining is not None:
            return build_execution_issue_strategy_context(
                state,
                strategy.id,
                alert_prefix=f"strategy-exchange-rejection-guard:{strategy.id}:",
                detail=f"{strategy.name} 最近真实策略委托连续拒绝，自动执行冷却剩余约 {remaining} 分钟。",
            )

    for strategy in state.strategies:
        if has_active_strategy_stale_order_alert(strategy.id):
            return build_execution_issue_strategy_context(
                state,
                strategy.id,
                alert_prefix=f"strategy-stale-order:{strategy.id}:",
            )

    for strategy in state.strategies:
        if has_active_strategy_auto_dispatch_alert(strategy.id):
            alert_prefix = f"strategy-auto-dispatch:{strategy.id}:"
            alert = find_latest_active_system_alert_by_prefix(state, alert_prefix)
            return build_execution_issue_strategy_context(
                state,
                strategy.id,
                alert_prefix=alert_prefix,
                recommended_action=resolve_auto_dispatch_top_issue_recommended_action(state, strategy, alert),
            )

    blocked_contexts = (
        dynamic_auto_dispatch_blocked_contexts
        if dynamic_auto_dispatch_blocked_contexts is not None
        else collect_dynamic_auto_dispatch_blocked_contexts(state)
    )
    for blocked_context in blocked_contexts:
        return blocked_context

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
            position_alignment_detail,
        ) = build_strategy_position_alignment_summary(
            runtime_snapshot.strategy_id,
            runtime_snapshot.mode,
            runtime_snapshot.symbol,
            runtime_snapshot.market,
            active_order_count,
        )
        if position_alignment == "drifted":
            return build_execution_issue_strategy_context(
                state,
                runtime_snapshot.strategy_id,
                symbol=runtime_snapshot.symbol,
                detail=position_alignment_detail,
                alert_prefix=f"strategy-position-drift:{runtime_snapshot.strategy_id}:",
            )

    if runtime_health.get("runtime_worker_stopped"):
        last_refresh = runtime_health.get("runtime_last_refresh_at")
        return {
            "top_issue_strategy_id": None,
            "top_issue_strategy_name": None,
            "top_issue_symbol": None,
            "top_issue_detail": (
                f"后台策略运行线程当前未运行，最近一次成功刷新：{last_refresh}"
                if last_refresh
                else "后台策略运行线程当前未运行。"
            ),
            "top_issue_recommended_action": "打开设置页点击“恢复运行线程”，让后台自动执行链恢复。",
        }

    selected_mode = state.workspace_preferences.selected_mode
    real_execution_modes = set()
    if selected_mode in {account_mode_cls.DEMO, account_mode_cls.LIVE}:
        real_execution_modes.add(selected_mode)
    for strategy in state.strategies:
        if strategy.mode in {account_mode_cls.DEMO, account_mode_cls.LIVE} and strategy.status == "running":
            real_execution_modes.add(strategy.mode)
    for mode in real_execution_modes:
        private_issue = get_private_execution_channel_issue(mode)
        if private_issue is not None:
            private_last_error = (
                str(private_realtime.get_status().get("last_error") or "").strip() or None
            )
            return {
                "top_issue_strategy_id": None,
                "top_issue_strategy_name": None,
                "top_issue_symbol": None,
                "top_issue_detail": private_issue,
                "top_issue_recommended_action": build_private_execution_channel_recommended_action(
                    private_issue,
                    last_error=private_last_error,
                ),
            }

    return {
        "top_issue_strategy_id": None,
        "top_issue_strategy_name": None,
        "top_issue_symbol": None,
        "top_issue_detail": None,
        "top_issue_recommended_action": None,
    }


def merge_execution_health_review_risks(
    risks: List[str],
    context: Optional[Dict[str, Any]] = None,
    *,
    derive_review_health_context_from_context: Callable[..., Dict[str, Any]],
    build_review_health_context: Callable[[], Dict[str, Any]],
) -> List[str]:
    """Merge execution-health risks into a review-risk list (dedup aware)."""

    merged = [str(item).strip() for item in risks if str(item).strip()]
    review_health_context = (
        derive_review_health_context_from_context(context, include_strategy_activity=False)
        if context is not None
        else build_review_health_context()
    )
    execution_top_issue = str(review_health_context.get("execution_top_issue") or "").strip()
    execution_top_issue_detail = str(review_health_context.get("execution_top_issue_detail") or "").strip()
    execution_top_issue_recommended_action = str(
        review_health_context.get("execution_top_issue_recommended_action") or ""
    ).strip()
    runtime_worker_top_issue = str(review_health_context.get("runtime_worker_top_issue") or "").strip()
    runtime_worker_detail = str(review_health_context.get("runtime_worker_detail") or "").strip()
    runtime_worker_recommended_action = str(
        review_health_context.get("runtime_worker_recommended_action") or ""
    ).strip()

    def build_risk_entry(prefix: str, issue: str, detail: str = "", recommended_action: str = "") -> Optional[str]:
        if not issue:
            return None
        sentences = [f"{prefix}：{issue.rstrip('。')}。"]
        if detail and detail not in issue:
            sentences.append(f"{detail.rstrip('。')}。")
        if recommended_action and recommended_action not in detail:
            sentences.append(f"建议：{recommended_action.rstrip('。')}。")
        return " ".join(sentences)

    def has_complete_risk_entry(issue: str, detail: str = "", recommended_action: str = "") -> bool:
        if not issue:
            return False
        return any(
            issue in item
            and (not detail or detail in item)
            and (not recommended_action or recommended_action in item)
            for item in merged
        )

    execution_risk_entry = build_risk_entry(
        "执行健康提示",
        execution_top_issue,
        execution_top_issue_detail,
        execution_top_issue_recommended_action,
    )
    if execution_risk_entry and not has_complete_risk_entry(
        execution_top_issue,
        execution_top_issue_detail,
        execution_top_issue_recommended_action,
    ):
        merged.append(execution_risk_entry)
    if (
        runtime_worker_top_issue
        and runtime_worker_top_issue != execution_top_issue
        and not has_complete_risk_entry(
            runtime_worker_top_issue,
            runtime_worker_detail,
            runtime_worker_recommended_action,
        )
    ):
        runtime_risk_entry = build_risk_entry(
            "运行线程提示",
            runtime_worker_top_issue,
            detail=runtime_worker_detail,
            recommended_action=runtime_worker_recommended_action,
        )
        if runtime_risk_entry:
            merged.append(runtime_risk_entry)

    return merged[:4]
