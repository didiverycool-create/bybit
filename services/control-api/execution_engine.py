"""Round 125-129 — Unified ExecutionEngine for P0-4.2 §F.1 Shadow Mode.

Coordinator that owns the (compute_decision → execute → recover) pipeline.
See ``docs/P0-4.2-execution-engine-design.md`` §B-§E for the full contract;
this module is intended to become the single owner of every Bybit RPC dispatch
path (paper / demo / live).

Wave-3-A milestones:

* R125 — module skeleton (signatures + docstrings).
* R126 — :class:`execution_state_machine.ExecutionStateGraph` legal-transition
  table populated from §C.2.
* R127 — typed §B.2-§B.5 :mod:`models` shapes
  (:class:`~models.TargetPosition` / :class:`~models.ActiveExchangeOrder` /
  :class:`~models.ExecutionDecision` / :class:`~models.ExecutionResult` /
  :class:`~models.RecoveryReport`).
* R128 — :class:`~models.ExecutionIntent` extension fields + ``"recovery"``
  source variant (J.4).
* R129 — :meth:`ExecutionEngine.compute_decision` lands as a byte-equivalent
  wrapper around the legacy ``_classify_live_order_reconciliation`` (live)
  / ``_dispatch_paper_intent`` (paper) branching, surfaced as a typed
  :class:`~models.ExecutionDecision` so Shadow Mode can compare against
  the legacy path.

``execute`` / ``recover`` continue to raise until wave-3-B / wave-3-D.

Wave-3-A scope discipline (mirrors R118 RiskEngine):
    * **No behaviour change.** Importing this module must not affect any of
      the 876 pytest tests.  The class is constructed lazily by ``main.py``
      after this module imports; no top-level side effects.
    * **No coupling to ``main.py`` at import time.** The engine resolves
      dependencies through constructor injection, not module-level imports
      from ``main`` (which would create a circular import — see R117).
      ``compute_decision`` reaches into the legacy classifier through
      ``sys.modules["main"]`` at call time, mirroring the R118
      ``_resolve_main_module`` pattern.
    * **Shadow-only invocation in F.1.** ``compute_decision`` is a pure
      function and may be called from ``main._dispatch_execution_intent``
      *before* the legacy paper / live branches return; ``execute`` /
      ``recover`` stay raising until wave-3-B onwards.
"""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING, Any, List, Optional

from models import (
    AccountMode,
    ActiveExchangeOrder,
    ExecutionDecision,
    ExecutionIntent,
    ExecutionResult,
    LiveOrderAction,
    LiveOrderReconciliation,
    NewOrderRequest,
    OrderRecord,
    RecoveryReport,
)

if TYPE_CHECKING:  # pragma: no cover - typing-only imports
    from types import ModuleType

    from repository import AppRepository
    from risk_engine import RiskEngine


# --------------------------------------------------------------------------- #
# Internal helpers (module-level, pure functions).                            #
# --------------------------------------------------------------------------- #

# Mapping from the legacy :class:`LiveOrderReconciliation.action` (which only
# has 3 variants) onto the typed :class:`models.ExecutionVerb` literal (6
# variants).  ``submit`` maps verbatim; ``reuse`` becomes ``keep`` (the
# engine's term for "no Bybit RPC needed, the existing order already
# matches"); ``amend`` maps verbatim.  The two new verbs
# (``cancel_and_resubmit`` / ``cancel_only`` / ``noop``) are not produced by
# the legacy classifier today; the engine only emits them when the new
# decision logic surfaces them in F.2 / F.3.
_LIVE_ACTION_TO_VERB = {
    "reuse": "keep",
    "amend": "amend",
    "submit": "submit",
}


def _resolve_main_module() -> "ModuleType":
    """Return the loaded ``main`` module.

    Mirrors :func:`risk_engine._resolve_main_module` so the engine can call
    ``main._classify_live_order_reconciliation`` /
    ``main._execution_preview_requires_reduce_only`` without creating a
    circular import.  Resolution is deferred to call time; raising here is
    safer than failing at import.
    """

    module = sys.modules.get("main")
    if module is None:
        raise RuntimeError(
            "ExecutionEngine 调度依赖的 ``main`` 模块尚未加载，无法访问 "
            "_classify_live_order_reconciliation。"
        )
    return module


def _wrap_order_record_as_active_exchange_order(
    record: OrderRecord, *, intent: ExecutionIntent
) -> ActiveExchangeOrder:
    """Coerce a legacy :class:`OrderRecord` into the typed
    :class:`ActiveExchangeOrder` shape that :class:`ExecutionDecision`
    expects.

    The legacy reconciliation classifier returns plain :class:`OrderRecord`
    instances; the engine wraps them with ``intent_id`` / ``state`` / etc.
    so downstream consumers (R130 diff helper, R131 audit emission) read a
    typed record.  Wave-3-A keeps ``intent_id=None`` and
    ``exchange_link_id=None`` on shadow-wrapped orders because the legacy
    path has not stamped these fields onto its own orders; F.3 onwards the
    engine populates them at the source.
    """

    return ActiveExchangeOrder(
        order=record,
        intent_id=intent.intent_id,
        exchange_link_id=intent.exchange_link_id,
        state="ACKED",
        last_known_status=record.status,
    )


