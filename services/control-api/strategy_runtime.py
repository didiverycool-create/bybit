from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean, pstdev
from typing import Any, Dict, Iterable, List, Optional

from models import StrategyRuntimeSnapshot, StrategySummary, WatchlistInstrument


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


# ---------------------------------------------------------------------------
# Round 46 — signal confidence calibration
# ---------------------------------------------------------------------------
#
# The three kernel-level ``_evaluate_*`` functions historically clamped the
# raw confidence into ``[12, 72]`` via ``_clamp``. Round 46 introduces an
# additive post-processing step so operators can dial the confidence scale in
# three complementary ways without touching the signal logic itself:
#
#   1. ``confidence_regime_adjustments`` multiplies confidence based on the
#      current volatility regime (low / normal / high).
#   2. ``confidence_parameter_drift_penalty`` subtracts a linear penalty
#      proportional to how far the strategy parameters drift from their
#      default values.
#   3. ``confidence_multi_timeframe_alignment`` applies a 1.1× bonus when a
#      higher-timeframe alignment hint is explicitly ``True`` and a 0.85×
#      discount when it is explicitly ``False``; a ``None`` hint leaves the
#      value untouched.
#
# The range after calibration is ``[0, 99]`` — intentionally wider than the
# original ``[12, 72]`` so operators can push confidence all the way down to
# zero (for a total kill-switch effect via multipliers) or nearly to the top.
# Every knob defaults to "no-op" so legacy strategies produce bit-exact
# confidences to the Round 45 baseline unless they explicitly opt in.

# Default parameter values the kernel uses when a strategy does not supply an
# override. Keeping these in one place makes the drift computation below
# trivial to audit and also keeps the kernel evaluators untouched.
_TREND_DEFAULT_PARAMS: Dict[str, float] = {
    "fast_ma": 21.0,
    "slow_ma": 55.0,
    "stop_loss_pct": 1.2,
    "take_profit_pct": 3.0,
}
_MEAN_REVERT_DEFAULT_PARAMS: Dict[str, float] = {
    "zscore_entry": 2.0,
    "zscore_exit": 0.5,
}
_BREAKOUT_DEFAULT_PARAMS: Dict[str, float] = {
    "breakout_window": 18.0,
    "stop_loss_pct": 1.8,
    "take_profit_pct": 4.2,
}
# Round 47 — drift defaults for the three newly-added kernels. Each mirrors
# the evaluator's built-in parameter defaults so a strategy that leaves every
# tunable at its preset value produces a drift score of ``0.0`` (no penalty).
_MOMENTUM_DEFAULT_PARAMS: Dict[str, float] = {
    "roc_window": 10.0,
    "ema_trend_window": 20.0,
    "momentum_threshold_pct": 2.0,
}
_BOLLINGER_SQUEEZE_DEFAULT_PARAMS: Dict[str, float] = {
    "bollinger_window": 20.0,
    "bollinger_std": 2.0,
    "squeeze_bandwidth_pct": 2.5,
}
_RSI_REVERSAL_DEFAULT_PARAMS: Dict[str, float] = {
    "rsi_window": 14.0,
    "rsi_overbought": 70.0,
    "rsi_oversold": 30.0,
}


def _parameter_drift_score(strategy: StrategySummary, defaults: Dict[str, float]) -> float:
    """Average relative drift between ``strategy`` parameters and their kernel
    defaults. A strategy that matches every default scores ``0.0``. Each
    parameter contributes ``|current - default| / (|default| + 1e-9)`` so a
    doubling of a parameter contributes ``~1.0``. The final score is the mean
    across all defaulted keys — bounded below by ``0.0`` but otherwise
    unbounded, so the penalty coefficient decides how aggressively drift is
    discounted.
    """

    if not defaults:
        return 0.0
    drifts: List[float] = []
    for key, default_value in defaults.items():
        # ``_param_value`` already returns the strategy override (or the
        # supplied default when missing). We deliberately pass the exact
        # default to reuse the kernel's float-coercion / missing-key handling.
        current = _param_value(strategy, key, default_value)
        drifts.append(abs(current - default_value) / (abs(default_value) + 1e-9))
    return sum(drifts) / len(drifts)


def apply_confidence_calibration(
    base_confidence: float,
    *,
    strategy: StrategySummary,
    regime: Optional[str] = None,
    parameter_drift_score: float = 0.0,
    multi_timeframe_aligned: Optional[bool] = None,
) -> float:
    """Round 46 post-process for kernel confidence scores.

    Returns ``base_confidence`` unchanged when the strategy has not opted in
    via ``confidence_calibration_enabled``; this keeps the Round 45 baseline
    bit-exact for legacy strategies. When calibration is on the pipeline is:

        calibrated = base_confidence
        calibrated *= regime_multiplier       # 1.0 when regime not mapped
        calibrated -= drift_score * penalty   # no-op when penalty is 0
        calibrated *= 1.1 / 0.85               # only when multi_tf bool set

    Finally clamped into ``[0, 99]`` (widened from the kernel-native ``[12,
    72]`` so operators can scale confidence to the extremes without the
    calibration being "eaten" by the clamp).
    """

    if not getattr(strategy, "confidence_calibration_enabled", False):
        return base_confidence

    calibrated = float(base_confidence)

    # 1. Regime multiplier — applied when adjustments are populated. A
    # ``None`` / unknown regime falls back to the ``normal`` slot so callers
    # that lack ATR data still get predictable, documented behaviour (rather
    # than silently skipping the regime step entirely). Unknown regime
    # labels likewise collapse onto ``normal`` so a future regime name never
    # breaks deployments — it just neutralises the regime step until the
    # adjustments object is updated.
    adjustments = getattr(strategy, "confidence_regime_adjustments", None)
    if adjustments is not None:
        resolved_regime = regime if regime in {"low", "normal", "high"} else "normal"
        try:
            multiplier = float(getattr(adjustments, resolved_regime))
        except (AttributeError, TypeError, ValueError):
            multiplier = 1.0
        calibrated *= multiplier

    # 2. Parameter drift penalty — linear penalty in confidence points.
    penalty = getattr(strategy, "confidence_parameter_drift_penalty", 0.0) or 0.0
    try:
        penalty_coeff = float(penalty)
    except (TypeError, ValueError):
        penalty_coeff = 0.0
    if penalty_coeff:
        try:
            drift = float(parameter_drift_score)
        except (TypeError, ValueError):
            drift = 0.0
        calibrated -= drift * penalty_coeff

    # 3. Multi-timeframe alignment bonus / penalty. ``None`` is the neutral
    # sentinel (caller has no higher-TF data); only explicit ``True`` /
    # ``False`` touch the confidence.
    if getattr(strategy, "confidence_multi_timeframe_alignment", False) and multi_timeframe_aligned is not None:
        calibrated *= 1.1 if multi_timeframe_aligned else 0.85

    return _clamp(calibrated, 0.0, 99.0)


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


