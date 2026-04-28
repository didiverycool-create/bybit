"""Round 125-126 — Execution state graph for P0-4.2 §C.

Pure data + pure validators.  No I/O, no global state.  Imported by both
:mod:`execution_engine` and :mod:`execution_diff` so the legal-transition
table has one owner.

Wave-3-A ships:
    * R125 — the 9 typed state names (§C.1) and the terminal-state set
      used by §C.3 invariants; :class:`ExecutionStateGraph` placeholder.
    * R126 — :attr:`ExecutionStateGraph.LEGAL_TRANSITIONS` populated row by
      row from the ``docs/P0-4.2-execution-engine-design.md`` §C.2 table,
      and :func:`validate_transition` flipped from "always-False
      placeholder" to a real membership check.
"""

from __future__ import annotations

from typing import FrozenSet, Mapping, Tuple

# §C.1 — 9 typed states.
EXECUTION_STATE_PROPOSED = "PROPOSED"
EXECUTION_STATE_PREVIEWED = "PREVIEWED"
EXECUTION_STATE_ROUTED = "ROUTED"
EXECUTION_STATE_ACKED = "ACKED"
EXECUTION_STATE_PARTIALLY_FILLED = "PARTIALLY_FILLED"
EXECUTION_STATE_FILLED = "FILLED"
EXECUTION_STATE_CANCELED = "CANCELED"
EXECUTION_STATE_REJECTED = "REJECTED"
EXECUTION_STATE_EXTERNALLY_MODIFIED = "EXTERNALLY_MODIFIED"

EXECUTION_STATES: FrozenSet[str] = frozenset(
    {
        EXECUTION_STATE_PROPOSED,
        EXECUTION_STATE_PREVIEWED,
        EXECUTION_STATE_ROUTED,
        EXECUTION_STATE_ACKED,
        EXECUTION_STATE_PARTIALLY_FILLED,
        EXECUTION_STATE_FILLED,
        EXECUTION_STATE_CANCELED,
        EXECUTION_STATE_REJECTED,
        EXECUTION_STATE_EXTERNALLY_MODIFIED,
    }
)

EXECUTION_TERMINAL_STATES: FrozenSet[str] = frozenset(
    {
        EXECUTION_STATE_FILLED,
        EXECUTION_STATE_CANCELED,
        EXECUTION_STATE_REJECTED,
        EXECUTION_STATE_EXTERNALLY_MODIFIED,
    }
)


# §C.2 — typed event names that trigger transitions.  Captured as module-level
# constants so call-sites and tests share one spelling (no substring matching).
EXECUTION_EVENT_BUILD_PREVIEW = "build_execution_preview"
EXECUTION_EVENT_RISK_ALLOW = "risk.allow"
EXECUTION_EVENT_RISK_BLOCK = "risk.block"
EXECUTION_EVENT_VERB_NOOP = "verb.noop"
EXECUTION_EVENT_BYBIT_CREATE_OK = "bybit.create_order.ok"
EXECUTION_EVENT_BYBIT_AMEND_OK = "bybit.amend_order.ok"
EXECUTION_EVENT_BYBIT_CANCEL_OK = "bybit.cancel.ok"
EXECUTION_EVENT_BYBIT_TIMEOUT = "bybit.timeout_or_5xx"
EXECUTION_EVENT_WS_PARTIAL_FILL = "ws.order.partial_fill"
EXECUTION_EVENT_WS_FILL = "ws.order.fill"
EXECUTION_EVENT_WS_CANCEL_OWN = "ws.order.cancel.own"
EXECUTION_EVENT_WS_CANCEL_EXTERNAL = "ws.order.cancel.external"
EXECUTION_EVENT_WS_AMEND_EXTERNAL = "ws.order.amend.external"
EXECUTION_EVENT_WS_REJECT = "ws.order.reject"
EXECUTION_EVENT_TTL_EXCEEDED = "ttl_exceeded"
EXECUTION_EVENT_OPERATOR_ACK = "operator.ack"


