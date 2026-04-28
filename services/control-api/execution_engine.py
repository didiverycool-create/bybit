"""Round 125-132 — Unified ExecutionEngine for P0-4.2 §F.1+§F.2.

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

Wave-3-B milestones (Paper Mode — §F.2):

* R132 — :meth:`ExecutionEngine.execute` paper branch lands via the private
  :meth:`_apply_paper` helper.  The branch wraps
  ``repo.execute_strategy_signal`` so the produced :class:`models.TradeRecord`
  is byte-equivalent to the legacy ``main._dispatch_paper_intent`` output;
  the engine wraps the resulting :class:`models.StrategyExecutionResult`
  into a typed :class:`models.ExecutionResult` (status="submitted",
  final_state="ROUTED", error_detail=None on success).  ``execute`` for
  live verbs continues to raise until F.3 (wave-3-C).

``recover`` continues to raise until wave-3-D.

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
      *before* the legacy paper / live branches return.  ``execute`` lands
      its paper branch in F.2 (R132) gated behind the
      ``execution_engine.paper`` feature flag (default ``False``); ``recover``
      stays raising until wave-3-D.
"""

from __future__ import annotations

import json
import sqlite3
import sys
import warnings
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from uuid import uuid4

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
    StrategyExecutionResult,
)
from execution_state_machine import (
    EXECUTION_STATE_PROPOSED,
    EXECUTION_STATE_PREVIEWED,
    EXECUTION_STATE_ROUTED,
)

if TYPE_CHECKING:  # pragma: no cover - typing-only imports
    from types import ModuleType

    from repository import AppRepository
    from risk_engine import RiskEngine


# In-memory fallback store for execution_events when no SQLite connection is
# bound (Round 133 — wave-3-B §F.2 commit 2).  The roadmap requires the
# engine to write PROPOSED → PREVIEWED → ROUTED rows on every paper execute;
# when the engine is constructed with ``persistence=None`` (the default in
# wave-3-B until SQLite is wired into ``main.py``) the engine falls back to
# this list and emits a single warn log so operators can see the writes are
# not durable yet.  Tests inspect this list to verify the row content.
_IN_MEMORY_EXECUTION_EVENTS: List[Dict[str, Any]] = []
_IN_MEMORY_FALLBACK_WARNED = False


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


def _resolve_persistence_connection(persistence: Any) -> Optional[sqlite3.Connection]:
    """Coerce the engine's ``persistence`` constructor argument into a usable
    :class:`sqlite3.Connection` or ``None``.

    Round 133 — wave-3-B §F.2 commit 2 needs a forgiving resolver because the
    engine is currently constructed with ``persistence=None`` in ``main.py``;
    when wave-3-C wires SQLite this argument will hold either:

    * a bare :class:`sqlite3.Connection` (test fixtures pass this directly), or
    * a :class:`persistence.unit_of_work.PersistenceUnit` (wraps a
      connection — exposed via the ``connection`` property), or
    * an arbitrary object that holds the connection on a ``connection`` /
      ``conn`` attribute (extension shape — keep the resolver tolerant so
      future producers do not have to invent yet another protocol).

    Returns ``None`` when none of the above apply; callers use this to fall
    back to the in-memory store and emit a warn log.
    """

    if persistence is None:
        return None
    if isinstance(persistence, sqlite3.Connection):
        return persistence
    for attr in ("connection", "conn"):
        candidate = getattr(persistence, attr, None)
        if isinstance(candidate, sqlite3.Connection):
            return candidate
    return None


