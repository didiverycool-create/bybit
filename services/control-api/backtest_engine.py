from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import mean, pstdev
from typing import Dict, List, Optional

from models import BacktestMetrics, CandlePoint, StrategySummary, derive_backtest_sample_quality

BACKTEST_ENGINE_MAX_CANDLES = 20_000


@dataclass
class BacktestComputation:
    metrics: BacktestMetrics
    notes: str
    parameter_snapshot: Dict[str, object]
    symbol_scope: List[str]
    data_granularity: str
    reference_only: bool
    sample_quality: str
    retrieved_candle_count: int
    used_candle_count: int
    retrieved_range_start: Optional[str]
    retrieved_range_end: Optional[str]
    used_range_start: Optional[str]
    used_range_end: Optional[str]
    history_truncated: bool


def _parameter_map(strategy: StrategySummary) -> Dict[str, object]:
    return {param.key: param.value for param in strategy.parameters}


def _timeframe_hours(timeframe: str) -> float:
    return {
        "15m": 0.25,
        "1h": 1.0,
        "4h": 4.0,
        "1d": 24.0,
    }.get(str(timeframe).lower(), 1.0)


def _duration_hours_for_range(data_range: str) -> float:
    normalized = str(data_range or "").strip()
    try:
        start_text, end_text = [part.strip() for part in normalized.split("~", 1)]
        start_dt = datetime.fromisoformat(start_text)
        end_dt = datetime.fromisoformat(end_text)
        return max((end_dt - start_dt).total_seconds() / 3600.0, 24.0)
    except Exception:
        pass

    relative_days = re.fullmatch(r"最近\s*(\d+)\s*天", normalized)
    if relative_days is not None:
        return max(float(relative_days.group(1)) * 24.0, 24.0)

    return 24.0 * 90


def resolve_data_range_bounds(
    data_range: str,
    now: Optional[datetime] = None,
) -> tuple[Optional[str], Optional[str]]:
    normalized = str(data_range or "").strip()
    if not normalized:
        return None, None

    try:
        start_text, end_text = [part.strip() for part in normalized.split("~", 1)]
        start_dt = datetime.fromisoformat(start_text)
        end_dt = datetime.fromisoformat(end_text)
        include_time = any("T" in part for part in (start_text, end_text))
        if include_time:
            return (
                start_dt.isoformat(timespec="seconds"),
                end_dt.isoformat(timespec="seconds"),
            )
        return start_dt.date().isoformat(), end_dt.date().isoformat()
    except Exception:
        pass

    relative_days = re.fullmatch(r"最近\s*(\d+)\s*天", normalized)
    if relative_days is None:
        return None, None
    days = max(int(relative_days.group(1)), 1)
    anchor = (now or datetime.now(timezone.utc).astimezone()).replace(microsecond=0)
    start = anchor - timedelta(days=days)
    return start.isoformat(timespec="seconds"), anchor.isoformat(timespec="seconds")


def estimate_candle_count_for_range(data_range: str, timeframe: str) -> int:
    duration_hours = _duration_hours_for_range(data_range)
    estimated = int(duration_hours / _timeframe_hours(timeframe))
    return max(80, estimated + 5)


def candle_limit_for_range(data_range: str, timeframe: str) -> int:
    return min(estimate_candle_count_for_range(data_range, timeframe), BACKTEST_ENGINE_MAX_CANDLES)


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


def _compute_period_returns(equity_curve: List[float]) -> List[float]:
    period_returns: List[float] = []
    for previous, current in zip(equity_curve, equity_curve[1:]):
        if previous <= 0:
            continue
        period_returns.append(((current / previous) - 1.0) * 100.0)
    return period_returns


def _compute_sharpe(period_returns: List[float], bars_per_year: float) -> float:
    if len(period_returns) < 2 or bars_per_year <= 0:
        return 0.0
    avg = mean(period_returns)
    std = pstdev(period_returns)
    if std == 0:
        return 0.0
    return avg / std * math.sqrt(bars_per_year)


def _mark_to_market_equity(entry_equity: float, trade_return_pct: float) -> float:
    return entry_equity * (1.0 + trade_return_pct / 100.0)


def _extend_equity_curve_with_scaled_price_path(
    equity_curve: List[float],
    starting_equity: float,
    closes: List[float],
    scale_multiplier: float,
) -> float:
    equity = starting_equity
    if len(closes) < 2:
        return equity
    for previous, current in zip(closes, closes[1:]):
        if previous <= 0:
            equity_curve.append(equity)
            continue
        period_return_pct = ((current / previous) - 1.0) * scale_multiplier * 100.0
        equity = _mark_to_market_equity(equity, period_return_pct)
        equity_curve.append(equity)
    return equity


