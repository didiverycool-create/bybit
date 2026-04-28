"""Round 118 — Unified RiskEngine wrapping the typed risk-decision graph
that R50-R103 wired up.

Before Round 118 every call-site that wanted a typed risk verdict reached
straight into ``risk_decision.evaluate_risk_decision`` (preview-side risk
verdict), ``main._evaluate_strategy_auto_dispatch_gate`` (autonomous
pre-flight gate) or ``main._classify_auto_dispatch_outcome`` (post-dispatch
verdict).  The three helpers cover **the same conceptual domain** — "what did
risk decide for this intent?" — but live in different modules and have no
shared interface.

This module introduces :class:`RiskEngine` as the single coordinator that
exposes those three already-existing decision points behind one typed API:

* :meth:`RiskEngine.evaluate_preview` — wraps an
  :class:`~models.ExecutionPreview` in a :class:`~models.RiskDecision`.
* :meth:`RiskEngine.evaluate_auto_dispatch_gate` — typed pre-flight gate
  decision for the autonomous strategy-runtime worker.
* :meth:`RiskEngine.classify_outcome` — typed terminal classifier for an
  autonomous dispatch attempt.

The class is a thin coordinator with **no internal state** — every method
delegates verbatim to the underlying helpers (kept private inside ``main.py``
so the existing extraction history / unit-test surface continues to work).
``main.py`` exposes a module-level singleton :data:`risk_engine` so call-sites
can read ``risk_engine.evaluate_preview(...)`` instead of fishing for the
underlying helper.

Wave-2-A scope discipline (mirrors R58 / R60 / R61):
    * **No behaviour change.**  Every public observable (preview verdicts,
      audit events, gate decisions, outcome classifications) is byte-identical
      to today.
    * **No helper deletion.**  ``_evaluate_strategy_auto_dispatch_gate`` /
      ``_classify_auto_dispatch_outcome`` / ``evaluate_risk_decision`` stay as
      private functions; the engine only adds a coordinator layer on top.
    * **Late-binding for main.py helpers.**  ``main.py`` imports this module
      at top level, so resolving the auto-dispatch-gate / outcome-classifier
      helpers via ``import main`` would create a circular import.  The engine
      instead resolves them at call time through the ``main`` module object
      (already loaded by the time any RiskEngine method runs in production
      because main.py constructs the singleton at module load).
"""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING, Optional

from models import (
    AutoDispatchGate,
    AutoDispatchOutcome,
    ExecutionPreview,
    RiskDecision,
    RiskDecisionRecommendation,
    StrategyRuntimeSnapshot,
    StrategySummary,
)
from risk_decision import evaluate_risk_decision as _evaluate_risk_decision

if TYPE_CHECKING:  # pragma: no cover - typing-only import
    from types import ModuleType


def _resolve_main_module() -> "ModuleType":
    """Return the loaded ``main`` module, raising if it has not been imported.

    Resolution is deferred until call time so this module can be imported by
    ``main.py`` at top level without a circular import; the module-level
    ``risk_engine = RiskEngine()`` in ``main.py`` is constructed *after*
    ``main`` finishes initialising, and every subsequent ``RiskEngine`` call
    runs at FastAPI request time when ``main`` is fully loaded.
    """

    module = sys.modules.get("main")
    if module is None:
        raise RuntimeError(
            "RiskEngine 调度依赖的 ``main`` 模块尚未加载，无法访问 "
            "_evaluate_strategy_auto_dispatch_gate / _classify_auto_dispatch_outcome。"
        )
    return module


class RiskEngine:
    """Coordinator wrapping the typed risk-decision graph.

    The engine has no internal state — every method is a thin delegator to an
    existing helper.  Wave-2-A's goal is interface consolidation, not policy
    change: the underlying helpers retain their full extraction / unit-test
    history, and downstream observables are byte-identical to today.
    """

    __slots__ = ()

    def evaluate_preview(
        self,
        preview: ExecutionPreview,
        *,
        recommended_action: Optional[RiskDecisionRecommendation] = None,
    ) -> RiskDecision:
        """Wrap ``preview`` in a typed :class:`RiskDecision`.

        Parity contract with ``risk_decision.evaluate_risk_decision``:
            * ``preview.allowed is True`` → ``verdict="allow"`` /
              ``reason_code=RISK_REASON_APPROVED``.
            * ``preview.allowed is False`` → ``verdict="block"`` with the
              typed ``preview.block_code`` (R70) or, when missing, the
              substring-probe fallback in ``derive_block_reason_code``.
            * ``recommended_action`` forwards verbatim; when ``None`` and the
              preview carries a free-form ``recommended_action`` string, the
              wrapper echoes it back under ``RiskDecision.recommended_action``.
        """

        return _evaluate_risk_decision(preview, recommended_action=recommended_action)

    def evaluate_auto_dispatch_gate(
        self,
        strategy: StrategySummary,
        snapshot: StrategyRuntimeSnapshot,
    ) -> AutoDispatchGate:
        """Return the typed autonomous-dispatch gate verdict for ``strategy``.

        Delegates verbatim to ``main._evaluate_strategy_auto_dispatch_gate``
        (R60).  The helper covers the six R60 guard branches:

        * ``auto.paper_or_paused_strategy`` — strategy in paper / paused /
          shadow / paper-only status.
        * ``auto.live_stop_loss_cooldown`` — live cooldown remaining.
        * ``auto.live_stop_loss_active`` — active live stop-loss alert.
        * ``auto.rejection_guard_active`` — rejection guard cooldown.
        * ``auto.scheduler_or_channel_gate`` — scheduler paused / freeze
          publish / public+private channel outage (with typed sub-reason).
        * ``auto.runtime_not_running`` — snapshot runtime status not
          ``"running"``.
        * ``auto.ready`` — passes every guard, OK to dispatch.
        """

        main_mod = _resolve_main_module()
        return main_mod._evaluate_strategy_auto_dispatch_gate(strategy, snapshot)

    def classify_outcome(
        self,
        exc: Optional[BaseException],
    ) -> AutoDispatchOutcome:
        """Classify the terminal result of an autonomous dispatch attempt.

        Delegates verbatim to ``main._classify_auto_dispatch_outcome`` (R61).
        Returns one of four typed verdicts:

        * ``dispatched`` (``exc is None``) — clear lingering auto-dispatch
          alerts.
        * ``noop`` (``StrategyExecutionNoopError``) — emit
          ``strategy.exchange_order.auto_noop`` audit + clear alerts.
        * ``blocked`` (``StrategyExecutionBlockedError``) — record issue
          carrying the attached ``recommended_action``.
        * ``failed`` (any other ``RuntimeError`` / ``Exception``) — record
          issue without ``recommended_action``.
        """

        main_mod = _resolve_main_module()
        return main_mod._classify_auto_dispatch_outcome(exc)


__all__ = ["RiskEngine"]