def _evaluate_trend(
    strategy: StrategySummary,
    closes: list[float],
    *,
    regime: Optional[str] = None,
    multi_timeframe_hint: Optional[bool] = None,
) -> tuple[str, float, float, str, str]:
    fast_window = max(int(_param_value(strategy, "fast_ma", 21)), 3)
    slow_window = max(int(_param_value(strategy, "slow_ma", 55)), fast_window + 1)
    fast_ma = _tail_mean(closes, fast_window)
    slow_ma = _tail_mean(closes, slow_window)
    last_price = closes[-1]
    spread_pct = ((fast_ma - slow_ma) / slow_ma * 100.0) if slow_ma else 0.0

    # Drift score is computed once and fed to calibration at the end. When
    # calibration is not opted in the penalty has no effect, so the extra
    # work is negligible (three ``_param_value`` reads).
    drift = _parameter_drift_score(strategy, _TREND_DEFAULT_PARAMS)

    if last_price > fast_ma > slow_ma:
        base = _clamp(abs(spread_pct) * 18 + 56)
        confidence = apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )
        return (
            "long",
            slow_ma,
            confidence,
            f"快线 {fast_ma:.2f} 站上慢线 {slow_ma:.2f}，趋势延续。",
            "维持顺势跟踪；若要执行真实单，仍需走量化执行层风控。",
        )
    if last_price < fast_ma < slow_ma:
        base = _clamp(abs(spread_pct) * 16 + 48)
        confidence = apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )
        return (
            "short",
            slow_ma,
            confidence,
            f"快线 {fast_ma:.2f} 跌破慢线 {slow_ma:.2f}，趋势转弱。",
            "保持空头/减仓观察；当前仅生成运行信号或纸面成交。",
        )
    base = _clamp(42 - abs(spread_pct) * 8, 12, 46)
    confidence = apply_confidence_calibration(
        base,
        strategy=strategy,
        regime=regime,
        parameter_drift_score=drift,
        multi_timeframe_aligned=multi_timeframe_hint,
    )
    return (
        "watch",
        slow_ma,
        confidence,
        f"均线缠绕，快线 {fast_ma:.2f} 与慢线 {slow_ma:.2f} 尚未拉开。",
        "等待更明确的趋势展开后再执行。",
    )


def _evaluate_mean_revert(
    strategy: StrategySummary,
    closes: list[float],
    *,
    regime: Optional[str] = None,
    multi_timeframe_hint: Optional[bool] = None,
) -> tuple[str, float, float, str, str]:
    window = min(max(len(closes), 5), 30)
    sample = closes[-window:]
    baseline = mean(sample)
    std = pstdev(sample) if len(sample) >= 2 else 0.0
    last_price = sample[-1]
    zscore = (last_price - baseline) / std if std else 0.0
    entry = max(_param_value(strategy, "zscore_entry", 2.0), 0.8)
    exit_value = max(_param_value(strategy, "zscore_exit", 0.5), 0.1)

    drift = _parameter_drift_score(strategy, _MEAN_REVERT_DEFAULT_PARAMS)

    if zscore <= -entry:
        base = _clamp(abs(zscore / entry) * 54 + 28)
        confidence = apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )
        return (
            "long",
            baseline,
            confidence,
            f"当前 Z 值 {zscore:.2f} 低于入场阈值 -{entry:.2f}，偏离均值过深。",
            "按均值回归逻辑观察多头回补机会。",
        )
    if zscore >= entry:
        base = _clamp(abs(zscore / entry) * 54 + 28)
        confidence = apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )
        return (
            "short",
            baseline,
            confidence,
            f"当前 Z 值 {zscore:.2f} 高于入场阈值 {entry:.2f}，均值回归条件成立。",
            "按均值回归逻辑观察空头回落机会。",
        )
    if abs(zscore) <= exit_value:
        base = _clamp(65 - abs(zscore) * 28, 25, 72)
        confidence = apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )
        return (
            "flat",
            baseline,
            confidence,
            f"当前 Z 值 {zscore:.2f} 已回到离场带内。",
            "信号收敛，等待下一次显著偏离。",
        )
    base = _clamp(abs(zscore) * 20 + 18, 15, 55)
    confidence = apply_confidence_calibration(
        base,
        strategy=strategy,
        regime=regime,
        parameter_drift_score=drift,
        multi_timeframe_aligned=multi_timeframe_hint,
    )
    return (
        "watch",
        baseline,
        confidence,
        f"当前 Z 值 {zscore:.2f} 处于中间区间，尚未触发入场或离场。",
        "继续观察偏离扩张或收敛。",
    )


