"""Strategy alert management helpers extracted from ``main.py``.

The cluster of ``_clear_strategy_*_alerts`` / ``_has_active_strategy_*_alert``
upserters together with the per-strategy ``_record_strategy_*_issue``
recorders, the typed ``_AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE`` /
``_RISK_SUB_BLOCK_TO_AUTO_DISPATCH_GATE_REASON`` cross-taxonomy maps and the
shared ``_queue_strategy_issue_review_locked`` agent-job dispatcher previously
lived inline in ``services/control-api/main.py`` (post-Round 119 region
~5670-6530).  Each helper depended on a handful of module-level globals
(``repo`` plus a couple of recommendation-string builders and the strategy
parameter snapshot resolver).

Following the pattern established by :mod:`alert_and_guard_sync`,
:mod:`audit_aggregators` and :mod:`execution_health`, this module exposes pure
functions that accept their collaborators as explicit keyword arguments.
``main.py`` keeps thin wrappers with the original ``_clear_…`` / ``_record_…``
names so every existing call site (and the test surface, which exercises
``control_main._clear_strategy_position_drift_alerts(...)`` etc.) stays
untouched.

Internal cross-references — e.g. ``record_strategy_auto_dispatch_issue`` calls
``queue_strategy_issue_review_locked`` and ``derive_sub_block_code_from_detail``
— resolve as ordinary module-internal lookups, so the wrapper layer in
``main.py`` only needs to thread the few external collaborators (the
``parameter_snapshot`` resolver, the recommendation builders) through to
the public entry points.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

import parameter_resolver
from models import (
    AccountMode,
    AgentJobCreate,
    AlertRecord,
    AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE,
    AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE,
    EventSeverity,
    PositionRecord,
    RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL,
    RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL,
    StrategyRuntimeSnapshot,
    StrategySummary,
)
from risk_decision import derive_block_reason_code


# Round 85 — map the auto-dispatch gate's typed channel-outage codes onto the
# R80 ``RISK_REASON_RUNTIME_UNAVAILABLE_*`` sub-codes so ``AlertRecord``-based
# fallback recommenders (``_resolve_auto_dispatch_top_issue_recommended_action``)
# can dispatch on the typed sub-discriminator without re-parsing the Chinese
# alert description.  The two taxonomies are orthogonal by design (one keys
# the auto-dispatch gate, the other keys the risk-decision preview), so the
# mapping only covers the channel-outage overlap.  Scheduler-manual-override /
# paused / freeze-publish gate reasons do not have a preview-side counterpart
# and are intentionally not mapped.
_AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE: Dict[str, str] = {
    AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE: RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL,
    AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE: RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL,
}

# Round 92 — reverse of :data:`_AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE` used by
# the outcome-record callsite inside ``_auto_dispatch_strategy_signal_changes``
# (main.py:8078).  The dispatch call's raised ``StrategyExecutionChannelOutageError``
# carries a typed ``sub_block_code`` (one of the ``RISK_REASON_RUNTIME_UNAVAILABLE_*``
# sub-codes); this dict maps it back onto the ``AlertRecord.reason_code``
# taxonomy so the record helper receives both typed discriminators directly
# and skips the ``classify_strategy_auto_dispatch_alert_kind`` /
# ``derive_sub_block_code_from_detail`` substring fallbacks.  Declared
# explicitly rather than inverting the forward dict at import time so adding
# a many-to-one entry to the forward map will not silently drop entries here.
_RISK_SUB_BLOCK_TO_AUTO_DISPATCH_GATE_REASON: Dict[str, str] = {
    RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL: AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE,
    RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL: AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE,
}


def clear_strategy_auto_dispatch_alerts(strategy_id: str, *, repo: Any) -> bool:
    changed = False
    prefix = f"strategy-auto-dispatch:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def has_active_strategy_auto_dispatch_alert(strategy_id: str, *, repo: Any) -> bool:
    prefix = f"strategy-auto-dispatch:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )


def clear_strategy_live_stop_loss_alerts(strategy_id: str, *, repo: Any) -> bool:
    changed = False
    prefix = f"strategy-live-stop-loss:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def has_active_strategy_live_stop_loss_alert(strategy_id: str, *, repo: Any) -> bool:
    prefix = f"strategy-live-stop-loss:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )


def clear_strategy_position_drift_alerts(
    strategy_id: str,
    *,
    repo: Any,
    resolve_strategy_parameter_snapshot: Callable[[Optional[str]], Optional[Dict[str, Any]]],
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    prefix = f"strategy-position-drift:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.position_drift.resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "detail": resolution_detail or "当前实际仓位已重新与策略目标对齐，偏离提醒已收起。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def has_active_strategy_position_drift_alert(strategy_id: str, *, repo: Any) -> bool:
    prefix = f"strategy-position-drift:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )


def clear_strategy_exchange_rejected_alerts(
    strategy_id: str,
    *,
    repo: Any,
    resolve_strategy_parameter_snapshot: Callable[[Optional[str]], Optional[Dict[str, Any]]],
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    prefix = f"strategy-exchange-rejected:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.exchange_order.rejection_resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "detail": resolution_detail or "真实策略委托已恢复正常，拒单提醒已收起。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def clear_strategy_exchange_rejection_guard_alerts(
    strategy_id: str,
    *,
    repo: Any,
    resolve_strategy_parameter_snapshot: Callable[[Optional[str]], Optional[Dict[str, Any]]],
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    prefix = f"strategy-exchange-rejection-guard:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.exchange_order.rejection_guard.resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "detail": resolution_detail or "连续拒单熔断已解除，真实策略自动执行可继续人工复核后恢复。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def has_active_strategy_exchange_rejection_guard_alert(strategy_id: str, *, repo: Any) -> bool:
    prefix = f"strategy-exchange-rejection-guard:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )


def clear_strategy_stale_order_alerts(
    strategy_id: str,
    *,
    repo: Any,
    resolve_strategy_parameter_snapshot: Callable[[Optional[str]], Optional[Dict[str, Any]]],
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    prefix = f"strategy-stale-order:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.exchange_order.stale_resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "detail": resolution_detail or "停滞挂单异常已解除，旧提醒已收起。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def has_active_strategy_stale_order_alert(strategy_id: str, *, repo: Any) -> bool:
    prefix = f"strategy-stale-order:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )


def queue_strategy_issue_review_locked(
    *,
    repo: Any,
    strategy_id: str,
    strategy_name: str,
    symbol: str,
    mode: AccountMode,
    issue_type: str,
    summary: str,
    detail: str,
    rule_key: str,
    severity: str = "P1",
) -> None:
    timestamp = datetime.now(timezone.utc).astimezone().isoformat()
    repo._create_agent_job_locked(  # type: ignore[attr-defined]
        AgentJobCreate(
            job_type="review_strategy_issue",
            context={
                "issue_type": issue_type,
                "summary": summary,
                "detail": detail,
                "severity": severity,
                "strategy_id": strategy_id,
                "strategy_name": strategy_name,
                "symbol": symbol,
                "mode": mode.value,
                "rule_key": rule_key,
                "triggered_at": timestamp,
            },
            allowed_actions=["review_strategy_issue", "summarize_execution_impact"],
            timeout=60,
            idempotency_key=f"strategy-issue-review:{rule_key}:{timestamp}",
            writeback_target="strategy_activity",
        ),
        source="mock-orchestrator",
    )


def classify_strategy_auto_dispatch_alert_kind(detail: Optional[str]) -> Optional[str]:
    """Classify ``detail`` into the typed channel-outage reason code.

    Round 76 — returns the typed ``AUTO_DISPATCH_GATE_REASON_*`` constant for
    the two realtime-channel outage families that the runtime-snapshot
    decoration (``_apply_strategy_auto_dispatch_alert_guard``) currently
    distinguishes via substring matching on ``AlertRecord.description``.  The
    helper centralises the probe so it only lives at the alert-emission
    boundary; the consumer can then read ``alert.reason_code`` directly.

    Returns ``None`` when no channel-outage hint is present, so the caller
    leaves ``reason_code`` unset on the alert (callers that already know the
    typed code — e.g. the gate path — pass it in explicitly and skip this
    fallback).
    """

    if not detail:
        return None
    if "私有 WS" in detail or "私有实时链路" in detail:
        return AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE
    if "公共 WS" in detail or "公共实时链路" in detail:
        return AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE
    return None


def resolve_alert_sub_block_code(alert: Optional[AlertRecord]) -> Optional[str]:
    """Return the :data:`RISK_REASON_RUNTIME_UNAVAILABLE_*` sub-code that
    matches ``alert.reason_code``, or ``None`` if the alert carries a
    non-channel reason code (scheduler gate, unclassified, or no alert).

    Callers use this to thread a typed ``sub_block_code`` into the
    recommendation helpers so the canonical channel-outage recovery copy
    comes from the typed taxonomy rather than a ``"私有 WS"`` / ``"公共 WS"``
    detail substring probe.
    """

    if alert is None or alert.reason_code is None:
        return None
    return _AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE.get(alert.reason_code)


def derive_sub_block_code_from_detail(detail: Optional[str]) -> Optional[str]:
    """Classify ``detail`` onto a :data:`RISK_REASON_RUNTIME_UNAVAILABLE_*`
    sub-code via ``classify_strategy_auto_dispatch_alert_kind`` +
    :data:`_AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE`.

    Round 88 — used by the two ``record_strategy_{auto_dispatch,manual_execution}_issue``
    helpers to forward a typed ``sub_block_code`` into
    ``_build_execution_preview_recommended_action`` even when the caller did
    not supply one.  Together with the explicit ``sub_block_code=`` threading
    on the in-tree preview-emission paths (R80/R84) this closes the last
    channel-outage blind spot before the umbrella substring fallback inside
    ``_build_execution_preview_recommended_action`` is deleted.

    Worker-thread blocks are always raised from in-tree callers that pass
    ``sub_block_code=RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD`` directly
    (R84), so this helper does not classify ``"运行线程"`` tokens — it
    returns ``None`` and the caller's ``sub_block_code`` stays unset.  The
    recommender then returns ``None`` for the umbrella branch, and the
    downstream ``or item.next_action`` fallback covers externally-built
    audit strings without a typed sub-code.
    """

    alert_kind = classify_strategy_auto_dispatch_alert_kind(detail)
    if alert_kind is None:
        return None
    return _AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE.get(alert_kind)


def record_strategy_auto_dispatch_issue(
    strategy_id: str,
    strategy_name: str,
    symbol: str,
    signal: str,
    mode: AccountMode,
    detail: str,
    recommended_action: Optional[str] = None,
    *,
    repo: Any,
    build_auto_dispatch_recommended_action: Callable[..., str],
    strategy: Optional[StrategySummary] = None,
    reason_code: Optional[str] = None,
    market: Optional[str] = None,
    sub_block_code: Optional[str] = None,
    issue_kind: Optional[str] = None,
) -> None:
    # Round 84 — ``market`` / ``sub_block_code`` thread the typed
    # discriminators through to the recommendation helper so the runtime-worker
    # / spot-vs-perp / channel-outage sub-copy picks off the typed field
    # rather than the ``"可用保证金不足"`` / ``"私有 WS"`` / ``"公共 WS"`` /
    # ``"运行线程"`` detail probes.
    # Round 88 — when the caller does not pass ``sub_block_code`` explicitly
    # (the gate-rejected channel-outage path at main.py:7845 predates R84),
    # derive it from the detail so the umbrella RUNTIME_UNAVAILABLE substring
    # probe inside ``_build_execution_preview_recommended_action`` can be
    # deleted without regressing that call site.
    # Round 100 — ``issue_kind`` forwards the typed ``CHANNEL_ISSUE_KIND_*``
    # discriminator onto ``AlertRecord.issue_kind`` so the runtime-snapshot
    # decoration (``_decorate_strategy_runtime_item``) can pick the typed
    # "no_feed" / "stale" / "auth" recovery copy without re-classifying the
    # composed alert description.  Callers that already carry the typed kind
    # (gate path + ``StrategyExecutionChannelOutageError`` outcome path) pass
    # it in explicitly; legacy / non-channel callers leave it ``None`` and
    # the alert omits the field (decorator falls back to the R97 classifier).
    rule_key = f"strategy-auto-dispatch:{strategy_id}:{signal}:{mode.value}"
    resolved_sub_block_code = sub_block_code or derive_sub_block_code_from_detail(detail)
    suggested_action = recommended_action or build_auto_dispatch_recommended_action(
        detail, market=market, sub_block_code=resolved_sub_block_code
    )
    parameter_snapshot = (
        parameter_resolver.snapshot_parameters(strategy) if strategy is not None else None
    )
    # Round 76 — explicit ``reason_code`` from a caller that already has the
    # typed discriminator (e.g. ``AutoDispatchGate.sub_reason_code``) takes
    # precedence over the detail-based classifier fallback.
    resolved_reason_code = reason_code or classify_strategy_auto_dispatch_alert_kind(detail)
    with repo._lock:  # type: ignore[attr-defined]
        changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
            rule_key=rule_key,
            severity="P1",
            symbol=symbol,
            title=f"{symbol} 自动执行被拦截",
            description=f"{strategy_name} 在 {mode.value.upper()} 自动执行时被阻断。{detail}",
            suggested_action=suggested_action,
            strategy_id=strategy_id,
            reason_code=resolved_reason_code,
            issue_kind=issue_kind,
        )
        if changed:
            queue_strategy_issue_review_locked(
                repo=repo,
                strategy_id=strategy_id,
                strategy_name=strategy_name,
                symbol=symbol,
                mode=mode,
                issue_type="auto_dispatch_blocked",
                summary=f"{symbol} 自动执行被拦截",
                detail=detail,
                rule_key=rule_key,
            )
            repo.add_event(
                event_type="strategy.exchange_order.auto_blocked",
                source="quant-core",
                severity=EventSeverity.WARNING,
                payload={
                    "strategy_id": strategy_id,
                    "strategy_name": strategy_name,
                    "symbol": symbol,
                    "signal": signal,
                    "mode": mode.value,
                    "detail": detail,
                    "recommended_action": suggested_action,
                },
                symbol=symbol,
                strategy_id=strategy_id,
                parameter_snapshot=parameter_snapshot,
            )
        repo._refresh_derived_state()  # type: ignore[attr-defined]
        repo._persist()  # type: ignore[attr-defined]


def record_strategy_manual_execution_issue(
    strategy_id: str,
    strategy_name: str,
    symbol: str,
    mode: AccountMode,
    detail: str,
    recommended_action: Optional[str] = None,
    *,
    repo: Any,
    build_manual_execution_recommended_action: Callable[..., str],
    strategy: Optional[StrategySummary] = None,
    reason_code: Optional[str] = None,
    market: Optional[str] = None,
    sub_block_code: Optional[str] = None,
    issue_kind: Optional[str] = None,
) -> None:
    # Round 84 — ``market`` / ``sub_block_code`` thread the typed
    # discriminators through to the recommendation helper so the runtime-worker
    # / spot-vs-perp / channel-outage sub-copy picks off the typed field
    # rather than the ``"可用保证金不足"`` / ``"私有 WS"`` / ``"公共 WS"`` /
    # ``"运行线程"`` detail probes.
    # Round 88 — when the caller does not pass ``sub_block_code`` explicitly,
    # derive it from the detail's channel-outage tokens so the umbrella
    # RUNTIME_UNAVAILABLE substring probe inside
    # ``_build_execution_preview_recommended_action`` can be deleted without
    # regressing audit-record call sites (e.g. the ``except RuntimeError``
    # branch at ``dispatch_strategy_signal`` for plain ``RuntimeError``
    # instances that happen to carry the ``"私有 WS"`` / ``"公共 WS"`` token
    # without being ``StrategyExecutionChannelOutageError`` instances).
    # Round 100 — ``issue_kind`` mirrors the auto-dispatch helper: forward the
    # typed ``CHANNEL_ISSUE_KIND_*`` onto ``AlertRecord.issue_kind`` so
    # audit-record consumers that branch on the typed kind can skip
    # ``_classify_channel_issue_kind`` on the composed description.
    rule_key = f"strategy-blocked-execution:{strategy_id}:{mode.value}"
    resolved_sub_block_code = sub_block_code or derive_sub_block_code_from_detail(detail)
    suggested_action = recommended_action or build_manual_execution_recommended_action(
        detail, market=market, sub_block_code=resolved_sub_block_code
    )
    parameter_snapshot = (
        parameter_resolver.snapshot_parameters(strategy) if strategy is not None else None
    )
    # Round 69 — attach the typed ``reason_code`` to the strategy-execution
    # blocked audit payloads (mirrors the R66 ``risk.blocked_order`` coverage)
    # so auditors can correlate preview-derived blocks with runtime-worker or
    # exception-path blocks without parsing Chinese substrings.  Callers that
    # already have a ``RiskDecision.reason_code`` pass it in; callers that
    # only carry a free-form reason string fall back to
    # ``derive_block_reason_code`` at emit time.
    resolved_reason_code = reason_code or derive_block_reason_code(detail)
    with repo._lock:  # type: ignore[attr-defined]
        # Round 76 — propagate the typed reason code onto the emitted
        # ``AlertRecord`` so downstream consumers can branch on
        # ``alert.reason_code`` without re-deriving it from the description.
        changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
            rule_key=rule_key,
            severity="P1",
            symbol=symbol,
            title=f"{symbol} 手动策略执行被拦截",
            description=f"{strategy_name} 在 {mode.value.upper()} 手动执行时被阻断。{detail}",
            suggested_action=suggested_action,
            strategy_id=strategy_id,
            reason_code=resolved_reason_code,
            issue_kind=issue_kind,
        )
        repo.add_event(
            event_type="strategy.execution.blocked",
            source="desktop-control",
            severity=EventSeverity.WARNING,
            payload={
                "strategy_id": strategy_id,
                "strategy_name": strategy_name,
                "symbol": symbol,
                "mode": mode.value,
                "detail": detail,
                "reason_code": resolved_reason_code,
                "recommended_action": suggested_action,
            },
            symbol=symbol,
            strategy_id=strategy_id,
            parameter_snapshot=parameter_snapshot,
        )
        if changed:
            queue_strategy_issue_review_locked(
                repo=repo,
                strategy_id=strategy_id,
                strategy_name=strategy_name,
                symbol=symbol,
                mode=mode,
                issue_type="manual_execution_blocked",
                summary=f"{symbol} 手动策略执行被拦截",
                detail=detail,
                rule_key=rule_key,
            )
            repo.add_event(
                event_type="strategy.execution.blocked_alerted",
                source="quant-core",
                severity=EventSeverity.WARNING,
                payload={
                    "strategy_id": strategy_id,
                    "strategy_name": strategy_name,
                    "symbol": symbol,
                    "mode": mode.value,
                    "detail": detail,
                    "reason_code": resolved_reason_code,
                    "recommended_action": suggested_action,
                },
                symbol=symbol,
                strategy_id=strategy_id,
                parameter_snapshot=parameter_snapshot,
            )
        repo._refresh_derived_state()  # type: ignore[attr-defined]
        repo._persist()  # type: ignore[attr-defined]


def clear_strategy_manual_execution_alerts(
    strategy_id: str,
    mode: AccountMode,
    *,
    repo: Any,
    resolve_strategy_parameter_snapshot: Callable[[Optional[str]], Optional[Dict[str, Any]]],
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    rule_keys = {
        f"strategy-blocked-execution:{strategy_id}:{mode.value}",
        f"strategy-manual-execution:{strategy_id}:{mode.value}",
    }
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            if str(getattr(alert, "rule_key", None) or "") not in rule_keys:
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.execution.blocked_resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "mode": mode.value,
                    "detail": resolution_detail or "后续手动策略执行已恢复成功，旧的拦截提醒已收起。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def sync_strategy_position_drift_issue(
    snapshot: StrategyRuntimeSnapshot,
    *,
    active_order_count: int,
    repo: Any,
    resolve_strategy_parameter_snapshot: Callable[[Optional[str]], Optional[Dict[str, Any]]],
) -> None:
    if snapshot.mode == AccountMode.PAPER or snapshot.runtime_status != "running":
        clear_strategy_position_drift_alerts(
            snapshot.strategy_id,
            repo=repo,
            resolve_strategy_parameter_snapshot=resolve_strategy_parameter_snapshot,
        )
        return
    if snapshot.position_alignment != "drifted":
        detail = snapshot.position_alignment_detail or "当前仓位已经回到策略目标附近，偏离提醒已收起。"
        clear_strategy_position_drift_alerts(
            snapshot.strategy_id,
            repo=repo,
            resolve_strategy_parameter_snapshot=resolve_strategy_parameter_snapshot,
            resolution_detail=detail,
        )
        return

    detail = snapshot.position_alignment_detail or "当前实际仓位与策略目标仍有偏差，尚未完全对齐。"
    with repo._lock:  # type: ignore[attr-defined]
        changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
            rule_key=f"strategy-position-drift:{snapshot.strategy_id}:{snapshot.mode.value}",
            severity="P1",
            symbol=snapshot.symbol,
            title=f"{snapshot.symbol} 策略仓位偏离目标",
            description=(
                f"{snapshot.strategy_name} 当前目标仓位 {snapshot.target_position_side} "
                f"{snapshot.target_position_size or '--'}，但实际仓位仍未对齐。{detail}"
            ),
            suggested_action="切到策略页和账户页核对持仓、关联委托和执行预检，必要时人工补单或接管。",
            strategy_id=snapshot.strategy_id,
        )
        if changed:
            queue_strategy_issue_review_locked(
                repo=repo,
                strategy_id=snapshot.strategy_id,
                strategy_name=snapshot.strategy_name,
                symbol=snapshot.symbol,
                mode=snapshot.mode,
                issue_type="position_drift",
                summary=f"{snapshot.symbol} 策略仓位偏离目标",
                detail=detail,
                rule_key=f"strategy-position-drift:{snapshot.strategy_id}:{snapshot.mode.value}",
            )
            repo.add_event(
                event_type="strategy.position_drift.alerted",
                source="quant-core",
                severity=EventSeverity.WARNING,
                payload={
                    "strategy_id": snapshot.strategy_id,
                    "strategy_name": snapshot.strategy_name,
                    "symbol": snapshot.symbol,
                    "mode": snapshot.mode.value,
                    "target_position_side": snapshot.target_position_side,
                    "target_position_size": snapshot.target_position_size,
                    "detail": detail,
                    "active_order_count": active_order_count,
                },
                symbol=snapshot.symbol,
                strategy_id=snapshot.strategy_id,
                parameter_snapshot=resolve_strategy_parameter_snapshot(snapshot.strategy_id),
            )
        repo._refresh_derived_state()  # type: ignore[attr-defined]
        repo._persist()  # type: ignore[attr-defined]


def record_strategy_live_stop_loss_issue(
    strategy: StrategySummary,
    snapshot: StrategyRuntimeSnapshot,
    position: PositionRecord,
    *,
    stop_loss_pct: float,
    cancelled_count: int,
    repo: Any,
) -> None:
    detail = (
        f"{snapshot.symbol} 当前参考价 {snapshot.last_price:.4f} 已触发 {stop_loss_pct:.2f}% 真实模式止损保护；"
        "后台自动执行已暂停，请先人工复核真实仓位。"
    )
    with repo._lock:  # type: ignore[attr-defined]
        changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
            rule_key=f"strategy-live-stop-loss:{strategy.id}:{strategy.mode.value}",
            severity="P0",
            symbol=snapshot.symbol,
            title=f"{strategy.name} 触发真实模式止损保护",
            description=detail,
            suggested_action="打开策略页和账户页复核真实持仓、止损参数与当前委托，确认后再决定是否恢复自动执行。",
            strategy_id=strategy.id,
        )
        if changed:
            repo.add_event(
                event_type="strategy.exchange_stop_loss.alerted",
                source="quant-core",
                severity=EventSeverity.CRITICAL,
                payload={
                    "strategy_id": strategy.id,
                    "strategy_name": strategy.name,
                    "symbol": snapshot.symbol,
                    "market": snapshot.market,
                    "mode": strategy.mode.value,
                    "stop_loss_pct": stop_loss_pct,
                    "last_price": snapshot.last_price,
                    "position_size": position.size,
                    "avg_price": position.avg_price,
                    "cancelled_orders": cancelled_count,
                },
                symbol=snapshot.symbol,
                strategy_id=strategy.id,
                parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
            )
        repo._refresh_derived_state()  # type: ignore[attr-defined]
        repo._persist()  # type: ignore[attr-defined]


__all__ = [
    "_AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE",
    "_RISK_SUB_BLOCK_TO_AUTO_DISPATCH_GATE_REASON",
    "classify_strategy_auto_dispatch_alert_kind",
    "clear_strategy_auto_dispatch_alerts",
    "clear_strategy_exchange_rejected_alerts",
    "clear_strategy_exchange_rejection_guard_alerts",
    "clear_strategy_live_stop_loss_alerts",
    "clear_strategy_manual_execution_alerts",
    "clear_strategy_position_drift_alerts",
    "clear_strategy_stale_order_alerts",
    "derive_sub_block_code_from_detail",
    "has_active_strategy_auto_dispatch_alert",
    "has_active_strategy_exchange_rejection_guard_alert",
    "has_active_strategy_live_stop_loss_alert",
    "has_active_strategy_position_drift_alert",
    "has_active_strategy_stale_order_alert",
    "queue_strategy_issue_review_locked",
    "record_strategy_auto_dispatch_issue",
    "record_strategy_live_stop_loss_issue",
    "record_strategy_manual_execution_issue",
    "resolve_alert_sub_block_code",
    "sync_strategy_position_drift_issue",
]
