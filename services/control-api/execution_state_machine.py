"""Round 125 — Execution state graph for P0-4.2 §C.

Pure data + pure validators.  No I/O, no global state.  Imported by both
:mod:`execution_engine` and :mod:`execution_diff` so the legal-transition
table has one owner.

Wave-3-A ships:
    * The 9 typed state names (§C.1).
    * The terminal-state set used by §C.3 invariants.
    * The :class:`ExecutionStateGraph` placeholder; Round 128 fills the
      ``LEGAL_TRANSITIONS`` mapping per §C.2.
    * :func:`validate_transition` — gates round-trip property tests in
      ``ExecutionStateMachineRound126Tests`` once R128 lands the table.
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


class ExecutionStateGraph:
    """Static legal-transition table sourced from
    ``docs/P0-4.2-execution-engine-design.md`` §C.2.

    Round 125 lands the placeholder shape; Round 126 fills
    :attr:`LEGAL_TRANSITIONS` row by row from the design doc.  Once filled,
    ``LEGAL_TRANSITIONS[(from_state, event)] -> to_state`` is the canonical
    contract; new transitions go through this table or fail
    :func:`validate_transition`.
    """

    LEGAL_TRANSITIONS: Mapping[Tuple[str, str], str] = {}


def validate_transition(from_state: str, event: str, to_state: str) -> bool:
    """Return ``True`` if ``(from_state, event) -> to_state`` is in
    :attr:`ExecutionStateGraph.LEGAL_TRANSITIONS`.

    Round 125 returns ``False`` unconditionally because the table is empty;
    Round 126 lands the real table and turns this into the actual
    membership check.
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
    "ExecutionStateGraph",
    "validate_transition",
]
