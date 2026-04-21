"""Single source of truth for reading strategy parameters.

Round A of the production-grade quant-core adapter consolidation.

Prior to this module three sites each owned a near-duplicate copy of
"read the top-level scalar first, fall back to the legacy
``StrategySummary.parameters`` row":

* ``strategy_runtime._param_value`` (per-key float lookup)
* ``backtest_engine._parameter_map`` (bulk overlay onto the parameter dict)
* ``repository._STRATEGY_TOP_LEVEL_SCALAR_FIELDS`` (write-side whitelist used
  by ``_apply_parameter_patch``)

Each site tracked its own whitelist. A field added to one whitelist but not
the others was silently ignored on whichever path missed the update — the
exact failure mode Round 50's Codex review flagged.

This module centralises the whitelists and the dual-read implementation so
the runtime evaluator, the backtest runner and the persistence path all see
the same effective parameter value for a given strategy.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict

if TYPE_CHECKING:  # pragma: no cover - import only for type checkers
    from models import StrategySummary


# Scalar top-level fields on ``StrategySummary`` that mirror rows in
# ``strategy.parameters``. Assignable via ``setattr(strategy, key, value)``
# so ``repository._apply_parameter_patch`` can route edits straight onto the
# strategy record instead of appending another legacy parameter row.
STRATEGY_TOP_LEVEL_SCALAR_FIELDS: frozenset[str] = frozenset({
    "trailing_stop_pct",
    "break_even_trigger_pct",
    "volatility_sizing_enabled",
    "volatility_lookback",
    "volatility_target_pct",
    "confidence_calibration_enabled",
    "confidence_parameter_drift_penalty",
    "confidence_multi_timeframe_alignment",
    "roc_window",
    "ema_trend_window",
    "momentum_threshold_pct",
    "bollinger_window",
    "bollinger_std",
    "squeeze_bandwidth_pct",
    "rsi_window",
    "rsi_overbought",
    "rsi_oversold",
})


# Boolean opt-in toggles carried at the top level. They participate in
# ``STRATEGY_TOP_LEVEL_SCALAR_FIELDS`` (the write-side whitelist) but not in
# the runner overlay below, because the runners / evaluators consume them
# directly via ``getattr`` rather than routing them through the numeric
# parameter dict.
_TOP_LEVEL_BOOL_FIELDS: frozenset[str] = frozenset({
    "volatility_sizing_enabled",
    "confidence_calibration_enabled",
    "confidence_multi_timeframe_alignment",
})


# Numeric subset of the scalar whitelist that the backtest runner and the
# runtime kernels overlay onto the parameter dict. Derived rather than hand-
# maintained so a new scalar field automatically shows up on the overlay
# path unless it is explicitly marked as a boolean toggle.
STRATEGY_TOP_LEVEL_RUNNER_FIELDS: tuple[str, ...] = tuple(
    sorted(STRATEGY_TOP_LEVEL_SCALAR_FIELDS - _TOP_LEVEL_BOOL_FIELDS)
)


def resolve(strategy: "StrategySummary", key: str, default: Any = None) -> Any:
    """Return the effective strategy parameter value for ``key``.

    Top-level attribute wins when populated (not ``None``); otherwise we
    fall back to the matching row in ``strategy.parameters``; otherwise the
    caller-supplied ``default``.
    """

    top_level = getattr(strategy, key, None)
    if top_level is not None:
        return top_level
    parameter = next((item for item in strategy.parameters if item.key == key), None)
    if parameter is None:
        return default
    return parameter.value


def resolve_float(strategy: "StrategySummary", key: str, default: float) -> float:
    """Float-typed variant of :func:`resolve`.

    Non-numeric values (``None``, unparsable strings) on either source are
    skipped and the next source is consulted, matching the pre-consolidation
    behaviour of ``strategy_runtime._param_value``.
    """

    top_level = getattr(strategy, key, None)
    if top_level is not None:
        try:
            return float(top_level)
        except (TypeError, ValueError):
            pass
    parameter = next((item for item in strategy.parameters if item.key == key), None)
    if parameter is None:
        return default
    try:
        return float(parameter.value)
    except (TypeError, ValueError):
        return default


def build_parameter_map(strategy: "StrategySummary") -> Dict[str, object]:
    """Return the merged parameter dict used by the backtest runner.

    Starts from ``strategy.parameters`` (legacy rows) and overlays any
    populated top-level scalar numeric field on top. ``None`` top-level
    values skip the overlay so a migrated-but-unset field does not clobber a
    legacy row.
    """

    mapping: Dict[str, object] = {param.key: param.value for param in strategy.parameters}
    for field_name in STRATEGY_TOP_LEVEL_RUNNER_FIELDS:
        value = getattr(strategy, field_name, None)
        if value is not None:
            mapping[field_name] = value
    return mapping


def snapshot_parameters(strategy: "StrategySummary") -> Dict[str, Any]:
    """Canonical, JSON-serialisable snapshot of the parameters in effect for
    ``strategy`` at call time.

    Round B extends the strategy execution audit trail with a frozen
    parameter snapshot attached to every ``ExecutionEvent`` emitted by the
    Paper execution path. The snapshot is the union of:

    * the numeric merge from :func:`build_parameter_map` (legacy
      ``strategy.parameters`` rows overlaid by the Round-47/49 top-level
      scalar fields), and
    * the three boolean opt-in toggles (``volatility_sizing_enabled``,
      ``confidence_calibration_enabled``,
      ``confidence_multi_timeframe_alignment``) which live at the top level
      but do not participate in the numeric overlay, and
    * the Round-47 ``kernel`` selector when set.

    Only populated values land in the returned dict — ``None`` entries are
    dropped so an audit consumer can distinguish "not configured" from
    "explicitly zero". The snapshot is read-only with respect to ``strategy``;
    callers may persist, serialise or diff it without affecting runtime state.
    """

    snapshot: Dict[str, Any] = dict(build_parameter_map(strategy))
    for bool_field in _TOP_LEVEL_BOOL_FIELDS:
        value = getattr(strategy, bool_field, None)
        if value is not None:
            snapshot[bool_field] = bool(value)
    kernel = getattr(strategy, "kernel", None)
    if kernel is not None:
        snapshot["kernel"] = kernel
    return snapshot
