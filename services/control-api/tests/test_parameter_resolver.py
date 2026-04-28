"""Round A — parameter_resolver consolidation regression guard.

Verifies that the runtime evaluator, the backtest runner and the persistence
path all read strategy parameters through ``parameter_resolver`` and see the
same effective value for any given key. Prior to Round A each site owned a
near-duplicate copy of the dual-read logic, and a new top-level scalar added
to one whitelist but forgotten on another would silently take effect on some
paths while being ignored on others.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any

CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import backtest_engine  # type: ignore  # noqa: E402
import parameter_resolver  # type: ignore  # noqa: E402
import strategy_runtime  # type: ignore  # noqa: E402
from models import AccountMode, StrategyParameter, StrategySummary  # type: ignore  # noqa: E402
from repository import AppRepository  # type: ignore  # noqa: E402


def _make_strategy(**overrides: Any) -> StrategySummary:
    base: dict[str, Any] = dict(
        id="resolver-01",
        name="ResolverHarness",
        category="template",
        status="running",
        symbols=["BTCUSDT"],
        mode=AccountMode.PAPER,
        version="v1",
        pnl_7d="+0.0%",
        max_drawdown="-0.0%",
        risk_budget="10%",
        description="parameter_resolver regression harness",
        parameters=[],
    )
    base.update(overrides)
    return StrategySummary(**base)


class ResolveBehaviourTests(unittest.TestCase):
    def test_top_level_wins_over_parameter_row(self) -> None:
        strategy = _make_strategy(
            roc_window=12,
            parameters=[StrategyParameter(key="roc_window", label="roc", value=99)],
        )
        self.assertEqual(parameter_resolver.resolve_float(strategy, "roc_window", 10.0), 12.0)
        self.assertEqual(parameter_resolver.resolve(strategy, "roc_window"), 12)

    def test_parameter_row_fallback_when_top_level_none(self) -> None:
        strategy = _make_strategy(
            roc_window=None,
            parameters=[StrategyParameter(key="roc_window", label="roc", value=5)],
        )
        self.assertEqual(parameter_resolver.resolve_float(strategy, "roc_window", 10.0), 5.0)
        self.assertEqual(parameter_resolver.resolve(strategy, "roc_window"), 5)

    def test_default_returned_when_neither_source_has_value(self) -> None:
        strategy = _make_strategy(roc_window=None, parameters=[])
        self.assertEqual(parameter_resolver.resolve_float(strategy, "roc_window", 10.0), 10.0)
        self.assertIsNone(parameter_resolver.resolve(strategy, "roc_window"))
        self.assertEqual(parameter_resolver.resolve(strategy, "roc_window", "fallback"), "fallback")

    def test_unparsable_top_level_falls_through_to_parameter_row_for_float(self) -> None:
        # getattr returns None for missing attributes, so we simulate the
        # "unparsable scalar" case with a free-form key routed through the
        # parameters list. ``resolve_float`` must still recover the legacy
        # float value rather than returning the default.
        strategy = _make_strategy(
            parameters=[StrategyParameter(key="fast_ma", label="fast", value="21")],
        )
        self.assertEqual(parameter_resolver.resolve_float(strategy, "fast_ma", 5.0), 21.0)


class WhitelistDriftGuardTests(unittest.TestCase):
    """Lock the runner / scalar whitelists together so a field added to one
    site cannot silently go missing on another.
    """

    def test_repository_shares_the_same_scalar_whitelist(self) -> None:
        self.assertIs(
            AppRepository._STRATEGY_TOP_LEVEL_SCALAR_FIELDS,
            parameter_resolver.STRATEGY_TOP_LEVEL_SCALAR_FIELDS,
        )

    def test_backtest_engine_shares_the_same_runner_whitelist(self) -> None:
        self.assertIs(
            backtest_engine._STRATEGY_TOP_LEVEL_RUNNER_FIELDS,
            parameter_resolver.STRATEGY_TOP_LEVEL_RUNNER_FIELDS,
        )

    def test_runner_whitelist_is_scalar_whitelist_minus_boolean_toggles(self) -> None:
        # Boolean opt-ins participate in the scalar whitelist (because the
        # persistence path stores them at the top level) but must not appear
        # on the runner overlay path (which only carries numeric parameter
        # values). Round A derives the runner tuple from the scalar set so
        # this invariant is structural, not hand-maintained.
        expected_bools = {
            "volatility_sizing_enabled",
            "confidence_calibration_enabled",
            "confidence_multi_timeframe_alignment",
        }
        runner = set(parameter_resolver.STRATEGY_TOP_LEVEL_RUNNER_FIELDS)
        scalar = set(parameter_resolver.STRATEGY_TOP_LEVEL_SCALAR_FIELDS)
        self.assertEqual(scalar - runner, expected_bools)
        self.assertTrue(runner.isdisjoint(expected_bools))


class CrossSiteConsistencyTests(unittest.TestCase):
    """Verify strategy_runtime and backtest_engine arrive at the same
    effective value for a field that only exists at the top level. Before
    Round A the two sites each ran their own dual-read; a regression on one
    side could silently diverge from the other.
    """

    def test_runtime_and_backtest_agree_on_top_level_only_field(self) -> None:
        strategy = _make_strategy(
            kernel="momentum",
            roc_window=7,
            ema_trend_window=13,
            momentum_threshold_pct=0.9,
        )
        self.assertEqual(strategy_runtime._param_value(strategy, "roc_window", 10.0), 7.0)
        mapping = backtest_engine._parameter_map(strategy)
        self.assertEqual(mapping["roc_window"], 7)
        self.assertEqual(mapping["ema_trend_window"], 13)
        self.assertEqual(mapping["momentum_threshold_pct"], 0.9)

    def test_runtime_and_backtest_agree_on_legacy_parameter_row(self) -> None:
        strategy = _make_strategy(
            parameters=[StrategyParameter(key="roc_window", label="roc", value=5)],
        )
        self.assertEqual(strategy_runtime._param_value(strategy, "roc_window", 10.0), 5.0)
        mapping = backtest_engine._parameter_map(strategy)
        self.assertEqual(mapping["roc_window"], 5)

    def test_runtime_and_backtest_agree_when_top_level_overrides_legacy_row(self) -> None:
        strategy = _make_strategy(
            roc_window=12,
            parameters=[StrategyParameter(key="roc_window", label="roc", value=99)],
        )
        self.assertEqual(strategy_runtime._param_value(strategy, "roc_window", 10.0), 12.0)
        mapping = backtest_engine._parameter_map(strategy)
        self.assertEqual(mapping["roc_window"], 12)


class SnapshotParametersTests(unittest.TestCase):
    """Round B — canonical snapshot used to freeze the parameters in effect
    at strategy execution time. Covers the numeric overlay, the three bool
    opt-in toggles that do not participate in :func:`build_parameter_map`,
    and the Round-47 ``kernel`` selector.
    """

    def test_snapshot_merges_legacy_rows_with_top_level_scalars(self) -> None:
        strategy = _make_strategy(
            roc_window=7,
            ema_trend_window=13,
            parameters=[
                StrategyParameter(key="roc_window", label="roc", value=99),
                StrategyParameter(key="fast_ma", label="fast", value=21),
            ],
        )
        snapshot = parameter_resolver.snapshot_parameters(strategy)
        self.assertEqual(snapshot["roc_window"], 7)  # top-level wins
        self.assertEqual(snapshot["ema_trend_window"], 13)  # top-level only
        self.assertEqual(snapshot["fast_ma"], 21)  # legacy row only

    def test_snapshot_includes_boolean_toggles_when_populated(self) -> None:
        strategy = _make_strategy(
            volatility_sizing_enabled=True,
            confidence_calibration_enabled=True,
            confidence_multi_timeframe_alignment=False,
        )
        snapshot = parameter_resolver.snapshot_parameters(strategy)
        self.assertIs(snapshot["volatility_sizing_enabled"], True)
        self.assertIs(snapshot["confidence_calibration_enabled"], True)
        self.assertIs(snapshot["confidence_multi_timeframe_alignment"], False)

    def test_snapshot_includes_kernel_when_set(self) -> None:
        strategy = _make_strategy(kernel="momentum", roc_window=7)
        snapshot = parameter_resolver.snapshot_parameters(strategy)
        self.assertEqual(snapshot["kernel"], "momentum")

    def test_snapshot_drops_unset_kernel_and_none_scalars(self) -> None:
        strategy = _make_strategy()
        snapshot = parameter_resolver.snapshot_parameters(strategy)
        self.assertNotIn("kernel", snapshot)
        self.assertNotIn("roc_window", snapshot)
        # volatility_sizing_enabled defaults to False on the model so it is
        # always populated — confirming that "unset" is a genuine sentinel for
        # None rather than a falsy scalar.
        self.assertIn("volatility_sizing_enabled", snapshot)

    def test_snapshot_matches_backtest_parameter_map_on_numeric_keys(self) -> None:
        strategy = _make_strategy(
            roc_window=7,
            ema_trend_window=13,
            momentum_threshold_pct=0.9,
            parameters=[StrategyParameter(key="fast_ma", label="fast", value=21)],
        )
        snapshot = parameter_resolver.snapshot_parameters(strategy)
        runner_map = backtest_engine._parameter_map(strategy)
        for key in runner_map:
            self.assertEqual(snapshot[key], runner_map[key])


class BuildParameterMapTests(unittest.TestCase):
    def test_none_top_level_does_not_clobber_legacy_row(self) -> None:
        strategy = _make_strategy(
            parameters=[StrategyParameter(key="rsi_window", label="rsi", value=21)],
        )
        mapping = parameter_resolver.build_parameter_map(strategy)
        self.assertEqual(mapping["rsi_window"], 21)

    def test_top_level_overlay_populates_empty_parameter_list(self) -> None:
        strategy = _make_strategy(
            bollinger_window=24,
            bollinger_std=2.5,
            squeeze_bandwidth_pct=1.75,
        )
        mapping = parameter_resolver.build_parameter_map(strategy)
        self.assertEqual(mapping["bollinger_window"], 24)
        self.assertEqual(mapping["bollinger_std"], 2.5)
        self.assertEqual(mapping["squeeze_bandwidth_pct"], 1.75)


if __name__ == "__main__":
    unittest.main()
