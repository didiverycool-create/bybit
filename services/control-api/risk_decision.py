"""Structured risk decision layer (Round 58).

Prior to Round 58 every callsite that wanted to know whether an execution
request was safe to dispatch reached straight into an
:class:`~models.ExecutionPreview` and branched on the untyped
``preview.allowed`` / ``preview.blocked_reason`` / ``preview.warnings`` fields.
Some callers inspected ``blocked`` flags, others pattern-matched on Chinese
substrings of ``blocked_reason`` — the decision surface was scattered and
impossible to evolve.

``evaluate_risk_decision`` centralises that mapping. It takes an
``ExecutionPreview`` (the existing, untouched builder output) and returns a
:class:`~models.RiskDecision` carrying:

* ``verdict`` — ``"allow"`` / ``"block"`` / ``"degrade"`` / ``"wait"``.
* ``reason_code`` — a short, stable, machine-readable string.
* ``reason_detail`` — human-readable message (kept in sync with the preview's
  ``blocked_reason`` so nothing is lost for the UI).
* ``recommended_action`` — structured hint (e.g. ``{"retry_after_seconds": …}``).
* ``preview`` — the original preview, embedded verbatim so existing callers
  can still read numeric fields (``notional``, ``projected_position_size``,
  sizing budgets, …).

Scope discipline: this is a typing / structure pass, not a policy change.
The verdict mapping reproduces today's behaviour exactly — ``preview.allowed``
always maps to ``"allow"``, the existing block reasons map to ``"block"`` with
a best-effort ``reason_code``, and no new rejection paths are introduced.
"""

from __future__ import annotations

from typing import Optional

from models import (
    ExecutionPreview,
    RISK_REASON_ACCOUNT_MODE_UNAVAILABLE,
    RISK_REASON_APPROVED,
    RISK_REASON_EXCHANGE_CONSTRAINT,
    RISK_REASON_INSUFFICIENT_BALANCE,
    RISK_REASON_INSUFFICIENT_INVENTORY,
    RISK_REASON_INVALID_REQUEST,
    RISK_REASON_PREVIEW_BLOCKED,
    RISK_REASON_RUNTIME_UNAVAILABLE,
    RISK_REASON_STOP_LOSS_GUARD,
    RiskDecision,
    RiskDecisionRecommendation,
)


# Substring probes used to map today's implicit block reason strings onto
# ``risk.*`` machine-readable codes.  The substrings are intentionally narrow
# — if ``blocked_reason`` does not match any of these we fall through to the
# generic ``risk.preview_blocked`` code, so callers always see *some* stable
# tag even when the underlying builder emits a new reason string.
_INSUFFICIENT_BALANCE_HINTS = (
    "可用余额不足",
    "可用保证金不足",
    "保证金不足",
)
_INSUFFICIENT_INVENTORY_HINTS = (
    "现货可卖数量不足",
    "现货可用数量不足",
)
_EXCHANGE_CONSTRAINT_HINTS = (
    "最小下单",
    "最小数量",
    "最小名义",
    "下单精度",
    "下单步长",
    # Round 68 — tighten coverage for the ``_validate_exchange_order_constraints``
    # qty-step / tick-size / min-notional branches that used to fall through
    # to ``risk.preview_blocked``.
    "数量步长",
    "价格步长",
    "名义价值",
    "交易所",
    "Bybit 返回",
    "tick size",
    "lot size",
)
_ACCOUNT_MODE_HINTS = (
    "Paper 模式",
    "真实执行引擎",
    "Demo / Live",
    "私有 API",
    "私有账户",
)
# Round 68 — precondition-validation failures raised by
# ``evaluate_paper_order_risk`` before any risk math runs (e.g. non-positive
# quantity / price).  Mapped to :data:`RISK_REASON_INVALID_REQUEST` so
# auditors can distinguish invalid-input blocks from real risk blocks.
_INVALID_REQUEST_HINTS = (
    "必须大于 0",
    "必须为正",
)
# Round 71 — runtime worker / websocket outages used to fall through to the
# generic ``risk.preview_blocked`` fallback.  The primary path now sets
# :data:`models.RISK_REASON_RUNTIME_UNAVAILABLE` at source, but the probe
# still needs to classify historical / fallback strings.
_RUNTIME_UNAVAILABLE_HINTS = (
    "策略运行线程",
    "私有 WS",
    "公共 WS",
    "Bybit 私有账户链路",
)
# Round 82 — live-mode stop-loss-guard blocks carry ``"止损保护"`` in every
# in-tree producer of the copy ("当前已触发真实模式止损保护...").  The primary
# path now sets :data:`RISK_REASON_STOP_LOSS_GUARD` at source, but this probe
# classifies legacy audit strings / externally-constructed previews onto the
# same code so downstream recommenders don't fall through to the generic
# ``risk.preview_blocked`` fallback.
_STOP_LOSS_GUARD_HINTS = (
    "止损保护",
)