def _evaluate_breakout(
    strategy: StrategySummary,
    closes: list[float],
    change_24h: float,
    *,
    regime: Optional[str] = None,
    multi_timeframe_hint: Optional[bool] = None,
) -> tuple[str, float, float, str, str]:
    window = min(max(int(_param_value(strategy, "breakout_window", 18)), 8), max(len(closes) - 1, 8))
    latest = closes[-1]
    history = closes[-(window + 1) : -1] if len(closes) > 1 else closes
    if not history:
        history = closes[:-1] or closes
    upper = max(history)
    lower = min(history)

    drift = _parameter_drift_score(strategy, _BREAKOUT_DEFAULT_PARAMS)

    if latest >= upper * 1.001 and change_24h >= 0:
        breakout_pct = ((latest - upper) / upper * 100.0) if upper else 0.0
        base = _clamp(58 + breakout_pct * 26 + abs(change_24h) * 1.4)
        confidence = apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )
        return (
            "long",
            upper,
            confidence,
            f"最新价突破最近 {window} 根上沿 {upper:.2f}。",
            "突破条件成立，优先观察放量延续。",
        )
    if latest <= lower * 0.999 and change_24h <= 0:
        breakout_pct = ((lower - latest) / lower * 100.0) if lower else 0.0
        base = _clamp(56 + breakout_pct * 24 + abs(change_24h) * 1.4)
        confidence = apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )
        return (
            "short",
            lower,
            confidence,
            f"最新价跌破最近 {window} 根下沿 {lower:.2f}。",
            "下破条件成立，优先观察弱势延续。",
        )
    base = _clamp(abs(change_24h) * 6 + 18, 12, 48)
    confidence = apply_confidence_calibration(
        base,
        strategy=strategy,
        regime=regime,
        parameter_drift_score=drift,
        multi_timeframe_aligned=multi_timeframe_hint,
    )
    return (
        "watch",
        upper,
        confidence,
        f"价格仍在最近 {window} 根区间内震荡。",
        "继续观察突破确认或回到策略页查看参数。",
    )


# ---------------------------------------------------------------------------
# Round 47 — three additional kernels: momentum / bollinger squeeze / RSI
# reversal. Each evaluate helper mirrors the shape of the Round 45 kernels
# (``_evaluate_trend`` / ``_evaluate_mean_revert`` / ``_evaluate_breakout``):
# it returns a ``(signal, reference_price, confidence, note, next_action)``
# tuple and routes its raw confidence through ``apply_confidence_calibration``
# so every Round 46 opt-in knob continues to work without any extra wiring.
# ---------------------------------------------------------------------------


def _ema_series(values: List[float], window: int) -> List[float]:
    """Classic exponential moving average over ``values``. Returns a list of
    the same length so callers can index by bar. The first element seeds the
    EMA with the first close (avoids a warm-up NaN) and every subsequent
    element uses the standard ``alpha = 2 / (window + 1)`` recursion.
    """

    if not values:
        return []
    span = max(int(window), 1)
    alpha = 2.0 / (span + 1.0)
    result: List[float] = []
    prev = float(values[0])
    result.append(prev)
    for raw in values[1:]:
        current = float(raw)
        prev = (current - prev) * alpha + prev
        result.append(prev)
    return result


def _rsi_value(values: List[float], window: int) -> float:
    """Wilder-smoothed RSI at the last element of ``values``. Returns ``50.0``
    (the neutral reading) when the sample is too short or every period is
    flat — avoids injecting spurious signal fidelity when the input is
    degenerate.
    """

    span = max(int(window), 2)
    if len(values) <= span:
        return 50.0
    gains: List[float] = []
    losses: List[float] = []
    for previous, current in zip(values[:-1], values[1:]):
        delta = float(current) - float(previous)
        if delta >= 0.0:
            gains.append(delta)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(-delta)
    # Wilder smoothing: seed with a simple mean of the first ``span`` deltas,
    # then roll forward using ``avg = (prev_avg * (span - 1) + current) / span``.
    avg_gain = sum(gains[:span]) / span
    avg_loss = sum(losses[:span]) / span
    for gain_value, loss_value in zip(gains[span:], losses[span:]):
        avg_gain = (avg_gain * (span - 1) + gain_value) / span
        avg_loss = (avg_loss * (span - 1) + loss_value) / span
    if avg_loss <= 0.0:
        # Strongest possible uptrend — every period closed higher. Clamp to
        # ``100.0`` rather than returning infinity so downstream comparisons
        # against the overbought threshold still behave.
        return 100.0 if avg_gain > 0.0 else 50.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def _bollinger_bandwidth_pct(
    sample: List[float], std_multiplier: float
) -> tuple[float, float, float, float]:
    """Return ``(mid, upper, lower, bandwidth_pct)`` for a single Bollinger
    window. ``bandwidth_pct`` is ``(upper - lower) / mid * 100`` — a plain
    percentage so callers can compare it with ``squeeze_bandwidth_pct``
    without additional scaling.
    """

    if not sample:
        return 0.0, 0.0, 0.0, 0.0
    mid = mean(sample)
    std = pstdev(sample) if len(sample) >= 2 else 0.0
    upper = mid + std_multiplier * std
    lower = mid - std_multiplier * std
    bandwidth_pct = ((upper - lower) / mid * 100.0) if mid else 0.0
    return mid, upper, lower, bandwidth_pct