class ExecutionEngine:
    """Coordinator owning the unified execution pipeline (P0-4.2).

    The engine is **stateless** — it does not own any singletons or caches;
    every method takes the dependencies it needs through the constructor and
    reads runtime state from ``repo.snapshot()``.  This matches the R118
    :class:`~risk_engine.RiskEngine` shape so call-sites can pivot to the new
    engine without restructuring their lock / repository discipline.

    Round 125 lands the module skeleton only.  ``compute_decision`` arrives in
    R128 (wraps :func:`main._classify_live_order_reconciliation` /
    :meth:`risk_engine.RiskEngine.evaluate_preview` into one typed
    :class:`~models.ExecutionDecision`).  ``execute`` / ``recover`` raise
    until F.2 / F.4.
    """

    __slots__ = ("_repo", "_persistence", "_risk_engine", "_clock")

    def __init__(
        self,
        repo: "AppRepository",
        persistence: Any,
        risk_engine: "RiskEngine",
        clock: Optional[Any] = None,
    ) -> None:
        """Wire the engine to its collaborators.

        :param repo: :class:`repository.AppRepository` instance — the engine
            reads ``state.json``-backed strategies / orders through
            ``repo.snapshot()`` and writes audit events through
            ``repo.add_event``.  Wave-3-A keeps this a soft reference (no
            ownership transfer) since the legacy dispatcher is still the
            primary writer.
        :param persistence: :class:`~persistence.unit_of_work.PersistenceUnit`
            factory or ``None`` (Wave-3-A tolerates absence; SQLite writes
            land in F.2).  Held as ``Any`` to keep the import surface small
            until the executor branch needs it.
        :param risk_engine: :class:`~risk_engine.RiskEngine` singleton — the
            engine routes preview-side risk verdicts through this layer so
            shadow + live paths share one decision graph (R118).
        :param clock: optional monotonic clock callable returning a
            ``datetime``-compatible value; defaults to UTC ``datetime.now``
            via :func:`datetime.datetime.now` in concrete implementations.
        """

        self._repo = repo
        self._persistence = persistence
        self._risk_engine = risk_engine
        self._clock = clock

    def compute_decision(
        self,
        intent: ExecutionIntent,
        state: Any,
    ) -> ExecutionDecision:
        """Pure function: derive the next :class:`ExecutionDecision` for
        ``intent`` against the supplied ``state`` snapshot.  No I/O, no
        repository writes.

        Round 129 lands the implementation as a byte-equivalent wrapper
        around the legacy dispatch branching:

        * **Paper mode** — the legacy ``_dispatch_paper_intent`` always
          calls ``repo.execute_strategy_signal`` to write a fresh trade;
          the engine surfaces this as ``verb="submit"`` with
          ``target_order=None`` and a synthetic ``reason_code="paper.submit"``.
          No reconciliation exists in paper mode (Paper trades do not
          create resting orders).
        * **Live / Demo mode** — delegate to
          :func:`main._classify_live_order_reconciliation` to produce the
          same 4-way reason-code classification the legacy
          ``_dispatch_live_intent`` consumes
          (``order.matches_target`` / ``order.differs_numeric`` /
          ``order.requires_reduce_only`` / ``order.no_existing_match``),
          then translate the typed
          :class:`~models.LiveOrderReconciliation.action` into the engine's
          :class:`~models.ExecutionVerb` literal:

            * ``"reuse"`` → ``"keep"``  (existing order already matches)
            * ``"amend"`` → ``"amend"``
            * ``"submit"`` → ``"submit"``

        ``decision.intent`` is the input intent verbatim.
        ``decision.target_order`` wraps the matching :class:`OrderRecord`
        into a typed :class:`ActiveExchangeOrder` for ``"keep"`` / ``"amend"``
        (and stays ``None`` for ``"submit"``).  ``stale_orders`` is the
        legacy classifier's ``stale_orders`` list, also wrapped.
        ``new_order_request`` is populated for ``"submit"`` / ``"amend"``
        with the engine-formatted :class:`NewOrderRequest`; ``"keep"`` does
        not need a new RPC payload so it stays ``None``.

        The function is **pure**: it does not write SQLite, does not call
        Bybit RPCs, does not mutate ``state``.  Wave-3-A's Shadow Mode
        relies on this purity guarantee to spawn the engine alongside the
        legacy path without side effects.
        """

        # Paper mode: the legacy dispatcher always submits.  The engine
        # produces a typed ``submit`` decision with a synthetic reason code
        # so the diff helper (R130) can match it against the legacy path.
        if intent.mode == AccountMode.PAPER:
            new_request = NewOrderRequest(
                strategy_id=intent.strategy_id,
                symbol=intent.symbol,
                market=intent.market,
                mode=intent.mode,
                side=intent.side,
                quantity=intent.quantity,
                price=intent.price,
                reduce_only=False,
                note=intent.note,
                exchange_link_id=intent.exchange_link_id,
            )
            return ExecutionDecision(
                verb="submit",
                intent=intent,
                target_order=None,
                stale_orders=[],
                new_order_request=new_request,
                risk_decision=intent.decision,
                reason_code="paper.submit",
                reason_detail="Paper 模式：写入新成交（引擎影子决策）。",
            )

        # Live / Demo mode: delegate the reconciliation classification to
        # the existing helper and translate its action -> verb.
        main_mod = _resolve_main_module()
        existing_orders = self._collect_existing_strategy_orders(intent, main_mod)
        requires_reduce_only = main_mod._execution_preview_requires_reduce_only(
            intent.preview
        )
        reconciliation: LiveOrderReconciliation = (
            main_mod._classify_live_order_reconciliation(
                intent,
                existing_orders,
                requires_reduce_only=requires_reduce_only,
            )
        )

        verb = _LIVE_ACTION_TO_VERB[reconciliation.action]
        target_order: Optional[ActiveExchangeOrder] = None
        if reconciliation.matching_order is not None:
            target_order = _wrap_order_record_as_active_exchange_order(
                reconciliation.matching_order, intent=intent
            )
        stale_orders = [
            _wrap_order_record_as_active_exchange_order(stale, intent=intent)
            for stale in reconciliation.stale_orders
        ]

        # Build ``new_order_request`` for verbs that need a fresh / amended
        # RPC payload.  ``keep`` reuses the existing order verbatim, so no
        # request payload is needed.
        new_request: Optional[NewOrderRequest] = None
        if verb in ("submit", "amend"):
            new_request = NewOrderRequest(
                strategy_id=intent.strategy_id,
                symbol=intent.symbol,
                market=intent.market,
                mode=intent.mode,
                side=intent.side,
                quantity=intent.quantity,
                price=intent.price,
                reduce_only=requires_reduce_only,
                note=intent.note,
                exchange_link_id=intent.exchange_link_id,
            )

        return ExecutionDecision(
            verb=verb,
            intent=intent,
            target_order=target_order,
            stale_orders=stale_orders,
            new_order_request=new_request,
            risk_decision=intent.decision,
            reason_code=reconciliation.reason_code,
            reason_detail=reconciliation.reason_detail,
        )

    def _collect_existing_strategy_orders(
        self, intent: ExecutionIntent, main_mod: Any
    ) -> List[OrderRecord]:
        """Read open Bybit-private orders attributed to ``intent``'s
        strategy / symbol / market, mirroring
        :func:`main._dispatch_live_intent`'s lookup so the engine sees the
        same input set the legacy reconciliation does.

        Pure read — uses the same ``parse_open_orders`` shortcut the legacy
        path uses.  Returns ``[]`` when no orders are attributed.
        """

        return [
            item
            for item in main_mod.parse_open_orders(use_private_only=True)
            if item.source == "bybit_private"
            and item.origin == "strategy"
            and item.strategy_id == intent.strategy_id
            and item.symbol == intent.symbol
            and item.market == intent.market
        ]

    def execute(
        self,
        decision: ExecutionDecision,
    ) -> ExecutionResult:
        """Realise a :class:`ExecutionDecision` against the appropriate
        backend (paper write / Bybit RPC).  Routes by ``decision.verb`` to
        ``_apply_paper`` / ``_apply_live`` / ``_apply_amend`` /
        ``_apply_cancel`` / ``_apply_noop`` (private; signatures land with
        their respective wave-3-B / wave-3-C commits).  All SQLite writes
        happen inside a :class:`~persistence.unit_of_work.PersistenceUnit`
        context.

        :raises NotImplementedError: ``execute`` ships in F.2 (Paper) and
            F.3 (Demo / Live).  Round 125 keeps the signature only.
        """

        raise NotImplementedError(
            "ExecutionEngine.execute lands in wave-3-B (F.2 Paper)"
        )

    def recover(
        self,
        state: Any,
        exchange_state: Any,
    ) -> RecoveryReport:
        """Cold-start three-way reconcile per ``P0-4.2`` §E.1.  Reads the
        persisted local authority (``state.json`` / SQLite), the exchange
        authority (``BybitPrivate.fetch_open_orders``), and produces a
        :class:`RecoveryReport` describing reattached intents, divergences,
        and orphaned orders that need operator attention.

        :raises NotImplementedError: ``recover`` ships in F.4 (wave-3-D).
        """

        raise NotImplementedError(
            "ExecutionEngine.recover lands in wave-3-D (F.4 Live)"
        )


__all__ = ["ExecutionEngine"]