class ExecutionStateGraph:
    """Static legal-transition table sourced from
    ``docs/P0-4.2-execution-engine-design.md`` §C.2.

    Round 125 lands the placeholder shape; Round 126 fills
    :attr:`LEGAL_TRANSITIONS` row by row from the design doc.  Once filled,
    ``LEGAL_TRANSITIONS[(from_state, event)] -> to_state`` is the canonical
    contract; new transitions go through this table or fail
    :func:`validate_transition`.

    The table mirrors §C.2 verbatim:

    * ``PROPOSED → PREVIEWED`` on ``build_execution_preview`` (pure compute).
    * ``PREVIEWED → ROUTED`` on ``risk.allow`` (verb implies the verbatim
      ``submit`` / ``amend`` / ``cancel_and_resubmit`` / ``cancel_only``
      branches; the table treats ``risk.allow`` as the umbrella event so the
      engine writes ``execution.routed`` once per allow regardless of verb
      choice — verb selection is upstream of the state machine).
    * ``PREVIEWED`` → terminal ``blocked`` / ``noop`` are not modelled as
      state-machine targets here; they short-circuit before ``ROUTED`` and
      land directly on the dispatcher's ``ExecutionResult`` terminal.
    * Self-loops on ``ROUTED`` (``bybit.timeout_or_5xx``) and ``ACKED``
      (``ttl_exceeded``) are explicitly excluded from this table — they are
      retry / probe triggers rather than state transitions; the engine
      handles them via §D.3 retry logic without flipping the local state.
    * ``EXTERNALLY_MODIFIED → EXTERNALLY_MODIFIED`` on ``operator.ack`` is
      modelled as a self-loop because the design carries the "ack" as a
      derived flag on the same state (``acknowledged_at`` field on the
      future :class:`ActiveExchangeOrder`); the state itself stays terminal
      until a *new* :class:`ExecutionIntent` is built (different
      ``intent_id``), at which point the new intent enters the graph at
      ``PROPOSED`` rather than continuing this transition row.
    """

    LEGAL_TRANSITIONS: Mapping[Tuple[str, str], str] = {
        # PROPOSED → PREVIEWED on the preview-build event.
        (EXECUTION_STATE_PROPOSED, EXECUTION_EVENT_BUILD_PREVIEW): (
            EXECUTION_STATE_PREVIEWED
        ),
        # PREVIEWED → ROUTED on a risk.allow verdict (any executable verb).
        (EXECUTION_STATE_PREVIEWED, EXECUTION_EVENT_RISK_ALLOW): (
            EXECUTION_STATE_ROUTED
        ),
        # ROUTED → ACKED on Bybit create/amend success.
        (EXECUTION_STATE_ROUTED, EXECUTION_EVENT_BYBIT_CREATE_OK): (
            EXECUTION_STATE_ACKED
        ),
        (EXECUTION_STATE_ROUTED, EXECUTION_EVENT_BYBIT_AMEND_OK): (
            EXECUTION_STATE_ACKED
        ),
        # ROUTED → CANCELED on Bybit cancel success (cancel_only verb).
        (EXECUTION_STATE_ROUTED, EXECUTION_EVENT_BYBIT_CANCEL_OK): (
            EXECUTION_STATE_CANCELED
        ),
        # ACKED → PARTIALLY_FILLED / FILLED / CANCELED / REJECTED.
        (EXECUTION_STATE_ACKED, EXECUTION_EVENT_WS_PARTIAL_FILL): (
            EXECUTION_STATE_PARTIALLY_FILLED
        ),
        (EXECUTION_STATE_ACKED, EXECUTION_EVENT_WS_FILL): (
            EXECUTION_STATE_FILLED
        ),
        (EXECUTION_STATE_ACKED, EXECUTION_EVENT_WS_CANCEL_OWN): (
            EXECUTION_STATE_CANCELED
        ),
        (EXECUTION_STATE_ACKED, EXECUTION_EVENT_WS_CANCEL_EXTERNAL): (
            EXECUTION_STATE_EXTERNALLY_MODIFIED
        ),
        (EXECUTION_STATE_ACKED, EXECUTION_EVENT_WS_AMEND_EXTERNAL): (
            EXECUTION_STATE_EXTERNALLY_MODIFIED
        ),
        (EXECUTION_STATE_ACKED, EXECUTION_EVENT_WS_REJECT): (
            EXECUTION_STATE_REJECTED
        ),
        # PARTIALLY_FILLED → FILLED / CANCELED.
        (EXECUTION_STATE_PARTIALLY_FILLED, EXECUTION_EVENT_WS_FILL): (
            EXECUTION_STATE_FILLED
        ),
        (EXECUTION_STATE_PARTIALLY_FILLED, EXECUTION_EVENT_WS_CANCEL_OWN): (
            EXECUTION_STATE_CANCELED
        ),
    }


def validate_transition(from_state: str, event: str, to_state: str) -> bool:
    """Return ``True`` iff ``(from_state, event) -> to_state`` matches a row
    in :attr:`ExecutionStateGraph.LEGAL_TRANSITIONS`.

    Unknown ``from_state`` / ``to_state`` arguments always fail (no implicit
    fallthrough); ``event`` is matched verbatim so callers must use the
    ``EXECUTION_EVENT_*`` module constants.
    """

    if from_state not in EXECUTION_STATES:
        return False
    if to_state not in EXECUTION_STATES:
        return False
    return ExecutionStateGraph.LEGAL_TRANSITIONS.get((from_state, event)) == to_state


__all__ = [
    "EXECUTION_STATE_PROPOSED",
    "EXECUTION_STATE_PREVIEWED",
    "EXECUTION_STATE_ROUTED",
    "EXECUTION_STATE_ACKED",
    "EXECUTION_STATE_PARTIALLY_FILLED",
    "EXECUTION_STATE_FILLED",
    "EXECUTION_STATE_CANCELED",
    "EXECUTION_STATE_REJECTED",
    "EXECUTION_STATE_EXTERNALLY_MODIFIED",
    "EXECUTION_STATES",
    "EXECUTION_TERMINAL_STATES",
    "EXECUTION_EVENT_BUILD_PREVIEW",
    "EXECUTION_EVENT_RISK_ALLOW",
    "EXECUTION_EVENT_RISK_BLOCK",
    "EXECUTION_EVENT_VERB_NOOP",
    "EXECUTION_EVENT_BYBIT_CREATE_OK",
    "EXECUTION_EVENT_BYBIT_AMEND_OK",
    "EXECUTION_EVENT_BYBIT_CANCEL_OK",
    "EXECUTION_EVENT_BYBIT_TIMEOUT",
    "EXECUTION_EVENT_WS_PARTIAL_FILL",
    "EXECUTION_EVENT_WS_FILL",
    "EXECUTION_EVENT_WS_CANCEL_OWN",
    "EXECUTION_EVENT_WS_CANCEL_EXTERNAL",
    "EXECUTION_EVENT_WS_AMEND_EXTERNAL",
    "EXECUTION_EVENT_WS_REJECT",
    "EXECUTION_EVENT_TTL_EXCEEDED",
    "EXECUTION_EVENT_OPERATOR_ACK",
    "ExecutionStateGraph",
    "validate_transition",
]
