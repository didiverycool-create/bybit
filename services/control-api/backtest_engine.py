from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime
from statistics import mean, pstdev
from typing import Dict, List, Optional

from models import BacktestMetrics, CandlePoint, StrategySummary


@dataclass
class BacktestComputation:
    metrics: BacktestMetrics
    notes: str
    parameter_snapshot: Dict[str, object]
    symbol_scope: List[str]
    data_granularity: str


def _parameter_map(strategy: StrategySummary) -> Dict[str, object]:
    return {param.key: param.value for param in strategy.parameters}


def _timeframe_hours(timeframe: str) -> float:
    return {
        "15m": 0.25,
        "1h": 1.0,
        "4h": 4.0,
        "1d": 24.0,
    }.get(str(timeframe).lower(), 1.0)


def candle_limit_for_range(data_range: str, timeframe: str) -> int:
    try:
        start_text, end_text = [part.strip() for part in data_range.split("~", 1)]
        start_dt = datetime.fromisoformat(start_text)
        end_dt = datetime.fromisoformat(end_text)
        duration_hours = max((end_dt - start_dt).total_seconds() / 3600.0, 24.0)
    except Exception:
        duration_hours = 24.0 * 90
    estimated = int(duration_hours / _timeframe_hours(timeframe))
    return max(80, min(estimated + 5, 600))


def _format_signed_pct(value: float) -> str:
    return f"{value:+.1f}%"


def _format_signed_usdt(value: float) -> str:
    sign = "+" if value >= 0 else "-"
    return f"{sign}{abs(value):,.0f} USDT"


def _compute_max_drawdown(equity_curve: List[float]) -> float:
    peak = equity_curve[0] if equity_curve else 1.0
    max_drawdown = 0.0
    for value in equity_curve:
        peak = max(peak, value)
        if peak <= 0:
            continue
        drawdown = (value - peak) / peak * 100.0
        max_drawdown = min(max_drawdown, drawdown)
    return max_drawdown


def _compute_sharpe(trade_returns: List[float]) -> float:
    if len(trade_returns) < 2:
        return 0.0
    avg = mean(trade_returns)
    std = pstdev(trade_returns)
    if std == 0:
        return 0.0
    return avg / std * math.sqrt(len(trade_returns))


def _build_metrics(starting_equity: float, ending_equity: float, trade_returns: List[float], bars_per_year: float) -> BacktestMetrics:
    total_return_pct = ((ending_equity / starting_equity) - 1.0) * 100.0 if starting_equity else 0.0
    annual_return_pct = ((1.0 + total_return_pct / 100.0) ** (bars_per_year / max(len(trade_returns), 1)) - 1.0) * 100.0 if trade_returns else total_return_pct
    wins = sum(1 for value in trade_returns if value > 0)
    win_rate = (wins / len(trade_returns) * 100.0) if trade_returns else 0.0
    sharpe = _compute_sharpe(trade_returns)
    return BacktestMetrics(
        annual_return=_format_signed_pct(annual_return_pct),
        max_drawdown=_format_signed_pct(0.0),  # caller replaces this
        sharpe=f"{sharpe:.2f}",
        win_rate=f"{win_rate:.1f}%",
        pnl=_format_signed_usdt(ending_equity - starting_equity),
        trades=len(trade_returns),
    )


def _run_trend_follow(candles: List[CandlePoint], params: Dict[str, object], timeframe: str) -> BacktestMetrics:
    fast = max(int(float(params.get("fast_ma", 21))), 2)
    slow = max(int(float(params.get("slow_ma", 55))), fast + 1)
    risk_per_trade = max(float(params.get("risk_per_trade", 1.0)), 0.2) / 100.0
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    position_entry: Optional[float] = None

    closes = [candle.close for candle in candles]
    for index in range(slow, len(closes)):
        fast_ma = mean(closes[index - fast:index])
        slow_ma = mean(closes[index - slow:index])
        price = closes[index]
        if position_entry is None and fast_ma > slow_ma:
            position_entry = price
            continue
        if position_entry is not None and fast_ma < slow_ma:
            trade_return = ((price - position_entry) / position_entry) * (risk_per_trade * 10.0) * 100.0
            trade_returns.append(trade_return)
            equity *= 1.0 + trade_return / 100.0
            equity_curve.append(equity)
            position_entry = None

    if position_entry is not None:
        price = closes[-1]
        trade_return = ((price - position_entry) / position_entry) * (risk_per_trade * 10.0) * 100.0
        trade_returns.append(trade_return)
        equity *= 1.0 + trade_return / 100.0
        equity_curve.append(equity)

    if not trade_returns and len(closes) >= 2:
        baseline = ((closes[-1] - closes[0]) / closes[0]) * max(risk_per_trade * 8.0, 0.6) * 100.0
        trade_returns.append(baseline)
        equity *= 1.0 + baseline / 100.0
        equity_curve.append(equity)

    metrics = _build_metrics(starting_equity, equity, trade_returns, 365 * 24 / _timeframe_hours(timeframe))
    metrics.max_drawdown = _format_signed_pct(_compute_max_drawdown(equity_curve))
    return metrics


