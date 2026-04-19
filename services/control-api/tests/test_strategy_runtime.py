from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import List


CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import strategy_runtime  # type: ignore  # noqa: E402
from models import (  # type: ignore  # noqa: E402
    AccountMode,
    CandlePoint,
    MarketDetail,
    StrategyParameter,
    StrategySummary,
    WatchlistInstrument,
)


def _candles_from_closes(closes: List[float]) -> List[CandlePoint]:
    rows: List[CandlePoint] = []
    for index, close in enumerate(closes):
        rows.append(
            CandlePoint(
                time=f"2026-01-{(index % 28) + 1:02d}T00:00:00",
                open=close,
                high=close * 1.005,
                low=close * 0.995,
                close=close,
                volume=1_000.0,
            )
        )
    return rows


def _build_detail(closes: List[float]) -> MarketDetail:
    return MarketDetail(
        symbol="BTCUSDT",
        market="perp",
        timeframe="1h",
        candles=_candles_from_closes(closes),
        bids=[],
        asks=[],
        headline="test",
        stats={},
        source="fallback",
    )


def _build_watch_item(last_price: float) -> WatchlistInstrument:
    return WatchlistInstrument(
        symbol="BTCUSDT",
        market="perp",
        last_price=last_price,
        change_24h=1.25,
        volume_24h=10_000.0,
        signal="active",
        position_side="flat",
        risk_level="medium",
    )


def _build_strategy(
    strategy_id: str,
    name: str,
    extra_params: List[StrategyParameter] = None,
) -> StrategySummary:
    params: List[StrategyParameter] = [
        StrategyParameter(key="fast_ma", label="fast", value=3),
        StrategyParameter(key="slow_ma", label="slow", value=6),
        StrategyParameter(key="stop_loss_pct", label="stop", value=1.5),
        StrategyParameter(key="take_profit_pct", label="target", value=3.0),
        StrategyParameter(key="zscore_entry", label="z_in", value=2.0),
        StrategyParameter(key="zscore_exit", label="z_out", value=0.5),
        StrategyParameter(key="breakout_window", label="bw", value=4),
    ]
    if extra_params:
        params.extend(extra_params)
    return StrategySummary(
        id=strategy_id,
        name=name,
        category="template",
        status="running",
        symbols=["BTCUSDT"],
        mode=AccountMode.PAPER,
        version="1.0.0",
        pnl_7d="+0%",
        max_drawdown="-0%",
        risk_budget="low",
        description="test",
        parameters=params,
    )


class StrategyRuntimeRiskHintsTests(unittest.TestCase):
    def test_trend_long_bias_emits_stop_and_target_below_above_price(self) -> None:
        strategy = _build_strategy("trend-btc", "趋势跟踪")
        closes = [100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0]
        detail = _build_detail(closes)
        watch_item = _build_watch_item(closes[-1])

        hint = strategy_runtime.compute_strategy_runtime_risk_hints(
            strategy=strategy,
            detail=detail,
            watch_item=watch_item,
        )

        self.assertTrue(hint["available"])
        self.assertEqual(hint["family"], "trend")
        self.assertEqual(hint["bias"], "long")
        self.assertLess(hint["stop_price"], hint["last_price"])
        self.assertGreater(hint["target_price"], hint["last_price"])
        # 止损/止盈距离百分比应符合参数设定 (stop_loss_pct=1.5, take_profit_pct=3.0)
        self.assertAlmostEqual(hint["stop_distance_pct"], -1.5, places=2)
        self.assertAlmostEqual(hint["target_distance_pct"], 3.0, places=2)

    def test_mean_revert_short_bias_exposes_zscore_entry_bands(self) -> None:
        strategy = _build_strategy("eth-revert", "均值回归")
        # Stable history then a sharp upward spike to push zscore >= entry.
        closes = [100.0] * 20 + [125.0]
        detail = _build_detail(closes)
        watch_item = _build_watch_item(closes[-1])

        hint = strategy_runtime.compute_strategy_runtime_risk_hints(
            strategy=strategy,
            detail=detail,
            watch_item=watch_item,
        )

        self.assertTrue(hint["available"])
        self.assertEqual(hint["family"], "mean_revert")
        self.assertEqual(hint["bias"], "short")
        self.assertGreater(hint["zscore"], 2.0)
        self.assertGreater(hint["short_entry_price"], hint["baseline_price"])
        self.assertLess(hint["long_entry_price"], hint["baseline_price"])
        # Target 回归到均值
        self.assertAlmostEqual(hint["target_price"], hint["baseline_price"], places=6)

    def test_insufficient_history_returns_available_false_with_reason(self) -> None:
        strategy = _build_strategy("brk-btc", "突破策略")
        detail = _build_detail([100.0, 101.0, 102.0])  # 3 candles < 6
        watch_item = _build_watch_item(102.0)

        hint = strategy_runtime.compute_strategy_runtime_risk_hints(
            strategy=strategy,
            detail=detail,
            watch_item=watch_item,
        )

        self.assertFalse(hint["available"])
        self.assertEqual(hint["bias"], "watch")
        self.assertIn("历史", hint["reason"])
        self.assertNotIn("stop_price", hint)


if __name__ == "__main__":
    unittest.main()
