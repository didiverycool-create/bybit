"""Round 125-136 — Shadow-mode decision diff helper for P0-4.2 §F.1+§F.2.

The shadow path runs :meth:`execution_engine.ExecutionEngine.compute_decision`
*alongside* the legacy ``_dispatch_paper_intent`` / ``_dispatch_live_intent``
branches and writes one ``execution.shadow_decision`` audit per call.
:func:`compare_shadow_decision` produces the diff record stamped onto that
audit so the operator can spot any divergence between the new engine and the
legacy path.

Round 129 lands the implementation; Round 125 keeps the public dataclass +
signature stable so downstream tests (``CompareShadowDecisionRound129Tests``,
``ShadowAuditEmissionRound130Tests``) can import the names.

Round 136 — wave-3-B §F.2 commit 5 adds :func:`compare_paper_executed` for
the F.4 double-write parity contract.  The helper takes the legacy
:class:`models.TradeRecord` (the trade ``repo.execute_strategy_signal`` would
have produced) and the engine's :class:`models.TradeRecord` (the trade the
engine actually wrote via the same path, kept in mock / replay tests for
parity) and produces a typed :class:`TradeDiff` describing every
divergence.  The diff is emitted as ``execution.engine_diff`` (WARNING) when
non-empty.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from models import ExecutionDecision, TradeRecord


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
    :class:`ExecutionDecision`-shaped record; the caller (Round 131's audit
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

    The diff records each disagreement as a typed entry in
    ``field_diffs`` so the audit emission can render a machine-readable
    summary rather than re-deriving the difference downstream.  Field
    names follow ``<dotted.path>`` convention to match other typed audit
    fields in the codebase (e.g. ``target_order.order_id``).
    """

    intent_id = new_decision.intent.intent_id or ""
    new_target_id = (
        new_decision.target_order.order.order_id
        if new_decision.target_order is not None
        else None
    )
    new_stale_ids = [item.order.order_id for item in new_decision.stale_orders]
    legacy_stales = list(legacy_stale_order_ids or [])

    field_diffs: List[str] = []

    verb_match = new_decision.verb == legacy_verb
    if not verb_match:
        field_diffs.append("verb")

    reason_code_match = new_decision.reason_code == legacy_reason_code
    if not reason_code_match:
        field_diffs.append("reason_code")

    if new_target_id != legacy_target_order_id:
        field_diffs.append("target_order.order_id")

    # Compare stale order id sets (order-insensitive — the legacy path may
    # cancel them in any order, so the sets matter, not the sequence).
    if set(new_stale_ids) != set(legacy_stales):
        field_diffs.append("stale_orders")

    return DecisionDiff(
        intent_id=intent_id,
        verb_match=verb_match,
        new_verb=new_decision.verb,
        legacy_verb=legacy_verb,
        reason_code_match=reason_code_match,
        new_reason_code=new_decision.reason_code,
        legacy_reason_code=legacy_reason_code,
        field_diffs=field_diffs,
    )


# ============================================================================
# Round 136 — Paper-mode trade parity (P0-4.2 §F.2 commit 5)
# ============================================================================
# When the engine route is enabled (``execution_engine.paper=True``), the
# wave-3-B contract requires a double-write parity check that the engine's
# produced trade is byte-equivalent to the legacy ``repo.execute_strategy_signal``
# output.  :func:`compare_paper_executed` is the pure helper that performs
# that comparison; the audit-emission wiring lives in ``main.py`` so the
# diff helper stays I/O-free (matches the R125 design contract).
# ============================================================================
@dataclass(frozen=True)
class TradeDiff:
    """Diff record between the legacy ``repo.execute_strategy_signal``
    output and the engine's produced :class:`models.TradeRecord`.

    Field-level booleans capture whether the two records agree on each
    semantic dimension (``side`` / ``quantity`` / ``price`` / ``status`` /
    ``mode`` / ``origin``).  ``field_diffs`` is the typed list of diverged
    field names so the audit emission can render a machine-readable
    summary downstream.

    The ``id`` and ``created_at`` fields are intentionally NOT compared —
    each call produces a fresh trade id / timestamp by design, so
    comparing them would always diverge.  The ``pnl`` field is also
    excluded because pnl text formatting is upstream of this layer (the
    repo formats it from the trade quantity / price / position).
    """

    strategy_id: str
    legacy_trade_id: str
    engine_trade_id: str
    side_match: bool
    quantity_match: bool
    price_match: bool
    status_match: bool
    mode_match: bool
    origin_match: bool
    symbol_match: bool
    market_match: bool
    field_diffs: List[str] = field(default_factory=list)

    @property
    def diverged(self) -> bool:
        """``True`` when any of the comparison fields disagreed."""
        return bool(self.field_diffs)