def _build_metrics(
    starting_equity: float,
    ending_equity: float,
    trade_returns: List[float],
    equity_curve: List[float],
    bars_per_year: float,
    bars_elapsed: int,
) -> BacktestMetrics:
    total_return_pct = ((ending_equity / starting_equity) - 1.0) * 100.0 if starting_equity else 0.0
    annual_return_pct = total_return_pct
    if starting_equity and bars_elapsed > 0:
        gross_return = ending_equity / starting_equity
        annual_return_pct = ((gross_return ** (bars_per_year / bars_elapsed)) - 1.0) * 100.0 if gross_return > 0 else -100.0
    wins = sum(1 for value in trade_returns if value > 0)
    win_rate = (wins / len(trade_returns) * 100.0) if trade_returns else 0.0
    sharpe = _compute_sharpe(_compute_period_returns(equity_curve), bars_per_year)
    return BacktestMetrics(
        annual_return=_format_signed_pct(annual_return_pct),
        max_drawdown=_format_signed_pct(0.0),  # caller replaces this
        sharpe=f"{sharpe:.2f}",
        win_rate=f"{win_rate:.1f}%",
        pnl=_format_signed_usdt(ending_equity - starting_equity),
        trades=len(trade_returns),
    )


def _candle_time_bounds(candles: List[CandlePoint]) -> tuple[Optional[str], Optional[str]]:
    if not candles:
        return None, None
    return candles[0].time, candles[-1].time


def _run_trend_follow(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
) -> tuple[BacktestMetrics, bool]:
    fast = max(int(float(params.get("fast_ma", 21))), 2)
    slow = max(int(float(params.get("slow_ma", 55))), fast + 1)
    risk_per_trade = max(float(params.get("risk_per_trade", 1.0)), 0.2) / 100.0
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    position_entry: Optional[float] = None
    position_entry_equity = equity

    closes = [candle.close for candle in candles]
    for index in range(slow, len(closes)):
        fast_ma = mean(closes[index - fast:index])
        slow_ma = mean(closes[index - slow:index])
        price = closes[index]
        if position_entry is None and fast_ma > slow_ma:
            position_entry = price
            position_entry_equity = equity
            equity_curve.append(equity)
            continue
        if position_entry is not None:
            trade_return = ((price - position_entry) / position_entry) * (risk_per_trade * 10.0) * 100.0
            marked_equity = _mark_to_market_equity(position_entry_equity, trade_return)
            if fast_ma < slow_ma:
                trade_returns.append(trade_return)
                equity = marked_equity
                equity_curve.append(equity)
                position_entry = None
                position_entry_equity = equity
                continue
            equity_curve.append(marked_equity)
            continue
        equity_curve.append(equity)

    if position_entry is not None:
        price = closes[-1]
        trade_return = ((price - position_entry) / position_entry) * (risk_per_trade * 10.0) * 100.0
        trade_returns.append(trade_return)
        equity = _mark_to_market_equity(position_entry_equity, trade_return)
        equity_curve[-1] = equity

    used_reference_path = False
    if not trade_returns and len(closes) >= 2:
        equity = _extend_equity_curve_with_scaled_price_path(
            equity_curve,
            equity,
            closes,
            max(risk_per_trade * 8.0, 0.6),
        )
        used_reference_path = True

    metrics = _build_metrics(
        starting_equity,
        equity,
        trade_returns,
        equity_curve,
        365 * 24 / _timeframe_hours(timeframe),
        max(len(candles) - 1, 1),
    )
    metrics.max_drawdown = _format_signed_pct(_compute_max_drawdown(equity_curve))
    return metrics, used_reference_path


def _run_mean_reversion(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
) -> tuple[BacktestMetrics, bool]:
    entry = max(float(params.get("zscore_entry", 2.0)), 0.5)
    exit_value = max(float(params.get("zscore_exit", 0.5)), 0.1)
    stop_loss_pct = max(float(params.get("stop_loss_pct", 1.0)), 0.2)
    lookback = 20
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    position_entry: Optional[float] = None
    position_entry_equity = equity

    closes = [candle.close for candle in candles]
    for index in range(lookback, len(closes)):
        window = closes[index - lookback:index]
        price = closes[index]
        avg = mean(window)
        std = pstdev(window) or max(avg * 0.002, 1e-6)
        zscore = (price - avg) / std
        if position_entry is None and zscore <= -entry:
            position_entry = price
            position_entry_equity = equity
            equity_curve.append(equity)
            continue
        if position_entry is not None:
            pnl_pct = (price - position_entry) / position_entry * 100.0
            adjusted_return = pnl_pct * 0.9
            marked_equity = _mark_to_market_equity(position_entry_equity, adjusted_return)
            if zscore >= -exit_value or pnl_pct <= -stop_loss_pct:
                trade_returns.append(adjusted_return)
                equity = marked_equity
                equity_curve.append(equity)
                position_entry = None
                position_entry_equity = equity
                continue
            equity_curve.append(marked_equity)
            continue
        equity_curve.append(equity)

    if position_entry is not None:
        pnl_pct = (closes[-1] - position_entry) / position_entry * 100.0
        adjusted_return = pnl_pct * 0.9
        trade_returns.append(adjusted_return)
        equity = _mark_to_market_equity(position_entry_equity, adjusted_return)
        equity_curve[-1] = equity

    used_reference_path = False
    if not trade_returns and len(closes) >= 2:
        equity = _extend_equity_curve_with_scaled_price_path(
            equity_curve,
            equity,
            closes,
            0.7,
        )
        used_reference_path = True

    metrics = _build_metrics(
        starting_equity,
        equity,
        trade_returns,
        equity_curve,
        365 * 24 / _timeframe_hours(timeframe),
        max(len(candles) - 1, 1),
    )
    metrics.max_drawdown = _format_signed_pct(_compute_max_drawdown(equity_curve))
    return metrics, used_reference_path


