"""Round 125 — Unified ExecutionEngine for P0-4.2 §F.1 Shadow Mode.

Coordinator that owns the (compute_decision → execute → recover) pipeline.
See ``docs/P0-4.2-execution-engine-design.md`` §B-§E for the full contract;
this module is intended to become the single owner of every Bybit RPC dispatch
path (paper / demo / live).  Round 125 lands the **module skeleton only**:

* Public signatures + docstrings as specified in
  ``docs/P0-4.2-implementation-roadmap-2026-04-27.md`` §B.1.
* Bodies raise :class:`NotImplementedError` until later rounds (R128 lands
  ``compute_decision``; ``execute`` / ``recover`` arrive in wave-3-B/D).

Wave-3-A scope discipline (mirrors R118 RiskEngine):
    * **No behaviour change.** Importing this module must not affect any of
      the 876 pytest tests.  The class is constructed lazily by ``main.py``
      after this module imports; no top-level side effects.
    * **No coupling to ``main.py`` at import time.** The engine resolves
      dependencies through constructor injection, not module-level imports
      from ``main`` (which would create a circular import — see R117).
    * **Shadow-only invocation in F.1.** ``compute_decision`` is a pure
      function and may be called from ``main._dispatch_execution_intent``
      *before* the legacy paper / live branches return; ``execute`` /
      ``recover`` stay raising until wave-3-B onwards.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional

from models import (
    ActiveExchangeOrder,  # noqa: F401  # imported for docstring linkage
    ExecutionDecision,
    ExecutionIntent,
    ExecutionResult,
    RecoveryReport,
)

if TYPE_CHECKING:  # pragma: no cover - typing-only imports
    from repository import AppRepository
    from risk_engine import RiskEngine


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

        Round 128 lands the implementation as a thin wrapper around the
        existing :func:`main._classify_live_order_reconciliation` (live
        branch) and an unconditional ``submit``-equivalent verb for paper
        mode; the resulting :class:`ExecutionDecision` is byte-equivalent to
        the legacy dispatcher's branching, surfaced as a typed record so
        Shadow Mode can compare it against the legacy path (F.1).

        :raises NotImplementedError: until R128 ships.
        """

        raise NotImplementedError(
            "ExecutionEngine.compute_decision lands in Round 128 (wave-3-A F.1)"
        )

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
