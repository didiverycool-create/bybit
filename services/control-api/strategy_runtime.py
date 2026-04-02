from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean, pstdev
from typing import Iterable, Optional

from models import StrategyRuntimeSnapshot, StrategySummary, WatchlistInstrument


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def _param_value(strategy: StrategySummary, key: str, default: float) -> float:
    parameter = next((item for item in strategy.parameters if item.key == key), None)
    if parameter is None:
        return default
    try:
        return float(parameter.value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _tail_mean(values: Iterable[float], window: int) -> float:
    rows = list(values)
    if not rows:
        return 0.0
    return mean(rows[-max(window, 1) :])


def _evaluate_trend(strategy: StrategySummary, closes: list[float]) -> tuple[str, float, float, str, str]:
    fast_window = max(int(_param_value(strategy, "fast_ma", 21)), 3)
    slow_window = max(int(_param_value(strategy, "slow_ma", 55)), fast_window + 1)
    fast_ma = _tail_mean(closes, fast_window)
    slow_ma = _tail_mean(closes, slow_window)
    last_price = closes[-1]
    spread_pct = ((fast_ma - slow_ma) / slow_ma * 100.0) if slow_ma else 0.0

    if last_price > fast_ma > slow_ma:
        confidence = _clamp(abs(spread_pct) * 18 + 56)
        return (
            "long",
            slow_ma,
            confidence,
            f"快线 {fast_ma:.2f} 站上慢线 {slow_ma:.2f}，趋势延续。",
            "维持顺势跟踪；若要执行真实单，仍需走量化执行层风控。",
        )
    if last_price < fast_ma < slow_ma:
        confidence = _clamp(abs(spread_pct) * 16 + 48)
        return (
            "short",
            slow_ma,
            confidence,
            f"快线 {fast_ma:.2f} 跌破慢线 {slow_ma:.2f}，趋势转弱。",
            "保持空头/减仓观察；当前仅生成运行信号或纸面成交。",
        )
    confidence = _clamp(42 - abs(spread_pct) * 8, 12, 46)
    return (
        "watch",
        slow_ma,
        confidence,
        f"均线缠绕，快线 {fast_ma:.2f} 与慢线 {slow_ma:.2f} 尚未拉开。",
        "等待更明确的趋势展开后再执行。",
    )


def _evaluate_mean_revert(strategy: StrategySummary, closes: list[float]) -> tuple[str, float, float, str, str]:
    window = min(max(len(closes), 5), 30)
    sample = closes[-window:]
    baseline = mean(sample)
    std = pstdev(sample) if len(sample) >= 2 else 0.0
    last_price = sample[-1]
    zscore = (last_price - baseline) / std if std else 0.0
    entry = max(_param_value(strategy, "zscore_entry", 2.0), 0.8)
    exit_value = max(_param_value(strategy, "zscore_exit", 0.5), 0.1)

    if zscore <= -entry:
        confidence = _clamp(abs(zscore / entry) * 54 + 28)
        return (
            "long",
            baseline,
            confidence,
            f"当前 Z 值 {zscore:.2f} 低于入场阈值 -{entry:.2f}，偏离均值过深。",
            "按均值回归逻辑观察多头回补机会。",
        )
    if zscore >= entry:
        confidence = _clamp(abs(zscore / entry) * 54 + 28)
        return (
            "short",
            baseline,
            confidence,
            f"当前 Z 值 {zscore:.2f} 高于入场阈值 {entry:.2f}，均值回归条件成立。",
            "按均值回归逻辑观察空头回落机会。",
        )
    if abs(zscore) <= exit_value:
        confidence = _clamp(65 - abs(zscore) * 28, 25, 72)
        return (
            "flat",
            baseline,
            confidence,
            f"当前 Z 值 {zscore:.2f} 已回到离场带内。",
            "信号收敛，等待下一次显著偏离。",
        )
    confidence = _clamp(abs(zscore) * 20 + 18, 15, 55)
    return (
        "watch",
        baseline,
        confidence,
        f"当前 Z 值 {zscore:.2f} 处于中间区间，尚未触发入场或离场。",
        "继续观察偏离扩张或收敛。",
    )


def _evaluate_breakout(strategy: StrategySummary, closes: list[float], change_24h: float) -> tuple[str, float, float, str, str]:
    window = min(max(int(_param_value(strategy, "breakout_window", 18)), 8), max(len(closes) - 1, 8))
    latest = closes[-1]
    history = closes[-(window + 1) : -1] if len(closes) > 1 else closes
    if not history:
        history = closes[:-1] or closes
    upper = max(history)
    lower = min(history)

    if latest >= upper * 1.001 and change_24h >= 0:
        breakout_pct = ((latest - upper) / upper * 100.0) if upper else 0.0
        confidence = _clamp(58 + breakout_pct * 26 + abs(change_24h) * 1.4)
        return (
            "long",
            upper,
            confidence,
            f"最新价突破最近 {window} 根上沿 {upper:.2f}。",
            "突破条件成立，优先观察放量延续。",
        )
    if latest <= lower * 0.999 and change_24h <= 0:
        breakout_pct = ((lower - latest) / lower * 100.0) if lower else 0.0
        confidence = _clamp(56 + breakout_pct * 24 + abs(change_24h) * 1.4)
        return (
            "short",
            lower,
            confidence,
            f"最新价跌破最近 {window} 根下沿 {lower:.2f}。",
            "下破条件成立，优先观察弱势延续。",
        )
    confidence = _clamp(abs(change_24h) * 6 + 18, 12, 48)
    return (
        "watch",
        upper,
        confidence,
        f"价格仍在最近 {window} 根区间内震荡。",
        "继续观察突破确认或回到策略页查看参数。",
    )


def evaluate_strategy_runtime(
    strategy: StrategySummary,
    detail,
    watch_item: WatchlistInstrument,
    evaluated_at: Optional[str] = None,
) -> StrategyRuntimeSnapshot:
    closes = [float(item.close) for item in detail.candles if getattr(item, "close", None) is not None]
    last_price = closes[-1] if closes else float(watch_item.last_price)

    if strategy.status == "paused":
        return StrategyRuntimeSnapshot(
            strategy_id=strategy.id,
            strategy_name=strategy.name,
            symbol=watch_item.symbol,
            market=watch_item.market,
            mode=strategy.mode,
            runtime_status=strategy.status,
            signal="flat",
            confidence=0.0,
            last_price=last_price,
            reference_price=last_price,
            change_24h=float(watch_item.change_24h),
            note="当前策略处于暂停状态，不参与运行信号评估。",
            next_action="如需恢复运行，请在策略页执行启停操作。",
            last_evaluated_at=evaluated_at or _now_iso(),
        )

    if len(closes) < 6:
        return StrategyRuntimeSnapshot(
            strategy_id=strategy.id,
            strategy_name=strategy.name,
            symbol=watch_item.symbol,
            market=watch_item.market,
            mode=strategy.mode,
            runtime_status=strategy.status,
            signal="watch",
            confidence=18.0,
            last_price=last_price,
            reference_price=last_price,
            change_24h=float(watch_item.change_24h),
            note="当前历史 K 线不足，先保持观察。",
            next_action="等待更多行情样本后再生成明确信号。",
            last_evaluated_at=evaluated_at or _now_iso(),
        )

    if "趋势" in strategy.name or strategy.id.startswith("trend"):
        signal, reference_price, confidence, note, next_action = _evaluate_trend(strategy, closes)
    elif "均值回归" in strategy.name or "revert" in strategy.id:
        signal, reference_price, confidence, note, next_action = _evaluate_mean_revert(strategy, closes)
    else:
        signal, reference_price, confidence, note, next_action = _evaluate_breakout(strategy, closes, watch_item.change_24h)

    return StrategyRuntimeSnapshot(
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        symbol=watch_item.symbol,
        market=watch_item.market,
        mode=strategy.mode,
        runtime_status=strategy.status,
        signal=signal,
        confidence=round(confidence, 1),
        last_price=round(last_price, 6),
        reference_price=round(reference_price, 6),
        change_24h=float(watch_item.change_24h),
        note=note,
        next_action=next_action,
        last_evaluated_at=evaluated_at or _now_iso(),
    )