def derive_block_reason_code(detail: str) -> str:
    """Return the best-effort ``risk.*`` reason code for ``detail``.

    ``detail`` is a free-form Chinese blocked-reason string.  The mapping is
    intentionally conservative: if no hint matches we fall back to
    :data:`RISK_REASON_PREVIEW_BLOCKED` rather than guessing.

    Round 66 — this helper is also consumed outside ``evaluate_risk_decision``
    (``paper_order_create`` / ``paper_order_replace`` emit ``risk.blocked_order``
    from a non-preview ``evaluate_paper_order_risk`` reason and still want a
    uniform ``reason_code`` on the audit payload), so the name is now public.
    """

    if not detail:
        return RISK_REASON_PREVIEW_BLOCKED
    # Round 68 — probe the precondition-validation hints first so a reason
    # like "数量和价格必须大于 0。" does not get conflated with a real risk
    # block (insufficient balance, exchange-constraint, …) on the audit feed.
    for hint in _INVALID_REQUEST_HINTS:
        if hint in detail:
            return RISK_REASON_INVALID_REQUEST
    for hint in _INSUFFICIENT_BALANCE_HINTS:
        if hint in detail:
            return RISK_REASON_INSUFFICIENT_BALANCE
    for hint in _INSUFFICIENT_INVENTORY_HINTS:
        if hint in detail:
            return RISK_REASON_INSUFFICIENT_INVENTORY
    for hint in _EXCHANGE_CONSTRAINT_HINTS:
        if hint in detail:
            return RISK_REASON_EXCHANGE_CONSTRAINT
    for hint in _ACCOUNT_MODE_HINTS:
        if hint in detail:
            return RISK_REASON_ACCOUNT_MODE_UNAVAILABLE
    # Round 71 — runtime / websocket outage hints probed last so they do not
    # shadow the more specific account-mode / exchange-constraint / inventory
    # categories for messages that happen to mention the same infra tokens.
    for hint in _RUNTIME_UNAVAILABLE_HINTS:
        if hint in detail:
            return RISK_REASON_RUNTIME_UNAVAILABLE
    # Round 82 — stop-loss-guard hint probed at the same tier as the runtime
    # outage hints: the phrase is narrow enough that a false positive is
    # essentially impossible (only the live-stop-loss preview carries it).
    for hint in _STOP_LOSS_GUARD_HINTS:
        if hint in detail:
            return RISK_REASON_STOP_LOSS_GUARD
    return RISK_REASON_PREVIEW_BLOCKED


def evaluate_risk_decision(
    preview: ExecutionPreview,
    *,
    recommended_action: Optional[RiskDecisionRecommendation] = None,
) -> RiskDecision:
    """Wrap ``preview`` in a :class:`RiskDecision` with an explicit verdict.

    * ``preview.allowed is True`` → ``verdict="allow"`` with
      :data:`RISK_REASON_APPROVED`.
    * ``preview.allowed is False`` → ``verdict="block"`` with a best-effort
      reason code derived from ``preview.blocked_reason``.

    ``recommended_action`` is an optional structured hint supplied by the
    caller — pass a :class:`~models.RiskDecisionRecommendation` whose
    ``retry_after_seconds`` field is populated for a ``"wait"`` verdict, or
    whose ``size_multiplier`` is populated for ``"degrade"``.  When ``None``
    and the preview carries a free-form ``recommended_action`` string, that
    string is echoed back under the ``recommendation`` field so downstream UI
    can keep rendering it without a second fetch.

    Round 73 — the typed :class:`~models.RiskDecisionRecommendation` replaces
    the historical ``Dict[str, Any]`` surface.  Pydantic coerces dict-shaped
    inputs into the model so existing callers that still pass a dict (e.g.
    deserialised JSON payloads) keep working without code change.
    """

    if preview.allowed:
        return RiskDecision(
            verdict="allow",
            reason_code=RISK_REASON_APPROVED,
            reason_detail="当前执行预检通过风控校验。",
            recommended_action=recommended_action,
            preview=preview,
        )

    detail = preview.blocked_reason or "当前执行预检未通过风控校验。"
    action = recommended_action
    if action is None and preview.recommended_action:
        action = RiskDecisionRecommendation(recommendation=preview.recommended_action)
    # Round 70 — prefer the typed ``block_code`` produced at the preview-builder
    # source; only fall back to the substring-probe ``derive_block_reason_code``
    # when a preview arrived without a typed code (older callers / future
    # builders that haven't been migrated yet).
    reason_code = preview.block_code or derive_block_reason_code(detail)
    return RiskDecision(
        verdict="block",
        reason_code=reason_code,
        reason_detail=detail,
        recommended_action=action,
        preview=preview,
    )
