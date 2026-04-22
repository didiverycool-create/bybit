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

from typing import Any, Dict, Optional

from models import (
    ExecutionPreview,
    RISK_REASON_ACCOUNT_MODE_UNAVAILABLE,
    RISK_REASON_APPROVED,
    RISK_REASON_EXCHANGE_CONSTRAINT,
    RISK_REASON_INSUFFICIENT_BALANCE,
    RISK_REASON_INSUFFICIENT_INVENTORY,
    RISK_REASON_PREVIEW_BLOCKED,
    RiskDecision,
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
    return RISK_REASON_PREVIEW_BLOCKED


def evaluate_risk_decision(
    preview: ExecutionPreview,
    *,
    recommended_action: Optional[Dict[str, Any]] = None,
) -> RiskDecision:
    """Wrap ``preview`` in a :class:`RiskDecision` with an explicit verdict.

    * ``preview.allowed is True`` → ``verdict="allow"`` with
      :data:`RISK_REASON_APPROVED`.
    * ``preview.allowed is False`` → ``verdict="block"`` with a best-effort
      reason code derived from ``preview.blocked_reason``.

    ``recommended_action`` is an optional structured hint supplied by the
    caller (e.g. ``{"retry_after_seconds": 30}`` for a ``"wait"`` verdict or
    ``{"size_multiplier": 0.5}`` for ``"degrade"``).  When ``None`` and the
    preview carries a free-form ``recommended_action`` string, that string is
    echoed back under the ``"recommendation"`` key so downstream UI can keep
    rendering it without a second fetch.
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
        action = {"recommendation": preview.recommended_action}
    return RiskDecision(
        verdict="block",
        reason_code=derive_block_reason_code(detail),
        reason_detail=detail,
        recommended_action=action,
        preview=preview,
    )