def _evaluate_momentum(
    strategy: StrategySummary,
    closes: List[float],
    *,
    regime: Optional[str] = None,
    multi_timeframe_hint: Optional[bool] = None,
) -> tuple[str, float, float, str, str]:
    """Kernel 4 — ROC + EMA confirmation momentum kernel."""

    roc_window = max(int(_param_value(strategy, "roc_window", 10)), 2)
    ema_window = max(int(_param_value(strategy, "ema_trend_window", 20)), 2)
    threshold = max(_param_value(strategy, "momentum_threshold_pct", 2.0), 0.1)
    drift = _parameter_drift_score(strategy, _MOMENTUM_DEFAULT_PARAMS)

    last_price = closes[-1]
    # ROC uses the close ``roc_window`` bars ago; when the history is too
    # short we fall back to the earliest close so the kernel still produces a
    # well-defined but muted reading instead of raising.
    reference_index = max(len(closes) - 1 - roc_window, 0)
    reference_close = closes[reference_index] or 1e-9
    roc_pct = (last_price - reference_close) / reference_close * 100.0
    ema_values = _ema_series(closes, ema_window)
    ema_last = ema_values[-1] if ema_values else last_price

    def _calibrate(base: float) -> float:
        return apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )

    if roc_pct >= threshold and last_price > ema_last:
        base = _clamp(abs(roc_pct / threshold) * 45.0 + 30.0)
        return (
            "long",
            ema_last,
            _calibrate(base),
            f"ROC({roc_window}) {roc_pct:+.2f}% 超过阈值 {threshold:.2f}%，价格站上 EMA{ema_window} {ema_last:.2f}。",
            "按动量策略跟踪；若要执行真实单，仍需走量化执行层风控。",
        )
    if roc_pct <= -threshold and last_price < ema_last:
        base = _clamp(abs(roc_pct / threshold) * 45.0 + 30.0)
        return (
            "short",
            ema_last,
            _calibrate(base),
            f"ROC({roc_window}) {roc_pct:+.2f}% 低于阈值 -{threshold:.2f}%，价格跌破 EMA{ema_window} {ema_last:.2f}。",
            "按动量空头逻辑观察加速下行。",
        )
    base = _clamp(30.0 - abs(roc_pct) * 2.0, 12, 48)
    return (
        "watch",
        ema_last,
        _calibrate(base),
        f"ROC({roc_window}) {roc_pct:+.2f}% 尚未突破动量阈值 ±{threshold:.2f}%。",
        "等待更明确的动量信号，或在策略页调整 ROC 窗口。",
    )


def _evaluate_bollinger_squeeze(
    strategy: StrategySummary,
    closes: List[float],
    *,
    regime: Optional[str] = None,
    multi_timeframe_hint: Optional[bool] = None,
) -> tuple[str, float, float, str, str]:
    """Kernel 5 — Bollinger squeeze breakout kernel."""

    window = max(int(_param_value(strategy, "bollinger_window", 20)), 5)
    std_multiplier = max(_param_value(strategy, "bollinger_std", 2.0), 0.5)
    squeeze_pct = max(_param_value(strategy, "squeeze_bandwidth_pct", 2.5), 0.1)
    drift = _parameter_drift_score(strategy, _BOLLINGER_SQUEEZE_DEFAULT_PARAMS)

    usable_window = min(window, len(closes))
    sample = closes[-usable_window:]
    mid, upper, lower, bandwidth_pct = _bollinger_bandwidth_pct(sample, std_multiplier)
    last_price = closes[-1]

    # Check whether any of the last ``usable_window`` windows were in a
    # squeeze. This gates the breakout branch — we only fire when the band
    # was genuinely compressed beforehand, not on every random band touch.
    squeeze_detected = False
    history_span = min(usable_window, len(closes))
    for anchor in range(max(len(closes) - history_span, 0), len(closes)):
        anchor_sample = closes[max(anchor - usable_window + 1, 0) : anchor + 1]
        if len(anchor_sample) < 2:
            continue
        _, _, _, anchor_bw = _bollinger_bandwidth_pct(anchor_sample, std_multiplier)
        if anchor_bw < squeeze_pct:
            squeeze_detected = True
            break

    def _calibrate(base: float) -> float:
        return apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )

    if squeeze_detected and last_price > upper and upper > 0:
        breakout_pct = (last_price - upper) / upper * 100.0
        base = _clamp(55.0 + breakout_pct * 25.0)
        return (
            "long",
            mid,
            _calibrate(base),
            f"布林带压缩后突破上轨 {upper:.2f}，当前 {last_price:.2f}。",
            "在压缩突破方向上跟踪；关注能否放量延续。",
        )
    if squeeze_detected and last_price < lower and lower > 0:
        breakout_pct = (lower - last_price) / lower * 100.0
        base = _clamp(55.0 + breakout_pct * 25.0)
        return (
            "short",
            mid,
            _calibrate(base),
            f"布林带压缩后跌破下轨 {lower:.2f}，当前 {last_price:.2f}。",
            "在压缩跌破方向上观察弱势延续。",
        )
    base = _clamp(40.0 - bandwidth_pct * 2.0, 15, 55)
    return (
        "watch",
        mid,
        _calibrate(base),
        f"布林带带宽 {bandwidth_pct:.2f}%，尚未满足压缩突破条件。",
        "继续观察带宽是否持续压缩至阈值以下。",
    )