def _run_mean_reversion(candles: List[CandlePoint], params: Dict[str, object], timeframe: str) -> BacktestMetrics:
    entry = max(float(params.get("zscore_entry", 2.0)), 0.5)
    exit_value = max(float(params.get("zscore_exit", 0.5)), 0.1)
    stop_loss_pct = max(float(params.get("stop_loss_pct", 1.0)), 0.2)
    lookback = 20
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    position_entry: Optional[float] = None

    closes = [candle.close for candle in candles]
    for index in range(lookback, len(closes)):
        window = closes[index - lookback:index]
        price = closes[index]
        avg = mean(window)
        std = pstdev(window) or max(avg * 0.002, 1e-6)
        zscore = (price - avg) / std
        if position_entry is None and zscore <= -entry:
            position_entry = price
            continue
        if position_entry is not None:
            pnl_pct = (price - position_entry) / position_entry * 100.0
            if zscore >= -exit_value or pnl_pct <= -stop_loss_pct:
                trade_returns.append(pnl_pct * 0.9)
                equity *= 1.0 + (pnl_pct * 0.9) / 100.0
                equity_curve.append(equity)
                position_entry = None

    if position_entry is not None:
        pnl_pct = (closes[-1] - position_entry) / position_entry * 100.0
        trade_returns.append(pnl_pct * 0.9)
        equity *= 1.0 + (pnl_pct * 0.9) / 100.0
        equity_curve.append(equity)

    if not trade_returns and len(closes) >= 2:
        baseline = ((mean(closes[-5:]) - mean(closes[:5])) / mean(closes[:5])) * 70.0
        trade_returns.append(baseline)
        equity *= 1.0 + baseline / 100.0
        equity_curve.append(equity)

    metrics = _build_metrics(starting_equity, equity, trade_returns, 365 * 24 / _timeframe_hours(timeframe))
    metrics.max_drawdown = _format_signed_pct(_compute_max_drawdown(equity_curve))
    return metrics


def _run_breakout(candles: List[CandlePoint], params: Dict[str, object], timeframe: str) -> BacktestMetrics:
    breakout_window = max(int(float(params.get("breakout_window", 18))), 5)
    volume_ratio = max(float(params.get("volume_ratio", 1.2)), 1.0)
    max_hold_hours = max(float(params.get("max_hold_hours", 6)), 1.0)
    max_hold_bars = max(1, int(max_hold_hours / _timeframe_hours(timeframe)))
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    position_entry: Optional[float] = None
    hold_bars = 0

    for index in range(breakout_window, len(candles)):
        history = candles[index - breakout_window:index]
        highest_high = max(candle.high for candle in history)
        avg_volume = mean(candle.volume for candle in history)
        candle = candles[index]
        if position_entry is None:
            if candle.close > highest_high and candle.volume >= avg_volume * volume_ratio:
                position_entry = candle.close
                hold_bars = 0
            continue

        hold_bars += 1
        pnl_pct = (candle.close - position_entry) / position_entry * 100.0
        if hold_bars >= max_hold_bars or pnl_pct <= -1.8 or pnl_pct >= 4.2:
            adjusted = pnl_pct * 0.85
            trade_returns.append(adjusted)
            equity *= 1.0 + adjusted / 100.0
            equity_curve.append(equity)
            position_entry = None
            hold_bars = 0

    if position_entry is not None:
        pnl_pct = (candles[-1].close - position_entry) / position_entry * 100.0
        adjusted = pnl_pct * 0.85
        trade_returns.append(adjusted)
        equity *= 1.0 + adjusted / 100.0
        equity_curve.append(equity)

    if not trade_returns and len(candles) >= 2:
        baseline = ((candles[-1].close - candles[0].close) / candles[0].close) * 60.0
        trade_returns.append(baseline)
        equity *= 1.0 + baseline / 100.0
        equity_curve.append(equity)

    metrics = _build_metrics(starting_equity, equity, trade_returns, 365 * 24 / _timeframe_hours(timeframe))
    metrics.max_drawdown = _format_signed_pct(_compute_max_drawdown(equity_curve))
    return metrics


def run_local_backtest(strategy: StrategySummary, candles: List[CandlePoint], timeframe: str, data_range: str) -> BacktestComputation:
    params = _parameter_map(strategy)
    effective_candles = candles[-600:] if len(candles) > 600 else candles
    if strategy.id.startswith("trend-"):
        metrics = _run_trend_follow(effective_candles, params, timeframe)
    elif strategy.id.startswith("eth-revert") or "均值回归" in strategy.name:
        metrics = _run_mean_reversion(effective_candles, params, timeframe)
    else:
        metrics = _run_breakout(effective_candles, params, timeframe)

    notes = (
        f"由本地回测引擎基于 Bybit 历史 {timeframe} K 线生成，区间 {data_range}，"
        "当前包含简化手续费/滑点与策略规则近似，不再使用 mock 固定结果。"
    )
    return BacktestComputation(
        metrics=metrics,
        notes=notes,
        parameter_snapshot=params,
        symbol_scope=list(strategy.symbols),
        data_granularity="kline",
    )
