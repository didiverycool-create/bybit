"""Round 125 — Shadow-mode decision diff helper for P0-4.2 §F.1.

The shadow path runs :meth:`execution_engine.ExecutionEngine.compute_decision`
*alongside* the legacy ``_dispatch_paper_intent`` / ``_dispatch_live_intent``
branches and writes one ``execution.shadow_decision`` audit per call.
:func:`compare_shadow_decision` produces the diff record stamped onto that
audit so the operator can spot any divergence between the new engine and the
legacy path.

Round 129 lands the implementation; Round 125 keeps the public dataclass +
signature stable so downstream tests (``CompareShadowDecisionRound129Tests``,
``ShadowAuditEmissionRound130Tests``) can import the names.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from models import ExecutionDecision


@dataclass(frozen=True)
class DecisionDiff:
    """Diff record between ``ExecutionEngine.compute_decision`` and the
    legacy dispatcher's inferred verb / reason_code / order target.

    ``verb_match`` / ``reason_code_match`` are the headline booleans used by
    the audit emission (Round 130) to discriminate
    ``execution.shadow_decision`` (matched) from
    ``execution.shadow_decision_diverged`` (any divergence).  ``field_diffs``
    captures the typed names of every field that drifted (e.g.
    ``"target_order.order_id"``, ``"stale_orders"``) so operators have a
    machine-readable hint when triaging — no substring parsing required.
    """

    intent_id: str
    verb_match: bool
    new_verb: str
    legacy_verb: str
    reason_code_match: bool
    new_reason_code: str
    legacy_reason_code: str
    field_diffs: List[str] = field(default_factory=list)

    @property
    def diverged(self) -> bool:
        """Convenience: ``True`` when any of verb / reason_code / field
        comparisons disagreed.
        """

        return (
            (not self.verb_match)
            or (not self.reason_code_match)
            or bool(self.field_diffs)
        )


def compare_shadow_decision(
    new_decision: ExecutionDecision,
    legacy_verb: str,
    legacy_reason_code: str,
    legacy_target_order_id: Optional[str] = None,
    legacy_stale_order_ids: Optional[List[str]] = None,
) -> DecisionDiff:
    """Compare the engine-produced :class:`ExecutionDecision` against the
    legacy dispatcher's inferred branch.

    The legacy paper / live dispatchers do not emit a
    :class:`ExecutionDecision`-shaped record; the caller (Round 130's audit
    emission in ``main._dispatch_execution_intent``) inspects the legacy
    branch outputs (``LiveOrderReconciliation`` for live, the
    ``StrategyExecutionResult.kind=="paper_trade"`` short-path for paper) and
    forwards three primitives:

    * ``legacy_verb`` — one of the :class:`~models.ExecutionVerb` literal
      values (``"submit"`` / ``"amend"`` / ``"keep"`` / ``"noop"`` /
      ``"cancel_only"`` / ``"cancel_and_resubmit"``).
    * ``legacy_reason_code`` — for live, the
      :class:`~models.LiveOrderReconciliation.reason_code`; for paper, a
      synthetic ``"paper.submit"`` since the legacy paper path always
      writes a fresh trade.
    * ``legacy_target_order_id`` — order id the legacy path would re-use /
      amend, ``None`` for submit / paper.
    * ``legacy_stale_order_ids`` — order ids the legacy path would cancel
      first; defaults to ``[]``.

    Round 129 lands the implementation; Round 125 keeps a stub returning a
    sentinel diff so the dataclass surface is exercised.
    """

    raise NotImplementedError(
        "compare_shadow_decision lands in Round 129 (wave-3-A F.1)"
    )


__all__ = ["DecisionDiff", "compare_shadow_decision"]
