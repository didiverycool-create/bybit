"""Alert and guard sync helpers extracted from ``main.py``.

``_sync_strategy_runtime_worker_issue_alerts``,
``_sync_public_execution_channel_alerts`` and
``_sync_private_execution_channel_alerts`` previously lived inline in
``services/control-api/main.py``.  Each depended on several module level
globals (``repo``, a handful of helper functions) which made the surface hard
to reason about.  Following the pattern established by ``execution_health.py``
and ``prometheus_metrics.py``, this module exposes pure functions that accept
their collaborators as explicit arguments.  ``main.py`` keeps thin wrappers
with the original names so every existing call site stays untouched.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple

import parameter_resolver
from models import AccountMode, EventSeverity, NON_PAPER_ACCOUNT_MODES


def sync_strategy_runtime_worker_issue_alerts(
    *,
    repo: Any,
    build_strategy_runtime_worker_health: Callable[[], Dict[str, Any]],
    clear_strategy_runtime_worker_alerts: Callable[..., bool],
) -> None:
    """Upsert/clear the background strategy runtime worker system alerts."""

    runtime_health = build_strategy_runtime_worker_health()
    runtime_worker_running = bool(runtime_health["runtime_worker_running"])
    runtime_last_error = runtime_health["runtime_last_error"]
    runtime_worker_stale = bool(runtime_health["runtime_worker_stale"])
    runtime_worker_stopped = bool(runtime_health["runtime_worker_stopped"])
    runtime_stale_seconds = int(runtime_health["runtime_stale_seconds"])
    runtime_last_refresh_at = runtime_health["runtime_last_refresh_at"]

    issue_rule_key = "strategy-runtime-worker:error"
    stale_rule_key = "strategy-runtime-worker:stale"
    stopped_rule_key = "strategy-runtime-worker:stopped"

    if runtime_last_error:
        description = f"后台策略运行线程最近一次刷新失败：{runtime_last_error}"
        suggested_action = "打开设置页点击“恢复运行线程”，并检查最近审计日志里的策略运行异常。"
        with repo._lock:  # type: ignore[attr-defined]
            existing = next(
                (
                    alert
                    for alert in repo.state.alerts  # type: ignore[attr-defined]
                    if not alert.acknowledged and str(getattr(alert, "rule_key", None) or "") == issue_rule_key
                ),
                None,
            )
            needs_upsert = existing is None or (
                existing.severity != "P0"
                or existing.symbol != "SYSTEM"
                or existing.title != "策略运行线程异常"
                or existing.description != description
                or existing.suggested_action != suggested_action
            )
            if needs_upsert:
                changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                    rule_key=issue_rule_key,
                    severity="P0",
                    symbol="SYSTEM",
                    title="策略运行线程异常",
                    description=description,
                    suggested_action=suggested_action,
                )
                if changed:
                    repo.add_event(
                        event_type="strategy.runtime.worker.issue_alerted",
                        source="quant-core",
                        severity=EventSeverity.ERROR,
                        payload={"detail": description},
                    )
                    repo._refresh_derived_state()  # type: ignore[attr-defined]
                    repo._persist()  # type: ignore[attr-defined]
    else:
        clear_strategy_runtime_worker_alerts(
            issue_rule_key,
            resolved_event_type="strategy.runtime.worker.issue_resolved",
            resolution_detail="后台策略运行线程异常已解除。",
        )

    if runtime_worker_stale:
        description = f"后台策略运行线程约 {runtime_stale_seconds} 秒未成功刷新，当前疑似停滞。"
        suggested_action = "打开设置页点击“恢复运行线程”，并检查行情链路与最近审计日志。"
        with repo._lock:  # type: ignore[attr-defined]
            existing = next(
                (
                    alert
                    for alert in repo.state.alerts  # type: ignore[attr-defined]
                    if not alert.acknowledged and str(getattr(alert, "rule_key", None) or "") == stale_rule_key
                ),
                None,
            )
            needs_upsert = existing is None or (
                existing.severity != "P1"
                or existing.symbol != "SYSTEM"
                or existing.title != "策略运行线程停滞"
                or existing.description != description
                or existing.suggested_action != suggested_action
            )
            if needs_upsert:
                changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                    rule_key=stale_rule_key,
                    severity="P1",
                    symbol="SYSTEM",
                    title="策略运行线程停滞",
                    description=description,
                    suggested_action=suggested_action,
                )
                if changed:
                    repo.add_event(
                        event_type="strategy.runtime.worker.stale_alerted",
                        source="quant-core",
                        severity=EventSeverity.WARNING,
                        payload={
                            "stale_seconds": runtime_stale_seconds,
                            "detail": description,
                        },
                    )
                    repo._refresh_derived_state()  # type: ignore[attr-defined]
                    repo._persist()  # type: ignore[attr-defined]
    else:
        clear_strategy_runtime_worker_alerts(
            stale_rule_key,
            resolved_event_type="strategy.runtime.worker.stale_resolved",
            resolution_detail="后台策略运行线程停滞状态已解除。",
        )

    if runtime_worker_stopped:
        description = f"后台策略运行线程当前未运行，最近一次成功刷新时间为 {runtime_last_refresh_at}。"
        suggested_action = "打开设置页点击“恢复运行线程”，并检查最近审计日志里的线程退出原因。"
        with repo._lock:  # type: ignore[attr-defined]
            existing = next(
                (
                    alert
                    for alert in repo.state.alerts  # type: ignore[attr-defined]
                    if not alert.acknowledged and str(getattr(alert, "rule_key", None) or "") == stopped_rule_key
                ),
                None,
            )
            needs_upsert = existing is None or (
                existing.severity != "P1"
                or existing.symbol != "SYSTEM"
                or existing.title != "策略运行线程未运行"
                or existing.description != description
                or existing.suggested_action != suggested_action
            )
            if needs_upsert:
                changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                    rule_key=stopped_rule_key,
                    severity="P1",
                    symbol="SYSTEM",
                    title="策略运行线程未运行",
                    description=description,
                    suggested_action=suggested_action,
                )
                if changed:
                    repo.add_event(
                        event_type="strategy.runtime.worker.stopped_alerted",
                        source="quant-core",
                        severity=EventSeverity.WARNING,
                        payload={"detail": description},
                    )
                    repo._refresh_derived_state()  # type: ignore[attr-defined]
                    repo._persist()  # type: ignore[attr-defined]
    else:
        clear_strategy_runtime_worker_alerts(
            stopped_rule_key,
            resolved_event_type="strategy.runtime.worker.stopped_resolved",
            resolution_detail=(
                "后台策略运行线程已恢复运行。"
                if runtime_worker_running
                else "后台策略运行线程未运行状态已解除。"
            ),
        )


def sync_public_execution_channel_alerts(
    *,
    repo: Any,
    resolve_strategy_primary_market: Callable[[Any, Any], str],
    build_public_execution_channel_health: Callable[[str, str], Dict[str, Any]],
    clear_public_execution_channel_alert: Callable[..., bool],
    queue_strategy_issue_review_locked: Callable[..., None],
) -> None:
    """Upsert/clear Bybit public execution channel alerts for running strategies."""

    state = repo.snapshot()
    active_rule_keys = set()
    for strategy in state.strategies:
        if strategy.mode not in NON_PAPER_ACCOUNT_MODES or strategy.status != "running":
            continue
        symbol = strategy.symbols[0] if strategy.symbols else None
        if not symbol:
            continue
        market = resolve_strategy_primary_market(state, strategy)
        public_health = build_public_execution_channel_health(market, symbol)
        issue = public_health.get("issue")
        rule_key = f"public-execution-channel:{strategy.id}:{strategy.mode.value}"
        active_rule_keys.add(rule_key)
        if issue is None:
            clear_public_execution_channel_alert(
                strategy.id,
                strategy.mode,
                resolution_detail=f"{strategy.name} 依赖的 Bybit 公有执行链路已恢复正常。",
            )
            continue
        title = f"{symbol} 公有执行链路异常"
        if "超过约" in issue:
            title = f"{symbol} 公有执行链路失活"
        with repo._lock:  # type: ignore[attr-defined]
            changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=rule_key,
                severity="P1",
                symbol=symbol,
                title=title,
                description=f"{strategy.name} 在 {strategy.mode.value.upper()} 真实执行依赖的 Bybit 公共 WS 异常。{issue}",
                suggested_action=public_health.get("recommended_action")
                or "先恢复 Bybit 公共实时链路并确认目标品种已持续收到最新行情，再恢复真实策略执行。",
                strategy_id=strategy.id,
            )
            if changed:
                queue_strategy_issue_review_locked(
                    strategy_id=strategy.id,
                    strategy_name=strategy.name,
                    symbol=symbol,
                    mode=strategy.mode,
                    issue_type="public_execution_channel",
                    summary=f"{symbol} 公有执行链路异常",
                    detail=issue,
                    rule_key=rule_key,
                )
                repo.add_event(
                    event_type="public.execution.channel.alerted",
                    source="quant-core",
                    severity=EventSeverity.WARNING,
                    payload={
                        "strategy_id": strategy.id,
                        "strategy_name": strategy.name,
                        "symbol": symbol,
                        "mode": strategy.mode.value,
                        "detail": issue,
                    },
                    symbol=symbol,
                    strategy_id=strategy.id,
                    parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
                )
                repo._refresh_derived_state()  # type: ignore[attr-defined]
                repo._persist()  # type: ignore[attr-defined]

    stale_alerts: List[Tuple[str, AccountMode]] = []
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = str(getattr(alert, "rule_key", None) or "")
            if not rule_key.startswith("public-execution-channel:"):
                continue
            if rule_key in active_rule_keys:
                continue
            parts = rule_key.split(":")
            if len(parts) != 3:
                continue
            mode_value = parts[2]
            try:
                stale_alerts.append((parts[1], AccountMode(mode_value)))
            except ValueError:
                continue
    for strategy_id, mode in stale_alerts:
        clear_public_execution_channel_alert(
            strategy_id,
            mode,
            resolution_detail="对应策略已停止真实执行，公有执行链路提醒已自动关闭。",
        )


def sync_private_execution_channel_alerts(
    *,
    repo: Any,
    get_private_execution_channel_issue: Callable[[AccountMode], Optional[str]],
    clear_private_execution_channel_alert: Callable[..., bool],
) -> None:
    """Upsert/clear Bybit private execution channel alerts for the active modes."""

    state = repo.snapshot()
    selected_mode = state.workspace_preferences.selected_mode
    real_execution_modes = set()
    if selected_mode in NON_PAPER_ACCOUNT_MODES:
        real_execution_modes.add(selected_mode)
    for strategy in state.strategies:
        if strategy.mode in NON_PAPER_ACCOUNT_MODES and strategy.status == "running":
            real_execution_modes.add(strategy.mode)

    for mode in (AccountMode.DEMO, AccountMode.LIVE):
        issue = get_private_execution_channel_issue(mode) if mode in real_execution_modes else None
        if issue is None:
            clear_private_execution_channel_alert(
                mode,
                resolution_detail=f"Bybit {mode.value.upper()} 私有执行链路已恢复正常。",
            )
            continue
        title = f"{mode.value.upper()} 私有执行链路异常"
        if "超过约" in issue:
            title = f"{mode.value.upper()} 私有执行链路失活"
        suggested_action = "检查程序侧私有 API 模式、Bybit 私有 WS 连通/鉴权状态，并确认最近仍在刷新。"
        rule_key = f"private-execution-channel:{mode.value}"
        with repo._lock:  # type: ignore[attr-defined]
            changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=rule_key,
                severity="P1",
                symbol="SYSTEM",
                title=title,
                description=issue,
                suggested_action=suggested_action,
            )
            if changed:
                repo.add_event(
                    event_type="private.execution.channel.alerted",
                    source="quant-core",
                    severity=EventSeverity.WARNING,
                    payload={
                        "mode": mode.value,
                        "detail": issue,
                    },
                )
                repo._refresh_derived_state()  # type: ignore[attr-defined]
                repo._persist()  # type: ignore[attr-defined]