def _evaluate_rsi_reversal(
    strategy: StrategySummary,
    closes: List[float],
    *,
    regime: Optional[str] = None,
    multi_timeframe_hint: Optional[bool] = None,
) -> tuple[str, float, float, str, str]:
    """Kernel 6 — RSI overbought / oversold reversal kernel."""

    window = max(int(_param_value(strategy, "rsi_window", 14)), 2)
    overbought = _param_value(strategy, "rsi_overbought", 70.0)
    oversold = _param_value(strategy, "rsi_oversold", 30.0)
    # Defensive clamp: operators sometimes swap the two thresholds. The mean-
    # revert logic below assumes ``oversold < overbought`` so we swap when
    # inverted rather than silently producing inverted signals.
    if oversold > overbought:
        oversold, overbought = overbought, oversold
    drift = _parameter_drift_score(strategy, _RSI_REVERSAL_DEFAULT_PARAMS)

    rsi = _rsi_value(closes, window)
    last_price = closes[-1]
    # ``distance_from_midline`` is the gap from the 50 neutral reading — the
    # deeper the RSI sits in the extreme zone, the higher the confidence.
    distance_from_midline = abs(rsi - 50.0)

    def _calibrate(base: float) -> float:
        return apply_confidence_calibration(
            base,
            strategy=strategy,
            regime=regime,
            parameter_drift_score=drift,
            multi_timeframe_aligned=multi_timeframe_hint,
        )

    if rsi <= oversold:
        base = _clamp(distance_from_midline * 1.8 + 30.0)
        return (
            "long",
            last_price,
            _calibrate(base),
            f"RSI({window}) {rsi:.1f} 低于超卖阈值 {oversold:.1f}，预期反弹。",
            "按 RSI 反转逻辑观察多头回补；仍需走量化执行层风控。",
        )
    if rsi >= overbought:
        base = _clamp(distance_from_midline * 1.8 + 30.0)
        return (
            "short",
            last_price,
            _calibrate(base),
            f"RSI({window}) {rsi:.1f} 高于超买阈值 {overbought:.1f}，预期回调。",
            "按 RSI 反转逻辑观察空头回落；仍需走量化执行层风控。",
        )
    base = _clamp(45.0 - distance_from_midline, 15, 55)
    return (
        "watch",
        last_price,
        _calibrate(base),
        f"RSI({window}) {rsi:.1f} 处于中性区间 [{oversold:.1f}, {overbought:.1f}]。",
        "等待 RSI 进入超买或超卖区间后再行动。",
    )


def _infer_volatility_regime(strategy: StrategySummary, detail: Any) -> Optional[str]:
    """Best-effort regime classifier used by the confidence calibration path.

    Returns ``None`` when calibration is off, the thresholds are missing, or
    the candle stream does not carry enough ``high`` / ``low`` data to
    compute an ATR. Legacy strategies therefore always skip this helper's
    regime-multiplier branch entirely and keep producing bit-exact
    confidences. When calibration is on the helper:

    1. Computes a rolling ATR over ``volatility_lookback`` bars (defaults to
       ``14`` to match the Round 45 sizing path).
    2. Converts the most recent ATR into an ATR-as-percent-of-price value.
    3. Classifies the value against ``volatility_regime_thresholds`` into
       one of ``"low"`` / ``"normal"`` / ``"high"``.

    The classifier intentionally ignores ``volatility_sizing_enabled`` so
    operators can opt-in to calibration without also opting into the Round
    45 dynamic-sizing pipeline.
    """

    if not getattr(strategy, "confidence_calibration_enabled", False):
        return None

    thresholds = getattr(strategy, "volatility_regime_thresholds", None)
    if thresholds is None:
        return None

    candles = getattr(detail, "candles", None) or []
    if not candles:
        return None

    raw_lookback = getattr(strategy, "volatility_lookback", None) or 14
    try:
        lookback = max(int(raw_lookback), 1)
    except (TypeError, ValueError):
        lookback = 14

    true_ranges: List[float] = []
    prev_close: Optional[float] = None
    for candle in candles:
        high = getattr(candle, "high", None)
        low = getattr(candle, "low", None)
        close = getattr(candle, "close", None)
        if high is None or low is None or close is None:
            return None
        try:
            high_f = float(high)
            low_f = float(low)
            close_f = float(close)
        except (TypeError, ValueError):
            return None
        if prev_close is None:
            tr = high_f - low_f
        else:
            tr = max(
                high_f - low_f,
                abs(high_f - prev_close),
                abs(low_f - prev_close),
            )
        true_ranges.append(tr)
        prev_close = close_f

    if len(true_ranges) < lookback:
        return None
    atr = mean(true_ranges[-lookback:])
    last_close = prev_close or 0.0
    if last_close <= 0:
        return None
    atr_pct = atr / last_close * 100.0

    try:
        low_pct = float(thresholds.low_pct)
        high_pct = float(thresholds.high_pct)
    except (AttributeError, TypeError, ValueError):
        return None

    if atr_pct < low_pct:
        return "low"
    if atr_pct > high_pct:
        return "high"
    return "normal"


