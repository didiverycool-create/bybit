from __future__ import annotations

import sys
import unittest
from pathlib import Path


CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import backtest_engine  # type: ignore  # noqa: E402


class BacktestEngineUnitTests(unittest.TestCase):
    def test_build_metrics_annualizes_by_elapsed_bars_not_trade_count(self) -> None:
        metrics = backtest_engine._build_metrics(
            starting_equity=100_000.0,
            ending_equity=110_000.0,
            trade_returns=[10.0],
            bars_per_year=365.0,
            bars_elapsed=365,
        )

        self.assertEqual(metrics.annual_return, "+10.0%")
        self.assertEqual(metrics.trades, 1)


if __name__ == "__main__":
    unittest.main()