def _serialise_execution_payload(decision: ExecutionDecision, state_to: str) -> str:
    """Build the ``payload_json`` field for an execution_events row.

    Captures enough context to replay the engine's reasoning later — the
    state-machine event name, the chosen verb, the intent's mode / symbol /
    side, and the risk decision summary.  Kept compact so SQLite row size
    stays predictable; full reconstruction (e.g. for shadow-parity) goes
    through ``audit_events`` which carry the verbose ``ExecutionPreview``
    body.
    """

    intent = decision.intent
    return json.dumps(
        {
            "state_to": state_to,
            "verb": decision.verb,
            "mode": intent.mode.value,
            "symbol": intent.symbol,
            "market": intent.market,
            "side": intent.side.value if hasattr(intent.side, "value") else str(intent.side),
            "quantity": intent.quantity,
            "price": intent.price,
            "reason_code": decision.reason_code,
            "risk_verdict": decision.risk_decision.verdict,
        },
        separators=(",", ":"),
        sort_keys=True,
    )


def _serialise_risk_decision(decision: ExecutionDecision) -> str:
    """JSON-encode the risk decision summary for the
    ``risk_decision_json`` column.  Mirrors the shape audit consumers
    already expect.
    """

    return json.dumps(
        {
            "verdict": decision.risk_decision.verdict,
            "reason_code": decision.risk_decision.reason_code,
        },
        separators=(",", ":"),
        sort_keys=True,
    )


