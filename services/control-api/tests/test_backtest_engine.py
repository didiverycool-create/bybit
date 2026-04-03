from __future__ import annotations

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

        metrics, used_reference_path = backtest_engine._run_trend_follow(
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

        metrics, used_reference_path = backtest_engine._run_trend_follow(
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


if __name__ == "__main__":
    unittest.main()