def _run_breakout(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
) -> tuple[BacktestMetrics, bool]:
    breakout_window = max(int(float(params.get("breakout_window", 18))), 5)
    volume_ratio = max(float(params.get("volume_ratio", 1.2)), 1.0)
    max_hold_hours = max(float(params.get("max_hold_hours", 6)), 1.0)
    max_hold_bars = max(1, int(max_hold_hours / _timeframe_hours(timeframe)))
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    position_entry: Optional[float] = None
    position_entry_equity = equity
    hold_bars = 0

    for index in range(breakout_window, len(candles)):
        history = candles[index - breakout_window:index]
        highest_high = max(candle.high for candle in history)
        avg_volume = mean(candle.volume for candle in history)
        candle = candles[index]
        if position_entry is None:
            if candle.close > highest_high and candle.volume >= avg_volume * volume_ratio:
                position_entry = candle.close
                position_entry_equity = equity
                hold_bars = 0
                equity_curve.append(equity)
                continue
            equity_curve.append(equity)
            continue

        hold_bars += 1
        pnl_pct = (candle.close - position_entry) / position_entry * 100.0
        adjusted = pnl_pct * 0.85
        marked_equity = _mark_to_market_equity(position_entry_equity, adjusted)
        if hold_bars >= max_hold_bars or pnl_pct <= -1.8 or pnl_pct >= 4.2:
            trade_returns.append(adjusted)
            equity = marked_equity
            equity_curve.append(equity)
            position_entry = None
            position_entry_equity = equity
            hold_bars = 0
            continue
        equity_curve.append(marked_equity)

    if position_entry is not None:
        pnl_pct = (candles[-1].close - position_entry) / position_entry * 100.0
        adjusted = pnl_pct * 0.85
        trade_returns.append(adjusted)
        equity = _mark_to_market_equity(position_entry_equity, adjusted)
        equity_curve[-1] = equity

    used_reference_path = False
    if not trade_returns and len(candles) >= 2:
        closes = [candle.close for candle in candles]
        equity = _extend_equity_curve_with_scaled_price_path(
            equity_curve,
            equity,
            closes,
            0.6,
        )
        used_reference_path = True

    metrics = _build_metrics(
        starting_equity,
        equity,
        trade_returns,
        equity_curve,
        365 * 24 / _timeframe_hours(timeframe),
        max(len(candles) - 1, 1),
    )
    metrics.max_drawdown = _format_signed_pct(_compute_max_drawdown(equity_curve))
    return metrics, used_reference_path


def run_local_backtest(strategy: StrategySummary, candles: List[CandlePoint], timeframe: str, data_range: str) -> BacktestComputation:
    params = _parameter_map(strategy)
    retrieved_candle_count = len(candles)
    history_truncated = retrieved_candle_count > BACKTEST_ENGINE_MAX_CANDLES
    effective_candles = candles[-BACKTEST_ENGINE_MAX_CANDLES:] if history_truncated else candles
    used_candle_count = len(effective_candles)
    retrieved_range_start, retrieved_range_end = _candle_time_bounds(candles)
    used_range_start, used_range_end = _candle_time_bounds(effective_candles)
    if strategy.id.startswith("trend-"):
        metrics, used_reference_path = _run_trend_follow(effective_candles, params, timeframe)
    elif strategy.id.startswith("eth-revert") or "均值回归" in strategy.name:
        metrics, used_reference_path = _run_mean_reversion(effective_candles, params, timeframe)
    else:
        metrics, used_reference_path = _run_breakout(effective_candles, params, timeframe)

    notes = (
        f"由本地回测引擎基于 Bybit 历史 {timeframe} K 线生成，区间 {data_range}，"
        "当前包含简化手续费/滑点与策略规则近似，不再使用 mock 固定结果。"
    )
    if history_truncated:
        notes += f" 本次共取到 {retrieved_candle_count} 根 K 线，但回测内核当前仅使用最近 {used_candle_count} 根样本。"
    if used_reference_path:
        notes += " 本次区间未命中真实入场信号，收益/回撤基于基础价格路径生成的参考权益曲线，仅供研究参考。"
    return BacktestComputation(
        metrics=metrics,
        notes=notes,
        parameter_snapshot=params,
        symbol_scope=list(strategy.symbols),
        data_granularity="kline",
        reference_only=used_reference_path,
        sample_quality=derive_backtest_sample_quality(used_reference_path, metrics.trades),
        retrieved_candle_count=retrieved_candle_count,
        used_candle_count=used_candle_count,
        retrieved_range_start=retrieved_range_start,
        retrieved_range_end=retrieved_range_end,
        used_range_start=used_range_start,
        used_range_end=used_range_end,
        history_truncated=history_truncated,
    )