def evaluate_strategy_runtime(
    strategy: StrategySummary,
    detail,
    watch_item: WatchlistInstrument,
    evaluated_at: Optional[str] = None,
    *,
    multi_timeframe_hint: Optional[bool] = None,
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

    # Resolve the current volatility regime for calibration. When the
    # strategy has not opted in (or the candle stream lacks high / low data)
    # the regime stays ``None`` and the calibration pipeline short-circuits
    # on the enabled-flag anyway, so this path is a strict no-op for legacy
    # strategies.
    regime = _infer_volatility_regime(strategy, detail)

    # Round 47 — kernel routing. ``strategy.kernel`` is an explicit opt-in
    # override (None falls back to the legacy id / name heuristic so existing
    # payloads route identically to pre-R47). The three new kernels never
    # match the legacy heuristic so omitting ``strategy.kernel`` keeps
    # ``_evaluate_trend`` / ``_evaluate_mean_revert`` / ``_evaluate_breakout``
    # untouched for every strategy currently in production.
    kernel_override = getattr(strategy, "kernel", None)
    if kernel_override == "momentum" or strategy.id.startswith("momentum"):
        signal, reference_price, confidence, note, next_action = _evaluate_momentum(
            strategy,
            closes,
            regime=regime,
            multi_timeframe_hint=multi_timeframe_hint,
        )
    elif kernel_override == "bollinger_squeeze" or strategy.id.startswith("bollinger"):
        signal, reference_price, confidence, note, next_action = _evaluate_bollinger_squeeze(
            strategy,
            closes,
            regime=regime,
            multi_timeframe_hint=multi_timeframe_hint,
        )
    elif kernel_override == "rsi_reversal" or strategy.id.startswith("rsi"):
        signal, reference_price, confidence, note, next_action = _evaluate_rsi_reversal(
            strategy,
            closes,
            regime=regime,
            multi_timeframe_hint=multi_timeframe_hint,
        )
    elif kernel_override == "trend" or "趋势" in strategy.name or strategy.id.startswith("trend"):
        signal, reference_price, confidence, note, next_action = _evaluate_trend(
            strategy,
            closes,
            regime=regime,
            multi_timeframe_hint=multi_timeframe_hint,
        )
    elif kernel_override == "mean_revert" or "均值回归" in strategy.name or "revert" in strategy.id:
        signal, reference_price, confidence, note, next_action = _evaluate_mean_revert(
            strategy,
            closes,
            regime=regime,
            multi_timeframe_hint=multi_timeframe_hint,
        )
    else:
        signal, reference_price, confidence, note, next_action = _evaluate_breakout(
            strategy,
            closes,
            watch_item.change_24h,
            regime=regime,
            multi_timeframe_hint=multi_timeframe_hint,
        )

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


def _family_for_strategy(strategy: StrategySummary) -> str:
    # Round 47 — the opt-in ``strategy.kernel`` override takes precedence so
    # strategies that explicitly tag themselves route to the matching family.
    # ``None`` falls through to the legacy heuristic, keeping pre-R47 payloads
    # bit-exact.
    kernel_override = getattr(strategy, "kernel", None)
    if kernel_override in {"momentum", "bollinger_squeeze", "rsi_reversal", "trend", "mean_revert", "breakout"}:
        return str(kernel_override)
    if strategy.id.startswith("momentum"):
        return "momentum"
    if strategy.id.startswith("bollinger"):
        return "bollinger_squeeze"
    if strategy.id.startswith("rsi"):
        return "rsi_reversal"
    if "趋势" in strategy.name or strategy.id.startswith("trend"):
        return "trend"
    if "均值回归" in strategy.name or "revert" in strategy.id:
        return "mean_revert"
    return "breakout"


def _pct_distance(reference: float, price: float) -> float:
    if not reference:
        return 0.0
    return (price - reference) / reference * 100.0


def _trend_risk_hint(strategy: StrategySummary, closes: List[float]) -> Dict[str, Any]:
    fast_window = max(int(_param_value(strategy, "fast_ma", 21)), 3)
    slow_window = max(int(_param_value(strategy, "slow_ma", 55)), fast_window + 1)
    stop_loss_pct = max(_param_value(strategy, "stop_loss_pct", 1.2), 0.2)
    take_profit_pct = max(_param_value(strategy, "take_profit_pct", 3.0), stop_loss_pct + 0.3)
    fast_ma = _tail_mean(closes, fast_window)
    slow_ma = _tail_mean(closes, slow_window)
    last_price = closes[-1]
    if last_price > fast_ma > slow_ma:
        bias = "long"
        stop_price = last_price * (1.0 - stop_loss_pct / 100.0)
        target_price = last_price * (1.0 + take_profit_pct / 100.0)
    elif last_price < fast_ma < slow_ma:
        bias = "short"
        stop_price = last_price * (1.0 + stop_loss_pct / 100.0)
        target_price = last_price * (1.0 - take_profit_pct / 100.0)
    else:
        bias = "watch"
        stop_price = slow_ma
        target_price = fast_ma
    return {
        "family": "trend",
        "bias": bias,
        "stop_price": round(stop_price, 6),
        "target_price": round(target_price, 6),
        "stop_distance_pct": round(_pct_distance(last_price, stop_price), 3),
        "target_distance_pct": round(_pct_distance(last_price, target_price), 3),
        "fast_ma": round(fast_ma, 6),
        "slow_ma": round(slow_ma, 6),
        "stop_loss_pct": round(stop_loss_pct, 3),
        "take_profit_pct": round(take_profit_pct, 3),
    }


def _mean_revert_risk_hint(strategy: StrategySummary, closes: List[float]) -> Dict[str, Any]:
    window = min(max(len(closes), 5), 30)
    sample = closes[-window:]
    baseline = mean(sample)
    std = pstdev(sample) if len(sample) >= 2 else 0.0
    last_price = sample[-1]
    entry = max(_param_value(strategy, "zscore_entry", 2.0), 0.8)
    exit_value = max(_param_value(strategy, "zscore_exit", 0.5), 0.1)
    zscore = (last_price - baseline) / std if std else 0.0
    if zscore <= -entry:
        bias = "long"
    elif zscore >= entry:
        bias = "short"
    elif abs(zscore) <= exit_value:
        bias = "flat"
    else:
        bias = "watch"
    long_entry_price = baseline - entry * std
    short_entry_price = baseline + entry * std
    upper_exit = baseline + exit_value * std
    lower_exit = baseline - exit_value * std
    return {
        "family": "mean_revert",
        "bias": bias,
        "baseline_price": round(baseline, 6),
        "zscore": round(zscore, 3),
        "long_entry_price": round(long_entry_price, 6),
        "short_entry_price": round(short_entry_price, 6),
        "long_exit_price": round(upper_exit, 6),
        "short_exit_price": round(lower_exit, 6),
        "stop_price": round(lower_exit if bias == "long" else upper_exit if bias == "short" else baseline, 6),
        "target_price": round(baseline, 6),
        "zscore_entry": round(entry, 3),
        "zscore_exit": round(exit_value, 3),
    }


def _breakout_risk_hint(strategy: StrategySummary, closes: List[float]) -> Dict[str, Any]:
    window = min(max(int(_param_value(strategy, "breakout_window", 18)), 8), max(len(closes) - 1, 8))
    latest = closes[-1]
    history = closes[-(window + 1) : -1] if len(closes) > 1 else closes
    if not history:
        history = closes[:-1] or closes
    upper = max(history)
    lower = min(history)
    stop_loss_pct = max(_param_value(strategy, "stop_loss_pct", 1.8), 0.3)
    take_profit_pct = max(_param_value(strategy, "take_profit_pct", 4.2), stop_loss_pct + 0.4)
    if latest >= upper * 1.001:
        bias = "long"
        stop_price = latest * (1.0 - stop_loss_pct / 100.0)
        target_price = latest * (1.0 + take_profit_pct / 100.0)
    elif latest <= lower * 0.999:
        bias = "short"
        stop_price = latest * (1.0 + stop_loss_pct / 100.0)
        target_price = latest * (1.0 - take_profit_pct / 100.0)
    else:
        bias = "watch"
        stop_price = lower
        target_price = upper
    return {
        "family": "breakout",
        "bias": bias,
        "upper_band": round(upper, 6),
        "lower_band": round(lower, 6),
        "stop_price": round(stop_price, 6),
        "target_price": round(target_price, 6),
        "stop_distance_pct": round(_pct_distance(latest, stop_price), 3),
        "target_distance_pct": round(_pct_distance(latest, target_price), 3),
        "window": window,
        "stop_loss_pct": round(stop_loss_pct, 3),
        "take_profit_pct": round(take_profit_pct, 3),
    }


def _exit_tool_hint(strategy: StrategySummary) -> Dict[str, Any]:
    """Surface opt-in exit tooling (trailing stop / break-even / partial TP)
    onto the runtime risk-hint payload so downstream consumers can render the
    extra exit rungs without re-loading the strategy parameters.

    Every field is optional and ``None`` by default, so strategies that have
    not opted in produce ``{"trailing_stop_pct": None, ...}`` and existing
    consumers that key on the legacy ``stop_price`` / ``target_price`` fields
    keep working without change.
    """

    trailing_stop_pct = getattr(strategy, "trailing_stop_pct", None)
    break_even_trigger_pct = getattr(strategy, "break_even_trigger_pct", None)
    raw_rungs = getattr(strategy, "partial_take_profits", None) or []

    rungs: List[Dict[str, float]] = []
    for rung in raw_rungs:
        try:
            trigger = float(rung.trigger_pct)
            exit_ratio = float(rung.exit_ratio)
        except (TypeError, ValueError):
            continue
        if exit_ratio <= 0.0:
            continue
        rungs.append(
            {
                "trigger_pct": round(trigger, 4),
                "exit_ratio": round(exit_ratio, 4),
            }
        )
    # Sort ascending so the hint ladder visits rungs in the same order the
    # backtest runner fires them — makes panel rendering match simulation.
    rungs.sort(key=lambda row: row["trigger_pct"])

    hint: Dict[str, Any] = {
        "trailing_stop_pct": (
            round(float(trailing_stop_pct), 4)
            if trailing_stop_pct is not None
            else None
        ),
        "break_even_trigger_pct": (
            round(float(break_even_trigger_pct), 4)
            if break_even_trigger_pct is not None
            else None
        ),
        "partial_take_profits": rungs,
        "exit_tools_enabled": bool(
            trailing_stop_pct is not None
            or break_even_trigger_pct is not None
            or rungs
        ),
    }
    return hint


def _volatility_sizing_hint(strategy: StrategySummary) -> Dict[str, Any]:
    """Surface opt-in ATR-based volatility regime sizing onto the runtime
    risk-hint payload so downstream consumers can render the regime ladder
    and currently-applied multipliers without re-loading the strategy
    parameters.

    All fields are always present (even when the strategy has not opted in)
    to keep the panel schema stable; ``volatility_sizing_enabled`` carries
    the opt-in flag so panels can choose to hide the new section entirely
    when the strategy is running on legacy fixed sizing. Thresholds /
    multipliers fall back to ``None`` when not configured so the renderer
    can display an explicit "using defaults" note rather than silently
    echoing whatever the engine picked.
    """

    enabled = bool(getattr(strategy, "volatility_sizing_enabled", False))
    raw_lookback = getattr(strategy, "volatility_lookback", None)
    if raw_lookback is None:
        lookback: Optional[int] = None
    else:
        try:
            lookback = max(int(raw_lookback), 1)
        except (TypeError, ValueError):
            lookback = None

    raw_target = getattr(strategy, "volatility_target_pct", None)
    if raw_target is None:
        target_pct: Optional[float] = None
    else:
        try:
            target_pct = round(float(raw_target), 6)
        except (TypeError, ValueError):
            target_pct = None

    thresholds = getattr(strategy, "volatility_regime_thresholds", None)
    regime_thresholds: Optional[Dict[str, float]]
    if thresholds is None:
        regime_thresholds = None
    else:
        try:
            regime_thresholds = {
                "low_pct": round(float(thresholds.low_pct), 6),
                "high_pct": round(float(thresholds.high_pct), 6),
            }
        except (AttributeError, TypeError, ValueError):
            regime_thresholds = None

    multipliers = getattr(strategy, "regime_exposure_multipliers", None)
    regime_multipliers: Optional[Dict[str, float]]
    if multipliers is None:
        regime_multipliers = None
    else:
        try:
            regime_multipliers = {
                "low": round(float(multipliers.low), 6),
                "normal": round(float(multipliers.normal), 6),
                "high": round(float(multipliers.high), 6),
            }
        except (AttributeError, TypeError, ValueError):
            regime_multipliers = None

    return {
        "volatility_sizing_enabled": enabled,
        "volatility_lookback": lookback,
        "volatility_target_pct": target_pct,
        "regime_thresholds": regime_thresholds,
        "regime_multipliers": regime_multipliers,
    }


def _confidence_calibration_hint(strategy: StrategySummary) -> Dict[str, Any]:
    """Surface Round 46 opt-in confidence calibration configuration onto the
    runtime risk-hint payload so downstream consumers can render the regime-
    adjustment ladder, drift penalty and multi-timeframe toggle without
    re-loading the strategy parameters.

    Every key is always present so panel schemas stay stable across opt-in
    transitions. ``confidence_calibration_enabled`` carries the master flag —
    when it is ``False`` the override fields default to ``None`` / ``0.0`` /
    ``False`` so panels can short-circuit the new section entirely without
    ever seeing a missing key.
    """

    enabled = bool(getattr(strategy, "confidence_calibration_enabled", False))

    adjustments = getattr(strategy, "confidence_regime_adjustments", None)
    regime_adjustments: Optional[Dict[str, float]]
    if adjustments is None:
        regime_adjustments = None
    else:
        try:
            regime_adjustments = {
                "low": round(float(adjustments.low), 6),
                "normal": round(float(adjustments.normal), 6),
                "high": round(float(adjustments.high), 6),
            }
        except (AttributeError, TypeError, ValueError):
            regime_adjustments = None

    raw_penalty = getattr(strategy, "confidence_parameter_drift_penalty", 0.0)
    try:
        drift_penalty = round(float(raw_penalty or 0.0), 6)
    except (TypeError, ValueError):
        drift_penalty = 0.0

    return {
        "confidence_calibration_enabled": enabled,
        "confidence_regime_adjustments": regime_adjustments,
        "confidence_parameter_drift_penalty": drift_penalty,
        "confidence_multi_timeframe_alignment": bool(
            getattr(strategy, "confidence_multi_timeframe_alignment", False)
        ),
    }


def compute_strategy_runtime_risk_hints(
    strategy: StrategySummary,
    detail: Any,
    watch_item: WatchlistInstrument,
) -> Dict[str, Any]:
    """Return structured stop/target/band pricing for the live-ops risk hint panel.

    The output is a read-only snapshot; it never mutates the strategy or detail.
    When the history has fewer than 6 candles we return an "insufficient" record
    so callers can decide whether to surface a warning.
    """

    closes = [float(item.close) for item in detail.candles if getattr(item, "close", None) is not None]
    last_price = closes[-1] if closes else float(watch_item.last_price)
    family = _family_for_strategy(strategy)
    generated_at = _now_iso()

    base: Dict[str, Any] = {
        "strategy_id": strategy.id,
        "symbol": watch_item.symbol,
        "market": watch_item.market,
        "family": family,
        "last_price": round(last_price, 6),
        "generated_at": generated_at,
    }
    # The exit-tool hint is additive and safe to compute regardless of bias /
    # candle count, so we always attach it — callers that do not understand
    # the new keys can keep reading the legacy stop/target fields unchanged.
    base.update(_exit_tool_hint(strategy))
    # Round 45 volatility sizing hint: always attached so schema consumers
    # never see a missing key. ``volatility_sizing_enabled`` carries the
    # opt-in flag; legacy strategies produce ``False`` with all remaining
    # fields explicitly ``None`` so panels can short-circuit the new section.
    base.update(_volatility_sizing_hint(strategy))
    # Round 46 confidence calibration hint: always attached so consumers can
    # detect whether the runtime is applying the new regime / drift / multi-
    # timeframe post-process. ``confidence_calibration_enabled`` gates the
    # whole block for panels that want to hide it entirely when not opted in.
    base.update(_confidence_calibration_hint(strategy))

    if strategy.status == "paused":
        base.update(
            {
                "available": False,
                "reason": "策略已暂停，不生成风控提示价。",
                "bias": "flat",
            }
        )
        return base

    if len(closes) < 6:
        base.update(
            {
                "available": False,
                "reason": "历史 K 线不足 6 根，暂不生成止盈/止损参考价。",
                "bias": "watch",
            }
        )
        return base

    # Round 47 — three new kernels piggy-back on the existing risk-hint
    # generators. Momentum uses the trend-style MA bands, Bollinger squeeze
    # reuses the breakout stop/target framework, and RSI reversal is a
    # mean-reversion-shaped exit ladder. This keeps the emitted schema stable
    # for downstream panels.
    if family in {"trend", "momentum"}:
        hint = _trend_risk_hint(strategy, closes)
    elif family in {"mean_revert", "rsi_reversal"}:
        hint = _mean_revert_risk_hint(strategy, closes)
    else:
        hint = _breakout_risk_hint(strategy, closes)

    base.update(hint)
    base["available"] = True
    return base