def compare_paper_executed(
    legacy_record: TradeRecord,
    engine_record: TradeRecord,
) -> TradeDiff:
    """Compare two :class:`models.TradeRecord` instances for paper-mode
    parity.

    Pure helper — no I/O.  Returns a :class:`TradeDiff` describing every
    semantic divergence; ``id`` and ``created_at`` are excluded because
    each ``repo.execute_strategy_signal`` invocation generates a fresh id
    + timestamp by design, so comparing them would always disagree.
    ``pnl`` is also excluded because the formatter upstream of this layer
    is not deterministic across invocations (it reads current position
    state at write time).

    The caller (R136 audit emission in ``main.py``) writes
    ``execution.engine_diff`` (WARNING) when the diff's ``diverged`` flag
    is True.
    """

    field_diffs: List[str] = []

    side_match = legacy_record.side == engine_record.side
    if not side_match:
        field_diffs.append("side")

    # Quantity comparison uses an absolute-tolerance check because the
    # legacy ``_create_strategy_trade_locked`` formats quantities through
    # ``repr(float)`` which can drift sub-LSB; 1e-9 is well below any
    # symbol's qty-step constraint.
    qty_diff = abs(float(legacy_record.quantity) - float(engine_record.quantity))
    quantity_match = qty_diff <= 1e-9
    if not quantity_match:
        field_diffs.append("quantity")

    price_diff = abs(float(legacy_record.price) - float(engine_record.price))
    price_match = price_diff <= 1e-9
    if not price_match:
        field_diffs.append("price")

    status_match = legacy_record.status == engine_record.status
    if not status_match:
        field_diffs.append("status")

    mode_match = legacy_record.mode == engine_record.mode
    if not mode_match:
        field_diffs.append("mode")

    origin_match = legacy_record.origin == engine_record.origin
    if not origin_match:
        field_diffs.append("origin")

    symbol_match = legacy_record.symbol == engine_record.symbol
    if not symbol_match:
        field_diffs.append("symbol")

    market_match = legacy_record.market == engine_record.market
    if not market_match:
        field_diffs.append("market")

    strategy_id = legacy_record.strategy_id or engine_record.strategy_id or ""

    return TradeDiff(
        strategy_id=strategy_id,
        legacy_trade_id=legacy_record.id,
        engine_trade_id=engine_record.id,
        side_match=side_match,
        quantity_match=quantity_match,
        price_match=price_match,
        status_match=status_match,
        mode_match=mode_match,
        origin_match=origin_match,
        symbol_match=symbol_match,
        market_match=market_match,
        field_diffs=field_diffs,
    )


def derive_legacy_verb_from_paper_dispatch() -> str:
    """Return the legacy verb for paper dispatch.

    The legacy ``_dispatch_paper_intent`` always submits; this helper makes
    that explicit so the audit emission (R131) can reference a single
    source rather than duplicating the literal in two places.
    """

    return "submit"


def derive_legacy_verb_from_reconciliation(action: str) -> str:
    """Translate the legacy
    :class:`~models.LiveOrderReconciliation.action` literal onto the
    :class:`~models.ExecutionVerb` literal the engine emits, so the audit
    emission (R131) can compare the two without re-mapping inline.
    """

    return {
        "reuse": "keep",
        "amend": "amend",
        "submit": "submit",
    }.get(action, action)


__all__ = [
    "DecisionDiff",
    "TradeDiff",
    "compare_shadow_decision",
    "compare_paper_executed",
    "derive_legacy_verb_from_paper_dispatch",
    "derive_legacy_verb_from_reconciliation",
]