def _emit_execution_event_row(
    *,
    connection: Optional[sqlite3.Connection],
    intent: ExecutionIntent,
    decision: ExecutionDecision,
    state_from: Optional[str],
    state_to: str,
    occurred_at: datetime,
    sequence_index: int,
) -> str:
    """Write one execution_events row (or append to the in-memory fallback)
    capturing a single state-machine transition.

    Returns the row id.  When ``connection`` is None the row is appended to
    :data:`_IN_MEMORY_EXECUTION_EVENTS` and a one-shot warn log is emitted.
    """

    global _IN_MEMORY_FALLBACK_WARNED

    # Compose a deterministic-ish id so callers can correlate the trio.
    # ULID would be ideal but we don't depend on a ULID lib in main; uuid4 +
    # short prefix is sufficient and matches the audit_events shape.
    row_id = f"ee-{uuid4().hex[:12]}"
    intent_id = intent.intent_id or f"intent-{uuid4().hex[:8]}"
    intent_seq = intent.intent_seq if intent.intent_seq is not None else 0

    # ``occurred_at`` carries microsecond precision but the table column is
    # TEXT; format with the ISO8601 / RFC3339 contract used elsewhere
    # (matches AuditDao + ConfigDao).  We add a +sequence_index*microsecond
    # delta so the same call's three rows do not collide on the
    # UNIQUE (intent_id, state_to, occurred_at) constraint when the wall
    # clock has insufficient resolution.
    ts = occurred_at.replace(microsecond=(occurred_at.microsecond + sequence_index) % 1_000_000)
    occurred_at_iso = ts.isoformat()

    row: Dict[str, Any] = {
        "id": row_id,
        "intent_id": intent_id,
        "intent_seq": intent_seq,
        "strategy_id": intent.strategy_id,
        "exchange_link_id": intent.exchange_link_id,
        "state_from": state_from,
        "state_to": state_to,
        "verb": decision.verb,
        "order_id": None,
        "risk_decision_json": _serialise_risk_decision(decision),
        "payload_json": _serialise_execution_payload(decision, state_to),
        "audit_event_id": None,
        "occurred_at": occurred_at_iso,
    }

    if connection is None:
        if not _IN_MEMORY_FALLBACK_WARNED:
            warnings.warn(
                "execution_engine.execution_events: SQLite connection not "
                "bound (persistence=None); falling back to in-memory store.",
                RuntimeWarning,
                stacklevel=3,
            )
            _IN_MEMORY_FALLBACK_WARNED = True
        _IN_MEMORY_EXECUTION_EVENTS.append(dict(row))
        return row_id

    # SQLite path: defer to the existing DAO so the schema contract stays
    # in one place.  Imported lazily to avoid pulling persistence at module
    # load time (the engine currently runs without persistence in tests).
    from persistence.dao_execution_event import ExecutionEventDao  # local import

    dao = ExecutionEventDao(connection)
    dao.insert(row)  # type: ignore[arg-type]
    connection.commit()
    return row_id


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

    __slots__ = (
        "_repo",
        "_persistence",
        "_risk_engine",
        "_clock",
        "_paper_idempotency_cache",
    )

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
        # R135 — Paper idempotency cache.  Keyed by ``(strategy_id, intent_seq)``
        # so a second submit with the same intent_seq returns the first
        # call's :class:`ExecutionResult` without re-executing
        # ``repo.execute_strategy_signal`` or re-emitting execution_events
        # rows.  Stores ``None`` for legacy intents (``intent_seq is None``)
        # so they remain "always re-execute" — matching the legacy
        # dispatcher's behaviour for desktop manual submits without a
        # generated sequence.
        self._paper_idempotency_cache: Dict[
            "tuple[str, int]", ExecutionResult
        ] = {}

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
        backend (paper write / Bybit RPC).  Routes by ``decision.intent.mode``
        to :meth:`_apply_paper` (R132) / :meth:`_apply_live` (F.3).

        Round 132 — wave-3-B §F.2 lands the paper branch.  When
        ``decision.intent.mode == AccountMode.PAPER`` the engine delegates
        to :meth:`_apply_paper`, which wraps the legacy
        ``repo.execute_strategy_signal`` write so the produced trade is
        byte-equivalent to ``main._dispatch_paper_intent``.  Live / demo
        verbs continue to raise until wave-3-C (F.3).

        :returns: a typed :class:`ExecutionResult` whose ``status`` /
            ``final_state`` / ``order`` faithfully reflect the realised
            paper write.  Paper trades do not produce a resting Bybit
            order (no exchange-side state) so ``order`` is ``None`` and
            ``final_state`` is ``ROUTED`` (the engine reaches "routed"
            for paper because there is no ACK loop — the local write is
            the terminal state for the paper path).
        :raises NotImplementedError: live / demo verbs ship in F.3.
        """

        if decision.intent.mode == AccountMode.PAPER:
            return self._apply_paper(decision)

        raise NotImplementedError(
            "ExecutionEngine.execute live branch lands in wave-3-C (F.3 Demo)"
        )

    def _apply_paper(self, decision: ExecutionDecision) -> ExecutionResult:
        """Realise a paper-mode :class:`ExecutionDecision` by delegating to
        the same ``repo.execute_strategy_signal`` helper the legacy
        ``main._dispatch_paper_intent`` uses.  The engine wraps the produced
        :class:`StrategyExecutionResult` into a typed
        :class:`ExecutionResult` so downstream callers (audit emission,
        shadow parity helper) can treat paper / live outcomes uniformly.

        Round 132 — wave-3-B §F.2 contract:

        * ``repo.execute_strategy_signal(strategy_id, requested_by, note)``
          is called with the same arguments the legacy dispatcher passes,
          so the resulting :class:`models.TradeRecord` is byte-equivalent
          (matched test: ``ExecutePaperBranchTests``).
        * ``main._clear_strategy_manual_execution_alerts`` is invoked
          afterwards so the operator sees recovery clear the same way the
          legacy path does.  The engine reaches into ``main`` through
          :func:`_resolve_main_module` (no circular import).
        * The returned :class:`ExecutionResult` carries
          ``status="submitted"`` (paper trades are always written, never
          blocked here — risk decision is upstream of execute), and
          ``final_state="ROUTED"`` because paper has no exchange ACK loop.
        * ``order=None`` because paper trades produce a
          :class:`TradeRecord`, not a resting :class:`OrderRecord`; the
          legacy paper :class:`StrategyExecutionResult.kind="paper_trade"`
          contract is preserved by the caller (the wrapper in
          ``main._dispatch_paper_intent``) which still owns the wire shape
          desktop consumes.

        Round 133 — wave-3-B §F.2 commit 2 adds three execution_events
        rows (PROPOSED → PREVIEWED → ROUTED) so the SQLite log shows the
        engine's traversal through the state machine for every paper
        execute.  When ``persistence`` is bound to a SQLite connection
        the rows go through :class:`ExecutionEventDao`; when it is
        ``None`` the rows are appended to an in-memory list and a
        one-shot ``RuntimeWarning`` is emitted (so dev fixtures keep
        working before SQLite is wired into ``main.py``).

        The engine does **not** mutate ``decision`` — the input is passed
        through verbatim.  ``ExecutionResult.intent_id`` is taken from
        ``decision.intent.intent_id`` when present, falling back to an
        empty string for legacy intents that pre-date R128.
        """

        intent = decision.intent
        main_mod = _resolve_main_module()

        # R135 — Idempotency dedup on (strategy_id, intent_seq).  When the
        # caller submits the same intent_seq twice (e.g. desktop double-
        # click, retry-on-timeout), return the cached
        # :class:`ExecutionResult` from the first call without re-writing
        # the trade or re-emitting execution_events rows.  Intents without
        # an ``intent_seq`` (``None`` — pre-R128 legacy callers) bypass
        # the cache so manual repeats still work as before.
        cache_key: Optional[tuple] = None
        if intent.intent_seq is not None:
            cache_key = (intent.strategy_id, int(intent.intent_seq))
            cached = self._paper_idempotency_cache.get(cache_key)
            if cached is not None:
                return cached

        # R133 — emit PROPOSED + PREVIEWED rows up front so the audit log
        # shows the engine's view *before* the legacy write happens.  Any
        # exception inside the legacy call is then captured against the
        # ROUTED row that follows.  The three rows share an ``occurred_at``
        # base + sequence index so they keep a strict ordering even on
        # systems where ``datetime.now`` lacks microsecond resolution.
        connection = _resolve_persistence_connection(self._persistence)
        occurred_at = datetime.now(timezone.utc)
        _emit_execution_event_row(
            connection=connection,
            intent=intent,
            decision=decision,
            state_from=None,
            state_to=EXECUTION_STATE_PROPOSED,
            occurred_at=occurred_at,
            sequence_index=0,
        )
        _emit_execution_event_row(
            connection=connection,
            intent=intent,
            decision=decision,
            state_from=EXECUTION_STATE_PROPOSED,
            state_to=EXECUTION_STATE_PREVIEWED,
            occurred_at=occurred_at,
            sequence_index=1,
        )

        trade = main_mod.repo.execute_strategy_signal(
            intent.strategy_id,
            intent.requested_by,
            intent.note,
        )
        main_mod._clear_strategy_manual_execution_alerts(
            intent.strategy_id,
            intent.mode,
            resolution_detail="后续 Paper 手动策略执行已恢复成功，旧的拦截提醒已收起。",
        )

        # ROUTED row lands after the legacy write completes successfully.
        # If the legacy call had raised, the helper would never reach this
        # row — leaving the trail at PREVIEWED, which downstream replay can
        # treat as "the engine started but did not finish" and reconcile.
        _emit_execution_event_row(
            connection=connection,
            intent=intent,
            decision=decision,
            state_from=EXECUTION_STATE_PREVIEWED,
            state_to=EXECUTION_STATE_ROUTED,
            occurred_at=occurred_at,
            sequence_index=2,
        )

        result = ExecutionResult(
            intent_id=intent.intent_id or "",
            status="submitted",
            final_state=EXECUTION_STATE_ROUTED,
            order=None,
            audit_event_ids=[],
            risk_decision=decision.risk_decision,
            error_detail=None,
        )

        # R135 — Cache the result so a subsequent call with the same
        # ``(strategy_id, intent_seq)`` short-circuits at the head of
        # ``_apply_paper``.  The cache lives on the engine instance, so
        # callers that share the singleton (``main.execution_engine``)
        # share the dedup state too.
        if cache_key is not None:
            self._paper_idempotency_cache[cache_key] = result

        return result

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


__all__ = [
    "ExecutionEngine",
    # R133 — exported for tests to inspect the in-memory fallback when no
    # SQLite connection is bound to the engine; production code should
    # never touch this list directly.
    "_IN_MEMORY_EXECUTION_EVENTS",
]
