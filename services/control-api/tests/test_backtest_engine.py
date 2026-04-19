from __future__ import annotations

import math
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path


CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import backtest_engine  # type: ignore  # noqa: E402
from models import StrategyParameter, StrategySummary  # type: ignore  # noqa: E402


class BacktestEngineUnitTests(unittest.TestCase):
    def test_candle_limit_for_relative_day_range_uses_requested_window(self) -> None:
        self.assertEqual(backtest_engine.candle_limit_for_range("最近 90 天", "1d"), 95)
        self.assertEqual(backtest_engine.candle_limit_for_range("最近 180 天", "1d"), 185)

    def test_candle_limit_for_relative_day_range_supports_compact_spacing(self) -> None:
        self.assertEqual(backtest_engine.candle_limit_for_range("最近90天", "1d"), 95)
        self.assertEqual(backtest_engine.candle_limit_for_range("最近45天", "1d"), 80)

    def test_candle_limit_for_long_relative_range_uses_backtest_window_cap(self) -> None:
        self.assertEqual(backtest_engine.estimate_candle_count_for_range("最近 180 天", "1h"), 4325)
        self.assertEqual(backtest_engine.candle_limit_for_range("最近 180 天", "1h"), 4325)

    def test_resolve_data_range_bounds_for_relative_window_anchors_to_request_time(self) -> None:
        start_iso, end_iso = backtest_engine.resolve_data_range_bounds(
            "最近 90 天",
            now=datetime(2026, 4, 3, 12, 0, 0, tzinfo=timezone.utc),
        )

        self.assertEqual(start_iso, "2026-01-03T12:00:00+00:00")
        self.assertEqual(end_iso, "2026-04-03T12:00:00+00:00")

    def test_resolve_data_range_bounds_for_explicit_window_preserves_date_bounds(self) -> None:
        start_iso, end_iso = backtest_engine.resolve_data_range_bounds("2025-12-01 ~ 2026-03-29")

        self.assertEqual(start_iso, "2025-12-01")
        self.assertEqual(end_iso, "2026-03-29")

    def test_build_metrics_annualizes_by_elapsed_bars_not_trade_count(self) -> None:
        metrics = backtest_engine._build_metrics(
            starting_equity=100_000.0,
            ending_equity=110_000.0,
            trade_returns=[10.0],
            equity_curve=[100_000.0, 110_000.0],
            bars_per_year=365.0,
            bars_elapsed=365,
        )

        self.assertEqual(metrics.annual_return, "+10.0%")
        self.assertEqual(metrics.trades, 1)

    def test_compute_sharpe_annualizes_from_bar_returns(self) -> None:
        sharpe = backtest_engine._compute_sharpe([1.0, -0.5, 1.5, 0.0], bars_per_year=4.0)
        self.assertAlmostEqual(sharpe, 1.264911064, places=6)

    def test_trend_follow_marks_open_position_drawdown_before_exit(self) -> None:
        candles = [
            backtest_engine.CandlePoint(time=f"2026-03-31T0{index}:00:00+08:00", open=price, high=price, low=price, close=price, volume=1000)
            for index, price in enumerate([100.0, 101.0, 102.0, 103.0, 90.0, 106.0])
        ]

        metrics, used_reference_path, _equity_curve = backtest_engine._run_trend_follow(
            candles,
            {"fast_ma": 2, "slow_ma": 3, "risk_per_trade": 1.0},
            "1h",
        )

        self.assertFalse(used_reference_path)
        self.assertEqual(metrics.max_drawdown, "-1.3%")
        self.assertEqual(metrics.trades, 1)

    def test_trend_follow_no_trade_fallback_uses_price_path_for_drawdown(self) -> None:
        candles = [
            backtest_engine.CandlePoint(time=f"2026-03-31T0{index}:00:00+08:00", open=price, high=price, low=price, close=price, volume=1000)
            for index, price in enumerate([100.0, 110.0, 80.0, 120.0])
        ]

        metrics, used_reference_path, _equity_curve = backtest_engine._run_trend_follow(
            candles,
            {"fast_ma": 2, "slow_ma": 3, "risk_per_trade": 1.0},
            "1h",
        )

        self.assertTrue(used_reference_path)
        self.assertEqual(metrics.trades, 0)
        self.assertEqual(metrics.win_rate, "0.0%")
        self.assertEqual(metrics.max_drawdown, "-16.4%")

    def test_run_local_backtest_marks_reference_path_notes_when_no_real_trade_signal(self) -> None:
        strategy = StrategySummary(
            id="trend-btc-01",
            name="BTC 趋势跟随",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode="paper",
            version="v1",
            pnl_7d="+0.0%",
            max_drawdown="-0.0%",
            risk_budget="18%",
            description="test",
            parameters=[
                StrategyParameter(key="fast_ma", label="Fast", value=2),
                StrategyParameter(key="slow_ma", label="Slow", value=3),
                StrategyParameter(key="risk_per_trade", label="Risk", value=1.0),
            ],
        )
        candles = [
            backtest_engine.CandlePoint(time=f"2026-03-31T0{index}:00:00+08:00", open=price, high=price, low=price, close=price, volume=1000)
            for index, price in enumerate([100.0, 110.0, 80.0, 120.0])
        ]

        result = backtest_engine.run_local_backtest(strategy, candles, "1h", "2026-03-01 ~ 2026-03-31")

        self.assertTrue(result.reference_only)
        self.assertEqual(result.sample_quality, "reference_only")
        self.assertEqual(result.metrics.trades, 0)
        self.assertIn("未命中真实入场信号", result.notes)
        self.assertIn("仅供研究参考", result.notes)

    def test_run_local_backtest_marks_low_sample_when_only_one_real_trade_occurs(self) -> None:
        strategy = StrategySummary(
            id="trend-btc-01",
            name="BTC 趋势跟随",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode="paper",
            version="v1",
            pnl_7d="+0.0%",
            max_drawdown="-0.0%",
            risk_budget="18%",
            description="test",
            parameters=[
                StrategyParameter(key="fast_ma", label="Fast", value=2),
                StrategyParameter(key="slow_ma", label="Slow", value=3),
                StrategyParameter(key="risk_per_trade", label="Risk", value=1.0),
            ],
        )
        candles = [
            backtest_engine.CandlePoint(time=f"2026-03-31T0{index}:00:00+08:00", open=price, high=price, low=price, close=price, volume=1000)
            for index, price in enumerate([100.0, 101.0, 102.0, 103.0, 90.0, 106.0])
        ]

        result = backtest_engine.run_local_backtest(strategy, candles, "1h", "2026-03-01 ~ 2026-03-31")

        self.assertFalse(result.reference_only)
        self.assertEqual(result.metrics.trades, 1)
        self.assertEqual(result.sample_quality, "low_sample")

    def test_compute_volatility_stats_returns_zeroed_descriptors_for_degenerate_curves(self) -> None:
        for curve in ([], [100_000.0], [100_000.0, 100_000.0, 100_000.0]):
            stats = backtest_engine._compute_volatility_stats(curve, bars_per_year=365.0)
            self.assertEqual(stats.return_volatility_pct, 0.0)
            self.assertEqual(stats.annualized_volatility_pct, 0.0)
            self.assertEqual(stats.max_drawdown_duration_bars, 0)
            self.assertEqual(stats.max_run_up_pct, 0.0)
            if curve:
                self.assertEqual(stats.positive_bar_ratio_pct, 0.0)

    def test_compute_volatility_stats_tracks_longest_drawdown_streak(self) -> None:
        # Peak at index 1 (120), curve then stays strictly below peak for 4
        # consecutive bars before recovering; longest DD streak == 4.
        curve = [100.0, 120.0, 110.0, 90.0, 95.0, 100.0, 125.0, 115.0]
        stats = backtest_engine._compute_volatility_stats(curve, bars_per_year=365.0)

        self.assertEqual(stats.max_drawdown_duration_bars, 4)
        # Run-up anchored at the first point (100) → max equity 125 → +25%.
        self.assertAlmostEqual(stats.max_run_up_pct, 25.0, places=4)
        # 4 of 7 period returns are positive → ~57.14%.
        self.assertAlmostEqual(stats.positive_bar_ratio_pct, round(4 / 7 * 100.0, 2), places=2)
        self.assertGreater(stats.return_volatility_pct, 0.0)
        # Annualized volatility must exceed raw per-bar volatility when
        # bars_per_year > 1.
        self.assertGreater(stats.annualized_volatility_pct, stats.return_volatility_pct)

    def test_compute_volatility_stats_handles_non_positive_starting_equity(self) -> None:
        # Max run-up anchors to the first point; non-positive anchor must not
        # divide by zero or produce misleading run-up figures.
        stats = backtest_engine._compute_volatility_stats([0.0, 50.0, 75.0], bars_per_year=365.0)
        self.assertEqual(stats.max_run_up_pct, 0.0)

    def test_run_local_backtest_attaches_volatility_stats_to_computation(self) -> None:
        strategy = StrategySummary(
            id="trend-btc-01",
            name="BTC 趋势跟随",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode="paper",
            version="v1",
            pnl_7d="+0.0%",
            max_drawdown="-0.0%",
            risk_budget="18%",
            description="test",
            parameters=[
                StrategyParameter(key="fast_ma", label="Fast", value=2),
                StrategyParameter(key="slow_ma", label="Slow", value=3),
                StrategyParameter(key="risk_per_trade", label="Risk", value=1.0),
            ],
        )
        candles = [
            backtest_engine.CandlePoint(time=f"2026-03-31T0{index}:00:00+08:00", open=price, high=price, low=price, close=price, volume=1000)
            for index, price in enumerate([100.0, 101.0, 102.0, 103.0, 90.0, 106.0])
        ]

        result = backtest_engine.run_local_backtest(strategy, candles, "1h", "2026-03-01 ~ 2026-03-31")

        self.assertIsNotNone(result.volatility_stats)
        stats = result.volatility_stats
        self.assertIsInstance(stats, backtest_engine.BacktestVolatilityStats)
        self.assertGreaterEqual(stats.max_drawdown_duration_bars, 0)
        self.assertGreaterEqual(stats.positive_bar_ratio_pct, 0.0)
        self.assertLessEqual(stats.positive_bar_ratio_pct, 100.0)
        self.assertGreaterEqual(stats.return_volatility_pct, 0.0)
        self.assertGreaterEqual(stats.annualized_volatility_pct, stats.return_volatility_pct)

    def test_run_local_backtest_tolerates_empty_candle_input(self) -> None:
        strategy = StrategySummary(
            id="trend-btc-01",
            name="BTC 趋势跟随",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode="paper",
            version="v1",
            pnl_7d="+0.0%",
            max_drawdown="-0.0%",
            risk_budget="18%",
            description="test",
            parameters=[
                StrategyParameter(key="fast_ma", label="Fast", value=2),
                StrategyParameter(key="slow_ma", label="Slow", value=3),
                StrategyParameter(key="risk_per_trade", label="Risk", value=1.0),
            ],
        )

        result = backtest_engine.run_local_backtest(strategy, [], "1h", "2026-03-01 ~ 2026-03-31")

        # Zero-candle run must not crash and must emit a coherent placeholder
        # computation with zeroed volatility descriptors.
        self.assertEqual(result.retrieved_candle_count, 0)
        self.assertEqual(result.used_candle_count, 0)
        self.assertEqual(result.metrics.trades, 0)
        self.assertFalse(result.history_truncated)
        self.assertIsNotNone(result.volatility_stats)
        self.assertEqual(result.volatility_stats.return_volatility_pct, 0.0)
        self.assertEqual(result.volatility_stats.max_drawdown_duration_bars, 0)
        self.assertEqual(result.volatility_stats.max_run_up_pct, 0.0)

    def test_run_local_backtest_marks_history_truncated_when_input_exceeds_engine_window(self) -> None:
        strategy = StrategySummary(
            id="trend-btc-01",
            name="BTC 趋势跟随",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode="paper",
            version="v1",
            pnl_7d="+0.0%",
            max_drawdown="-0.0%",
            risk_budget="18%",
            description="test",
            parameters=[
                StrategyParameter(key="fast_ma", label="Fast", value=2),
                StrategyParameter(key="slow_ma", label="Slow", value=3),
                StrategyParameter(key="risk_per_trade", label="Risk", value=1.0),
            ],
        )
        candles = [
            backtest_engine.CandlePoint(
                time=f"2026-01-{(index % 28) + 1:02d}T{index % 24:02d}:00:00+08:00",
                open=100.0 + index * 0.1,
                high=100.2 + index * 0.1,
                low=99.8 + index * 0.1,
                close=100.0 + index * 0.1,
                volume=1000,
            )
            for index in range(backtest_engine.BACKTEST_ENGINE_MAX_CANDLES + 50)
        ]

        result = backtest_engine.run_local_backtest(strategy, candles, "1h", "最近 180 天")

        self.assertTrue(result.history_truncated)
        self.assertEqual(result.retrieved_candle_count, backtest_engine.BACKTEST_ENGINE_MAX_CANDLES + 50)
        self.assertEqual(result.used_candle_count, backtest_engine.BACKTEST_ENGINE_MAX_CANDLES)
        self.assertEqual(result.retrieved_range_start, candles[0].time)
        self.assertEqual(result.retrieved_range_end, candles[-1].time)
        self.assertEqual(result.used_range_start, candles[-backtest_engine.BACKTEST_ENGINE_MAX_CANDLES].time)
        self.assertEqual(result.used_range_end, candles[-1].time)
        self.assertIn(f"仅使用最近 {backtest_engine.BACKTEST_ENGINE_MAX_CANDLES} 根样本", result.notes)


    def test_compute_risk_ratios_returns_zeroed_on_degenerate_curve(self) -> None:
        # Empty curve → no period returns → all-zero defaults.
        empty_stats = backtest_engine._compute_risk_ratios(
            equity_curve=[],
            period_returns=[],
            annualized_return_pct=0.0,
            bars_per_year=365.0,
        )
        self.assertIsInstance(empty_stats, backtest_engine.BacktestRiskRatios)
        self.assertEqual(empty_stats.sortino_ratio, 0.0)
        self.assertEqual(empty_stats.calmar_ratio, 0.0)
        self.assertEqual(empty_stats.profit_factor, 0.0)
        self.assertEqual(empty_stats.expectancy_pct, 0.0)
        self.assertEqual(empty_stats.worst_bar_return_pct, 0.0)
        self.assertEqual(empty_stats.best_bar_return_pct, 0.0)

        # Single-point curve → ``_compute_period_returns`` yields [] as well.
        single_stats = backtest_engine._compute_risk_ratios(
            equity_curve=[100_000.0],
            period_returns=backtest_engine._compute_period_returns([100_000.0]),
            annualized_return_pct=0.0,
            bars_per_year=365.0,
        )
        self.assertEqual(single_stats.sortino_ratio, 0.0)
        self.assertEqual(single_stats.profit_factor, 0.0)
        self.assertEqual(single_stats.expectancy_pct, 0.0)

    def test_compute_risk_ratios_separates_positive_and_negative_bars(self) -> None:
        # Construct an equity curve that produces known period returns with a
        # clean positive/negative split so profit factor / expectancy / best /
        # worst bar numbers can be checked exactly.
        equity_curve = [100.0, 102.0, 99.96, 104.9580, 99.7101]
        period_returns = backtest_engine._compute_period_returns(equity_curve)

        ratios = backtest_engine._compute_risk_ratios(
            equity_curve=equity_curve,
            period_returns=period_returns,
            annualized_return_pct=0.0,
            bars_per_year=365.0,
        )

        sum_positive = sum(value for value in period_returns if value > 0)
        sum_negative_abs = abs(sum(value for value in period_returns if value < 0))
        expected_profit_factor = sum_positive / sum_negative_abs
        self.assertAlmostEqual(ratios.profit_factor, round(expected_profit_factor, 4), places=4)
        # Expectancy == mean of period returns (already in percent units).
        self.assertAlmostEqual(
            ratios.expectancy_pct,
            round(sum(period_returns) / len(period_returns), 4),
            places=4,
        )
        # Best / worst bars pick the tails of the period-return distribution.
        self.assertAlmostEqual(ratios.best_bar_return_pct, round(max(period_returns), 4), places=4)
        self.assertAlmostEqual(ratios.worst_bar_return_pct, round(min(period_returns), 4), places=4)
        self.assertLess(ratios.worst_bar_return_pct, 0.0)
        self.assertGreater(ratios.best_bar_return_pct, 0.0)

    def test_compute_risk_ratios_sortino_uses_downside_deviation_only(self) -> None:
        # Positive-only returns ⇒ no downside deviation ⇒ sortino stays 0 (the
        # zero-denom guard protects against division by zero while still
        # producing a meaningful "no downside risk" signal).
        all_positive_curve = [100.0, 101.0, 102.01, 103.0301, 104.060401]
        all_positive_returns = backtest_engine._compute_period_returns(all_positive_curve)
        all_positive_ratios = backtest_engine._compute_risk_ratios(
            equity_curve=all_positive_curve,
            period_returns=all_positive_returns,
            annualized_return_pct=0.0,
            bars_per_year=365.0,
        )
        self.assertEqual(all_positive_ratios.sortino_ratio, 0.0)
        self.assertGreater(all_positive_ratios.expectancy_pct, 0.0)

        # A curve with a mix of positive and negative bars (with distinct
        # negative magnitudes so ``pstdev`` of the negatives is non-zero) must
        # produce a finite, positive sortino. Because sortino's denominator is
        # the stdev of only the negative tail — which is strictly ≤ the stdev
        # of the full distribution — sortino should equal or exceed sharpe
        # when the mean period return is positive.
        mixed_curve = [100.0, 101.0, 99.0, 102.0, 99.5, 103.0]
        mixed_returns = backtest_engine._compute_period_returns(mixed_curve)
        mixed_ratios = backtest_engine._compute_risk_ratios(
            equity_curve=mixed_curve,
            period_returns=mixed_returns,
            annualized_return_pct=0.0,
            bars_per_year=365.0,
        )
        sharpe = backtest_engine._compute_sharpe(mixed_returns, bars_per_year=365.0)
        self.assertGreater(mixed_ratios.sortino_ratio, 0.0)
        self.assertGreaterEqual(mixed_ratios.sortino_ratio, round(sharpe, 4) - 1e-6)

    def test_compute_risk_ratios_calmar_zero_when_no_drawdown(self) -> None:
        # A strictly ascending curve never draws down, so calmar must collapse
        # to zero even when the annualized return is non-trivial.
        ascending_curve = [100.0, 101.0, 102.0, 103.0, 104.0]
        period_returns = backtest_engine._compute_period_returns(ascending_curve)
        ratios = backtest_engine._compute_risk_ratios(
            equity_curve=ascending_curve,
            period_returns=period_returns,
            annualized_return_pct=120.0,
            bars_per_year=365.0,
        )
        self.assertEqual(ratios.calmar_ratio, 0.0)

        # A flat curve likewise has no drawdown and no period returns, so the
        # whole ratio payload is zeroed.
        flat_ratios = backtest_engine._compute_risk_ratios(
            equity_curve=[100.0, 100.0, 100.0],
            period_returns=backtest_engine._compute_period_returns([100.0, 100.0, 100.0]),
            annualized_return_pct=0.0,
            bars_per_year=365.0,
        )
        self.assertEqual(flat_ratios.calmar_ratio, 0.0)
        self.assertEqual(flat_ratios.profit_factor, 0.0)

    def test_run_local_backtest_attaches_risk_ratios_to_computation(self) -> None:
        strategy = StrategySummary(
            id="trend-btc-01",
            name="BTC 趋势跟随",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode="paper",
            version="v1",
            pnl_7d="+0.0%",
            max_drawdown="-0.0%",
            risk_budget="18%",
            description="test",
            parameters=[
                StrategyParameter(key="fast_ma", label="Fast", value=2),
                StrategyParameter(key="slow_ma", label="Slow", value=3),
                StrategyParameter(key="risk_per_trade", label="Risk", value=1.0),
            ],
        )
        candles = [
            backtest_engine.CandlePoint(time=f"2026-03-31T0{index}:00:00+08:00", open=price, high=price, low=price, close=price, volume=1000)
            for index, price in enumerate([100.0, 101.0, 102.0, 103.0, 90.0, 106.0])
        ]

        result = backtest_engine.run_local_backtest(strategy, candles, "1h", "2026-03-01 ~ 2026-03-31")

        self.assertIsNotNone(result.risk_ratios)
        ratios = result.risk_ratios
        self.assertIsInstance(ratios, backtest_engine.BacktestRiskRatios)
        # Values should be finite floats bounded by the round(_, 4) contract.
        self.assertIsInstance(ratios.sortino_ratio, float)
        self.assertIsInstance(ratios.calmar_ratio, float)
        self.assertIsInstance(ratios.profit_factor, float)
        self.assertIsInstance(ratios.expectancy_pct, float)
        # Worst bar should never exceed best bar.
        self.assertLessEqual(ratios.worst_bar_return_pct, ratios.best_bar_return_pct)

    def test_compute_trade_rhythm_stats_handles_empty_input(self) -> None:
        # Empty period-return series must never raise; every field should be
        # the zero value of its declared type (int → 0, float → 0.0).
        stats = backtest_engine._compute_trade_rhythm_stats([])

        self.assertIsInstance(stats, backtest_engine.BacktestTradeRhythmStats)
        self.assertEqual(stats.total_bars, 0)
        self.assertEqual(stats.positive_bars, 0)
        self.assertEqual(stats.negative_bars, 0)
        self.assertEqual(stats.flat_bars, 0)
        self.assertEqual(stats.win_loss_bar_ratio, 0.0)
        self.assertEqual(stats.longest_winning_streak_bars, 0)
        self.assertEqual(stats.longest_losing_streak_bars, 0)
        self.assertEqual(stats.avg_positive_bar_return_pct, 0.0)
        self.assertEqual(stats.avg_negative_bar_return_pct, 0.0)
        self.assertEqual(stats.median_bar_return_pct, 0.0)

    def test_compute_trade_rhythm_stats_counts_positive_negative_flat_bars(self) -> None:
        # Mix of strictly positive, strictly negative, and zero bars — each
        # counter must bucket the corresponding sign and win/loss ratio should
        # divide positives by negatives.
        period_returns = [1.0, -0.5, 0.0, 2.0, -1.0, 0.0, 0.5]
        stats = backtest_engine._compute_trade_rhythm_stats(period_returns)

        self.assertEqual(stats.total_bars, 7)
        self.assertEqual(stats.positive_bars, 3)
        self.assertEqual(stats.negative_bars, 2)
        self.assertEqual(stats.flat_bars, 2)
        self.assertAlmostEqual(stats.win_loss_bar_ratio, round(3 / 2, 4), places=4)

        # A run of only-positive bars must produce a zero win/loss ratio (the
        # "no losses observed" guard rather than a division by zero).
        only_positive = backtest_engine._compute_trade_rhythm_stats([1.0, 2.0, 0.5])
        self.assertEqual(only_positive.negative_bars, 0)
        self.assertEqual(only_positive.win_loss_bar_ratio, 0.0)

    def test_compute_trade_rhythm_stats_tracks_longest_streaks(self) -> None:
        # +,+,+,-,-,+ → longest winning streak = 3 (first three bars); longest
        # losing streak = 2 (bars 4–5). A trailing positive bar must not
        # extend the losing streak.
        stats = backtest_engine._compute_trade_rhythm_stats([1.0, 0.5, 0.25, -0.5, -0.25, 0.75])

        self.assertEqual(stats.longest_winning_streak_bars, 3)
        self.assertEqual(stats.longest_losing_streak_bars, 2)

        # A flat bar in the middle of a winning run must break the streak so
        # the two sub-runs do not merge into a longer single streak.
        broken_by_zero = backtest_engine._compute_trade_rhythm_stats([1.0, 1.0, 0.0, 1.0, 1.0, 1.0])
        self.assertEqual(broken_by_zero.longest_winning_streak_bars, 3)
        self.assertEqual(broken_by_zero.longest_losing_streak_bars, 0)

    def test_compute_trade_rhythm_stats_averages_positive_and_negative_bars(self) -> None:
        # Hand-picked returns let us check averages / median against an exact
        # expected value rather than a fuzzy bound.
        period_returns = [1.0, 2.0, 3.0, -1.0, -3.0]
        stats = backtest_engine._compute_trade_rhythm_stats(period_returns)

        self.assertAlmostEqual(stats.avg_positive_bar_return_pct, round((1.0 + 2.0 + 3.0) / 3, 4), places=4)
        self.assertAlmostEqual(stats.avg_negative_bar_return_pct, round((-1.0 + -3.0) / 2, 4), places=4)
        # Negative-tail average must itself be a negative number.
        self.assertLess(stats.avg_negative_bar_return_pct, 0.0)
        # Median of [-3, -1, 1, 2, 3] is 1.0.
        self.assertAlmostEqual(stats.median_bar_return_pct, 1.0, places=4)

    def test_run_local_backtest_attaches_trade_rhythm_stats_to_computation(self) -> None:
        strategy = StrategySummary(
            id="trend-btc-01",
            name="BTC 趋势跟随",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode="paper",
            version="v1",
            pnl_7d="+0.0%",
            max_drawdown="-0.0%",
            risk_budget="18%",
            description="test",
            parameters=[
                StrategyParameter(key="fast_ma", label="Fast", value=2),
                StrategyParameter(key="slow_ma", label="Slow", value=3),
                StrategyParameter(key="risk_per_trade", label="Risk", value=1.0),
            ],
        )
        candles = [
            backtest_engine.CandlePoint(time=f"2026-03-31T0{index}:00:00+08:00", open=price, high=price, low=price, close=price, volume=1000)
            for index, price in enumerate([100.0, 101.0, 102.0, 103.0, 90.0, 106.0])
        ]

        result = backtest_engine.run_local_backtest(strategy, candles, "1h", "2026-03-01 ~ 2026-03-31")

        self.assertIsNotNone(result.trade_rhythm_stats)
        rhythm = result.trade_rhythm_stats
        self.assertIsInstance(rhythm, backtest_engine.BacktestTradeRhythmStats)
        # Bucket counts must reconcile with total bars and stay non-negative.
        self.assertGreaterEqual(rhythm.total_bars, 0)
        self.assertEqual(
            rhythm.positive_bars + rhythm.negative_bars + rhythm.flat_bars,
            rhythm.total_bars,
        )
        self.assertGreaterEqual(rhythm.longest_winning_streak_bars, 0)
        self.assertGreaterEqual(rhythm.longest_losing_streak_bars, 0)
        # Streaks can never exceed the corresponding bucket counts.
        self.assertLessEqual(rhythm.longest_winning_streak_bars, rhythm.positive_bars)
        self.assertLessEqual(rhythm.longest_losing_streak_bars, rhythm.negative_bars)


    def test_compute_benchmark_stats_returns_zeroed_on_empty_inputs(self) -> None:
        # Any degenerate input (empty, single-point, or one-side-only) must
        # collapse to the all-zero default payload rather than raising —
        # downstream consumers treat zero-fill as "unavailable".
        for equity, path in (
            ([], []),
            ([], [100.0, 110.0]),
            ([100_000.0, 101_000.0], []),
            ([100_000.0], [100.0]),
            ([100_000.0], [100.0, 110.0]),
        ):
            stats = backtest_engine._compute_benchmark_stats(equity, path, bars_per_year=365.0)
            self.assertIsInstance(stats, backtest_engine.BacktestBenchmarkStats)
            self.assertEqual(stats.buy_hold_return_pct, 0.0)
            self.assertEqual(stats.buy_hold_max_drawdown_pct, 0.0)
            self.assertEqual(stats.strategy_over_buy_hold_pct, 0.0)
            self.assertEqual(stats.alpha_pct, 0.0)
            self.assertEqual(stats.correlation, 0.0)
            self.assertEqual(stats.tracking_error_pct, 0.0)

    def test_compute_benchmark_stats_handles_mismatched_lengths_by_truncation(self) -> None:
        # Feed a longer equity curve than price path — the helper must align
        # both series to the shorter length before computing returns, so the
        # resulting stats depend only on the overlapping prefix.
        long_equity = [100_000.0, 101_000.0, 102_010.0, 103_030.1, 104_060.4]
        short_path = [100.0, 101.0, 102.01]
        truncated_stats = backtest_engine._compute_benchmark_stats(
            long_equity,
            short_path,
            bars_per_year=365.0,
        )

        # Reference computation: truncate equity to ``len(short_path)``.
        reference_stats = backtest_engine._compute_benchmark_stats(
            long_equity[: len(short_path)],
            short_path,
            bars_per_year=365.0,
        )
        self.assertEqual(truncated_stats, reference_stats)
        # Sanity-check: the buy-and-hold return derives solely from the
        # price-path endpoints (102.01 / 100.0 - 1 ≈ 2.01%).
        self.assertAlmostEqual(truncated_stats.buy_hold_return_pct, round(2.01, 4), places=4)

    def test_compute_benchmark_stats_measures_strategy_outperformance(self) -> None:
        # Strategy equity curve grows significantly faster than the price
        # path over the same window → ``strategy_over_buy_hold_pct`` must be
        # strictly positive and equal to the realized return gap.
        equity_curve = [100_000.0, 110_000.0, 121_000.0, 133_100.0]
        price_path = [100.0, 101.0, 102.01, 103.0301]
        stats = backtest_engine._compute_benchmark_stats(
            equity_curve,
            price_path,
            bars_per_year=365.0,
        )

        strategy_total_return = (equity_curve[-1] / equity_curve[0] - 1.0) * 100.0
        buy_hold_return = (price_path[-1] / price_path[0] - 1.0) * 100.0
        expected_gap = strategy_total_return - buy_hold_return
        self.assertAlmostEqual(
            stats.strategy_over_buy_hold_pct,
            round(expected_gap, 4),
            places=4,
        )
        self.assertGreater(stats.strategy_over_buy_hold_pct, 0.0)
        # Alpha is the annualized gap; with a positive gap and a positive
        # annualization multiplier it must itself be strictly positive.
        self.assertGreater(stats.alpha_pct, 0.0)
        self.assertAlmostEqual(
            stats.buy_hold_return_pct,
            round(buy_hold_return, 4),
            places=4,
        )

    def test_compute_benchmark_stats_correlation_near_one_for_identical_paths(self) -> None:
        # When the strategy equity curve mirrors the reference price path
        # (same per-bar return shape), Pearson correlation must saturate at
        # 1.0 and the tracking error collapses to zero.
        price_path = [100.0, 101.0, 99.5, 102.0, 98.0, 103.5]
        equity_curve = [value * 1_000.0 for value in price_path]
        stats = backtest_engine._compute_benchmark_stats(
            equity_curve,
            price_path,
            bars_per_year=365.0,
        )

        self.assertAlmostEqual(stats.correlation, 1.0, places=4)
        self.assertAlmostEqual(stats.tracking_error_pct, 0.0, places=4)

    def test_compute_benchmark_stats_correlation_zero_when_price_path_is_flat(self) -> None:
        # Flat price path ⇒ zero-variance price returns ⇒ Pearson correlation
        # is undefined; the helper must emit 0.0 rather than raising or
        # propagating a division-by-zero NaN.
        equity_curve = [100_000.0, 101_000.0, 99_500.0, 102_300.0]
        flat_path = [100.0, 100.0, 100.0, 100.0]
        stats = backtest_engine._compute_benchmark_stats(
            equity_curve,
            flat_path,
            bars_per_year=365.0,
        )

        self.assertEqual(stats.correlation, 0.0)
        # Buy-and-hold on a flat path produces zero return and zero drawdown.
        self.assertEqual(stats.buy_hold_return_pct, 0.0)
        self.assertEqual(stats.buy_hold_max_drawdown_pct, 0.0)

    def test_compute_exposure_stats_returns_zero_defaults_for_empty_inputs(self) -> None:
        # Degenerate inputs (empty curve, empty returns, missing drawdown) must
        # collapse to ``BacktestExposureStats()`` rather than raising so the
        # downstream payload is always fully populated.
        for equity, returns, total_return, max_drawdown in (
            ([], [], 0.0, 0.0),
            ([], [0.5], 1.0, -2.0),
            ([100_000.0, 101_000.0], [], 1.0, -0.5),
            ([100_000.0, 101_000.0], [1.0, -0.5], 1.0, 0.0),
        ):
            stats = backtest_engine._compute_exposure_stats(
                equity,
                returns,
                total_return,
                max_drawdown,
            )
            self.assertIsInstance(stats, backtest_engine.BacktestExposureStats)
            if not equity:
                self.assertEqual(stats.ulcer_index_pct, 0.0)
            if len(returns) < 3:
                self.assertEqual(stats.return_skew, 0.0)
                self.assertEqual(stats.return_kurtosis, 0.0)
            if max_drawdown == 0:
                self.assertEqual(stats.recovery_factor, 0.0)

    def test_compute_exposure_stats_matches_known_skew_kurtosis_on_symmetric_sample(self) -> None:
        # ``[+0.01, -0.01, +0.01, -0.01]`` is perfectly symmetric around zero,
        # so Fisher-Pearson skew must vanish and excess kurtosis lands on the
        # closed-form value ``20/6 * 2.25 - 13.5 = -6.0`` for the unbiased
        # estimator.
        returns = [0.01, -0.01, 0.01, -0.01]
        stats = backtest_engine._compute_exposure_stats(
            equity_curve=[100.0, 100.01, 99.0099, 99.99999, 99.00000099],
            period_returns=returns,
            total_return_pct=0.0,
            max_drawdown_pct=-1.0,
        )

        self.assertAlmostEqual(stats.return_skew, 0.0, delta=1e-6)
        self.assertAlmostEqual(stats.return_kurtosis, -6.0, delta=1e-6)
        # Only negative tail matters for downside deviation — two of the four
        # returns are negative and identical in magnitude, so pstdev is zero
        # and the final percentage is zero.
        self.assertAlmostEqual(stats.downside_deviation_pct, 0.0, delta=1e-6)

    def test_compute_exposure_stats_ulcer_index_reflects_drawdown_magnitude(self) -> None:
        # Hand-rolled curve hits a 110 peak at index 1 and never recovers; the
        # ulcer index should therefore reflect the RMS of the subsequent
        # drawdown magnitudes (10/110, 20/110, 15/110 in percent).
        equity_curve = [100.0, 110.0, 100.0, 90.0, 95.0]
        squared = [
            0.0,
            0.0,
            (10.0 / 110.0 * 100.0) ** 2,
            (20.0 / 110.0 * 100.0) ** 2,
            (15.0 / 110.0 * 100.0) ** 2,
        ]
        expected_ulcer = math.sqrt(sum(squared) / len(squared))
        stats = backtest_engine._compute_exposure_stats(
            equity_curve=equity_curve,
            period_returns=[],
            total_return_pct=-5.0,
            max_drawdown_pct=-18.18,
        )

        self.assertAlmostEqual(stats.ulcer_index_pct, round(expected_ulcer, 4), delta=1e-4)
        # Recovery factor here = total_return / |max_drawdown| = -5 / 18.18.
        self.assertAlmostEqual(stats.recovery_factor, round(-5.0 / 18.18, 4), delta=1e-4)

    def test_compute_exposure_stats_recovery_factor_guards_zero_drawdown(self) -> None:
        # Zero / ``None`` drawdown means the ratio would diverge — the helper
        # must short-circuit to 0.0 rather than propagating a division error.
        zero_drawdown = backtest_engine._compute_exposure_stats(
            equity_curve=[100.0, 101.0, 102.0],
            period_returns=[1.0, 0.99],
            total_return_pct=2.0,
            max_drawdown_pct=0.0,
        )
        self.assertEqual(zero_drawdown.recovery_factor, 0.0)

        none_drawdown = backtest_engine._compute_exposure_stats(
            equity_curve=[100.0, 101.0, 102.0],
            period_returns=[1.0, 0.99],
            total_return_pct=2.0,
            max_drawdown_pct=None,  # type: ignore[arg-type]
        )
        self.assertEqual(none_drawdown.recovery_factor, 0.0)

    def test_compute_tail_risk_stats_returns_zero_defaults_for_empty_inputs(self) -> None:
        # Degenerate inputs (empty series) must collapse to
        # ``BacktestTailRiskStats()`` rather than raising so the downstream
        # payload is always fully populated.
        stats = backtest_engine._compute_tail_risk_stats([])
        self.assertIsInstance(stats, backtest_engine.BacktestTailRiskStats)
        self.assertEqual(stats.var_95_pct, 0.0)
        self.assertEqual(stats.cvar_95_pct, 0.0)
        self.assertEqual(stats.tail_ratio, 0.0)
        self.assertEqual(stats.gain_to_pain_ratio, 0.0)

        # A strictly non-negative sample has no meaningful VaR; the helper
        # must short-circuit to zero rather than reading the upper tail.
        positive_only = backtest_engine._compute_tail_risk_stats([0.0, 0.5, 1.0])
        self.assertEqual(positive_only.var_95_pct, 0.0)
        self.assertEqual(positive_only.gain_to_pain_ratio, 0.0)

    def test_compute_tail_risk_stats_computes_historical_var_and_cvar(self) -> None:
        # 20 returns with a single -0.05 outlier and a -0.02 cluster; the
        # bottom-5% tail therefore contains exactly one observation (-0.05),
        # so both historical VaR95 and CVaR95 land on 5.0% loss magnitude.
        returns = [-0.05] + [-0.02] * 4 + [0.01] * 15
        stats = backtest_engine._compute_tail_risk_stats(returns)

        self.assertAlmostEqual(stats.var_95_pct, 5.0, places=4)
        self.assertAlmostEqual(stats.cvar_95_pct, 5.0, places=4)

    def test_compute_tail_risk_stats_gain_to_pain_ratio_from_signed_returns(self) -> None:
        # Gain-to-pain weights magnitudes rather than counts: sum of positives
        # is 2.0 + 1.0 + 0.5 = 3.5, absolute sum of negatives is
        # 1.5 + 0.5 + 0.25 = 2.25, so the ratio is 3.5 / 2.25 = 1.5555…
        returns = [2.0, -1.5, 1.0, -0.5, 0.5, -0.25]
        stats = backtest_engine._compute_tail_risk_stats(returns)

        expected = round(3.5 / 2.25, 4)
        self.assertAlmostEqual(stats.gain_to_pain_ratio, expected, places=4)

    def test_compute_tail_risk_stats_tail_ratio_guards_small_sample(self) -> None:
        # Samples smaller than 20 observations cannot support a stable
        # ``p5 / p95`` estimate, so the helper must short-circuit to zero
        # rather than emitting noise. 19 alternating returns exercises the
        # guard without triggering the 20-sample branch.
        returns = [0.01 if index % 2 == 0 else -0.01 for index in range(19)]
        stats = backtest_engine._compute_tail_risk_stats(returns)

        self.assertEqual(stats.tail_ratio, 0.0)

    def test_run_local_backtest_attaches_benchmark_stats_to_computation(self) -> None:
        strategy = StrategySummary(
            id="trend-btc-01",
            name="BTC 趋势跟随",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode="paper",
            version="v1",
            pnl_7d="+0.0%",
            max_drawdown="-0.0%",
            risk_budget="18%",
            description="test",
            parameters=[
                StrategyParameter(key="fast_ma", label="Fast", value=2),
                StrategyParameter(key="slow_ma", label="Slow", value=3),
                StrategyParameter(key="risk_per_trade", label="Risk", value=1.0),
            ],
        )
        candles = [
            backtest_engine.CandlePoint(time=f"2026-03-31T0{index}:00:00+08:00", open=price, high=price, low=price, close=price, volume=1000)
            for index, price in enumerate([100.0, 101.0, 102.0, 103.0, 90.0, 106.0])
        ]

        result = backtest_engine.run_local_backtest(strategy, candles, "1h", "2026-03-01 ~ 2026-03-31")

        self.assertIsNotNone(result.benchmark_stats)
        benchmark = result.benchmark_stats
        self.assertIsInstance(benchmark, backtest_engine.BacktestBenchmarkStats)
        # End-to-end wiring sanity check: correlation must be a finite float
        # in [-1.0, 1.0] and the other descriptors must also be floats.
        self.assertIsInstance(benchmark.correlation, float)
        self.assertGreaterEqual(benchmark.correlation, -1.0)
        self.assertLessEqual(benchmark.correlation, 1.0)
        self.assertIsInstance(benchmark.buy_hold_return_pct, float)
        self.assertIsInstance(benchmark.strategy_over_buy_hold_pct, float)
        self.assertIsInstance(benchmark.tracking_error_pct, float)


if __name__ == "__main__":
    unittest.main()
