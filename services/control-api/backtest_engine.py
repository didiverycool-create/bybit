from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import mean, median, pstdev
from typing import Dict, List, Optional

from models import BacktestMetrics, CandlePoint, StrategySummary, derive_backtest_sample_quality

BACKTEST_ENGINE_MAX_CANDLES = 20_000


@dataclass
class BacktestVolatilityStats:
    """Additional equity-curve volatility descriptors.

    All percentage fields are expressed as plain numbers (e.g. ``1.23`` == 1.23%).
    They are purely derived from the simulated equity curve and never raise on
    degenerate inputs (empty / single-point curves → all zeros).
    """

    return_volatility_pct: float
    annualized_volatility_pct: float
    max_drawdown_duration_bars: int
    max_run_up_pct: float
    positive_bar_ratio_pct: float


@dataclass
class BacktestRiskRatios:
    """Risk-adjusted ratios derived from the simulated equity curve.

    Companion to ``BacktestVolatilityStats``. Fields default to ``0.0`` so a
    degenerate curve (empty / single-point / all-zero returns) never raises and
    downstream consumers always receive a fully populated object.

    - ``sortino_ratio``: Sharpe-style ratio using only downside deviation of
      period returns, annualized with ``sqrt(bars_per_year)``.
    - ``calmar_ratio``: annualized return divided by absolute max drawdown pct.
      Zero when ``max_drawdown_pct`` is zero (no drawdown on record).
    - ``profit_factor``: sum of positive period returns divided by the absolute
      sum of negative period returns; zero when either leg is empty.
    - ``expectancy_pct``: mean period return expressed as a percent.
    - ``worst_bar_return_pct`` / ``best_bar_return_pct``: minimum / maximum
      period return, expressed as a percent.
    """

    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    profit_factor: float = 0.0
    expectancy_pct: float = 0.0
    worst_bar_return_pct: float = 0.0
    best_bar_return_pct: float = 0.0


@dataclass
class BacktestTradeRhythmStats:
    """Bar-level rhythm descriptors derived from the simulated equity curve.

    Companion to ``BacktestVolatilityStats`` / ``BacktestRiskRatios`` — focuses
    on the *cadence* of winning and losing bars rather than their magnitudes.
    All fields default to zero so a degenerate curve (empty / flat / single
    point) produces a fully populated payload instead of raising.

    - ``total_bars``: number of period returns observed (``len(period_returns)``).
    - ``positive_bars`` / ``negative_bars`` / ``flat_bars``: counts of strictly
      positive, strictly negative, and exactly-zero period returns.
    - ``win_loss_bar_ratio``: ``positive_bars / negative_bars``; zero when no
      negative bars exist (avoids div-by-zero while signalling "no losses").
    - ``longest_winning_streak_bars`` / ``longest_losing_streak_bars``: longest
      run of consecutive strictly-positive / strictly-negative period returns.
      Zero entries break both streaks.
    - ``avg_positive_bar_return_pct`` / ``avg_negative_bar_return_pct``: mean of
      the positive / negative tails, already multiplied by 100 (so they read as
      percentages). Negative tail mean is a negative number.
    - ``median_bar_return_pct``: median of all period returns × 100.
    """

    total_bars: int = 0
    positive_bars: int = 0
    negative_bars: int = 0
    flat_bars: int = 0
    win_loss_bar_ratio: float = 0.0
    longest_winning_streak_bars: int = 0
    longest_losing_streak_bars: int = 0
    avg_positive_bar_return_pct: float = 0.0
    avg_negative_bar_return_pct: float = 0.0
    median_bar_return_pct: float = 0.0


@dataclass
class BacktestBenchmarkStats:
    """Compare the simulated strategy equity curve against a passive buy-and-hold
    of the reference price path (close-of-candles sequence).

    All percentage fields are plain numbers (``1.23`` == 1.23%). Fields default
    to ``0.0`` so degenerate inputs (empty curve / flat price path / mismatched
    lengths) yield a fully populated payload instead of raising — downstream
    consumers can treat missing data as "unavailable" rather than "error".

    - ``buy_hold_return_pct``: ``(final / initial - 1) × 100`` for the price
      path; represents the passive holder's total return over the window.
    - ``buy_hold_max_drawdown_pct``: the deepest drawdown of the price path
      itself (already a negative percent, matching ``_compute_max_drawdown``).
    - ``strategy_over_buy_hold_pct``: ``(strategy_total_return − buy_hold_return)
      × 100`` in percent units; positive == strategy outperforms passive hold.
    - ``alpha_pct``: ``strategy_over_buy_hold_pct`` annualized by
      ``bars_per_year / max(len(equity_curve) − 1, 1)``.
    - ``correlation``: Pearson correlation between strategy and price-path
      period returns; zero when either series has zero variance.
    - ``tracking_error_pct``: population stdev of the per-bar return
      differences, already expressed in percent units.
    """

    buy_hold_return_pct: float = 0.0
    buy_hold_max_drawdown_pct: float = 0.0
    strategy_over_buy_hold_pct: float = 0.0
    alpha_pct: float = 0.0
    correlation: float = 0.0
    tracking_error_pct: float = 0.0


@dataclass
class BacktestExposureStats:
    """High-order and robustness descriptors of the simulated equity curve.

    Complements ``BacktestVolatilityStats`` / ``BacktestRiskRatios`` with tail
    and drawdown-shape statistics that help reviewers gauge distributional
    asymmetry and recovery behaviour. Every field defaults to ``0.0`` so
    degenerate inputs (empty curve, flat returns, zero drawdown) still yield a
    fully populated payload instead of raising — downstream consumers should
    treat zero-fill as "unavailable" rather than "error".

    - ``return_skew``: Fisher-Pearson adjusted sample skewness of
      ``period_returns``. Returns ``0.0`` when the sample has fewer than 3
      observations or the sample stdev collapses to zero.
    - ``return_kurtosis``: sample excess kurtosis of ``period_returns`` (raw
      kurtosis minus 3, so a normal distribution maps to ``0.0``). Returns
      ``0.0`` when the sample has fewer than 4 observations or the sample
      stdev collapses to zero.
    - ``ulcer_index_pct``: root-mean-square of the per-bar drawdown percentages
      measured against the running peak of the equity curve. Expressed as a
      positive percentage (``1.23`` == 1.23%); ``0.0`` when the curve is empty.
    - ``recovery_factor``: ``total_return_pct / abs(max_drawdown_pct)``. Returns
      ``0.0`` when ``max_drawdown_pct`` is ``None`` or exactly zero (no
      drawdown on record — ratio would otherwise diverge).
    - ``downside_deviation_pct``: population stdev of the strictly-negative
      tail of ``period_returns``, already multiplied by 100 so it reads as a
      percentage. Returns ``0.0`` when no negative returns exist.
    """

    return_skew: float = 0.0
    return_kurtosis: float = 0.0
    ulcer_index_pct: float = 0.0
    recovery_factor: float = 0.0
    downside_deviation_pct: float = 0.0


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
    volatility_stats: Optional[BacktestVolatilityStats] = None
    risk_ratios: Optional[BacktestRiskRatios] = None
    trade_rhythm_stats: Optional[BacktestTradeRhythmStats] = None
    benchmark_stats: Optional[BacktestBenchmarkStats] = None
    exposure_stats: Optional[BacktestExposureStats] = None


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


def _max_drawdown_duration_bars(equity_curve: List[float]) -> int:
    """Longest streak of consecutive bars where equity stays strictly below the
    running peak. Safe on empty / single-point / flat curves (returns 0).
    """
    if len(equity_curve) < 2:
        return 0
    peak = equity_curve[0]
    longest = 0
    current = 0
    for value in equity_curve:
        if value >= peak:
            peak = value
            current = 0
            continue
        current += 1
        if current > longest:
            longest = current
    return longest


def _max_run_up_pct(equity_curve: List[float]) -> float:
    """Largest unrealized gain vs the first valid equity point, as a percentage.

    Returns 0.0 when the curve is empty, the first point is non-positive, or the
    equity never exceeds the starting level.
    """
    if not equity_curve:
        return 0.0
    anchor = equity_curve[0]
    if anchor <= 0:
        return 0.0
    best = anchor
    for value in equity_curve:
        if value > best:
            best = value
    if best <= anchor:
        return 0.0
    return (best / anchor - 1.0) * 100.0


def _compute_volatility_stats(
    equity_curve: List[float],
    bars_per_year: float,
) -> BacktestVolatilityStats:
    """Derive volatility descriptors from the simulated equity curve.

    Degenerate inputs (empty / single-point / non-positive start) yield zeroed
    stats rather than raising — callers may inspect the curve separately to
    decide whether the figures are meaningful.
    """
    period_returns = _compute_period_returns(equity_curve)
    if len(period_returns) >= 2:
        volatility = pstdev(period_returns)
    else:
        volatility = 0.0
    if bars_per_year > 0 and volatility > 0:
        annualized = volatility * math.sqrt(bars_per_year)
    else:
        annualized = 0.0
    if period_returns:
        positive = sum(1 for value in period_returns if value > 0)
        positive_ratio = positive / len(period_returns) * 100.0
    else:
        positive_ratio = 0.0
    return BacktestVolatilityStats(
        return_volatility_pct=round(volatility, 4),
        annualized_volatility_pct=round(annualized, 4),
        max_drawdown_duration_bars=_max_drawdown_duration_bars(equity_curve),
        max_run_up_pct=round(_max_run_up_pct(equity_curve), 4),
        positive_bar_ratio_pct=round(positive_ratio, 2),
    )


def _compute_risk_ratios(
    equity_curve: List[float],
    period_returns: List[float],
    annualized_return_pct: float,
    bars_per_year: float,
) -> BacktestRiskRatios:
    """Derive risk-adjusted ratios from the simulated equity curve.

    All inputs are reused from the volatility pipeline to avoid duplicating
    ``_compute_period_returns`` / ``_compute_max_drawdown`` work. Degenerate
    inputs (empty curve / empty period returns / non-positive denominators)
    yield an all-zero ``BacktestRiskRatios`` instead of raising so downstream
    consumers can treat missing data as "unavailable" rather than "error".
    """

    if not period_returns:
        return BacktestRiskRatios()

    positives = [value for value in period_returns if value > 0]
    negatives = [value for value in period_returns if value < 0]

    # Sortino uses only the downside deviation of period returns. Population
    # stdev matches ``_compute_sharpe``'s choice so the two ratios are
    # directly comparable.
    if len(negatives) >= 2 and bars_per_year > 0:
        downside_std = pstdev(negatives)
        avg = mean(period_returns)
        if downside_std > 0:
            sortino = avg / downside_std * math.sqrt(bars_per_year)
        else:
            sortino = 0.0
    else:
        sortino = 0.0

    max_drawdown_pct = _compute_max_drawdown(equity_curve)
    if max_drawdown_pct < 0:
        calmar = annualized_return_pct / abs(max_drawdown_pct)
    else:
        calmar = 0.0

    sum_positive = sum(positives)
    sum_negative_abs = abs(sum(negatives))
    if sum_negative_abs > 0 and sum_positive > 0:
        profit_factor = sum_positive / sum_negative_abs
    else:
        profit_factor = 0.0

    expectancy_pct = mean(period_returns)
    worst_bar = min(period_returns)
    best_bar = max(period_returns)

    return BacktestRiskRatios(
        sortino_ratio=round(sortino, 4),
        calmar_ratio=round(calmar, 4),
        profit_factor=round(profit_factor, 4),
        expectancy_pct=round(expectancy_pct, 4),
        worst_bar_return_pct=round(worst_bar, 4),
        best_bar_return_pct=round(best_bar, 4),
    )


def _compute_trade_rhythm_stats(period_returns: List[float]) -> BacktestTradeRhythmStats:
    """Derive bar-level rhythm statistics from already-computed period returns.

    Period returns are reused from the volatility / risk-ratio pipeline so this
    helper does no redundant equity-curve walking. Degenerate inputs (empty
    series) yield an all-zero ``BacktestTradeRhythmStats`` rather than raising,
    so downstream consumers can treat the payload as "unavailable" without
    branching on ``None``.
    """

    if not period_returns:
        return BacktestTradeRhythmStats()

    positives = [value for value in period_returns if value > 0]
    negatives = [value for value in period_returns if value < 0]
    flats = [value for value in period_returns if value == 0]

    # Streak walk: a strictly positive bar extends the winning run and breaks
    # the losing run; a strictly negative bar does the reverse; a zero bar
    # breaks both runs. Tracking both counters in a single pass keeps the
    # helper O(n) in the period-return length.
    longest_win = 0
    longest_loss = 0
    current_win = 0
    current_loss = 0
    for value in period_returns:
        if value > 0:
            current_win += 1
            current_loss = 0
            if current_win > longest_win:
                longest_win = current_win
        elif value < 0:
            current_loss += 1
            current_win = 0
            if current_loss > longest_loss:
                longest_loss = current_loss
        else:
            current_win = 0
            current_loss = 0

    if negatives:
        win_loss_bar_ratio = len(positives) / len(negatives)
    else:
        win_loss_bar_ratio = 0.0

    avg_positive = mean(positives) if positives else 0.0
    avg_negative = mean(negatives) if negatives else 0.0
    median_return = median(period_returns)

    return BacktestTradeRhythmStats(
        total_bars=len(period_returns),
        positive_bars=len(positives),
        negative_bars=len(negatives),
        flat_bars=len(flats),
        win_loss_bar_ratio=round(win_loss_bar_ratio, 4),
        longest_winning_streak_bars=longest_win,
        longest_losing_streak_bars=longest_loss,
        avg_positive_bar_return_pct=round(avg_positive, 4),
        avg_negative_bar_return_pct=round(avg_negative, 4),
        median_bar_return_pct=round(median_return, 4),
    )


def _compute_benchmark_stats(
    equity_curve: List[float],
    reference_path: List[float],
    bars_per_year: float,
) -> BacktestBenchmarkStats:
    """Compare the simulated equity curve against a passive buy-and-hold of the
    reference price path.

    Degenerate inputs (empty / single-point series) yield an all-zero
    ``BacktestBenchmarkStats`` rather than raising, so downstream consumers can
    treat missing data as "unavailable" without branching on ``None``. When the
    two series have different lengths we truncate to the shorter tail so the
    per-bar return diffs always line up index-for-index.
    """

    if len(equity_curve) < 2 or len(reference_path) < 2:
        return BacktestBenchmarkStats()

    # Align lengths by truncating from the right — strategy runners always
    # extend the equity curve in lock-step with the candle index, so trimming
    # the longer tail keeps both series anchored at the same starting point.
    trimmed_length = min(len(equity_curve), len(reference_path))
    aligned_equity = equity_curve[:trimmed_length]
    aligned_path = reference_path[:trimmed_length]

    strategy_returns = _compute_period_returns(aligned_equity)
    price_returns = _compute_period_returns(aligned_path)
    # ``_compute_period_returns`` skips bars whose previous equity is
    # non-positive; realign by truncating to the shorter return series so the
    # per-bar diffs below never run off the end.
    paired_length = min(len(strategy_returns), len(price_returns))
    strategy_returns = strategy_returns[:paired_length]
    price_returns = price_returns[:paired_length]

    if aligned_path[0] > 0:
        buy_hold_return_pct = (aligned_path[-1] / aligned_path[0] - 1.0) * 100.0
    else:
        buy_hold_return_pct = 0.0
    buy_hold_max_drawdown_pct = _compute_max_drawdown(aligned_path)

    if aligned_equity[0] > 0:
        strategy_total_return_pct = (aligned_equity[-1] / aligned_equity[0] - 1.0) * 100.0
    else:
        strategy_total_return_pct = 0.0
    strategy_over_buy_hold_pct = strategy_total_return_pct - buy_hold_return_pct

    span_bars = max(len(aligned_equity) - 1, 1)
    if bars_per_year > 0:
        alpha_pct = strategy_over_buy_hold_pct * bars_per_year / span_bars
    else:
        alpha_pct = 0.0

    # Pearson correlation with a zero-variance guard: if either leg is flat
    # (``pstdev == 0``) the correlation is undefined, so we emit 0.0 rather
    # than propagating a division by zero. Mirrors the defensive posture of
    # ``_compute_sharpe`` / ``_compute_risk_ratios``.
    correlation = 0.0
    if len(strategy_returns) >= 2 and len(price_returns) >= 2:
        strategy_std = pstdev(strategy_returns)
        price_std = pstdev(price_returns)
        if strategy_std > 0 and price_std > 0:
            strategy_mean = mean(strategy_returns)
            price_mean = mean(price_returns)
            covariance = sum(
                (s - strategy_mean) * (p - price_mean)
                for s, p in zip(strategy_returns, price_returns)
            ) / len(strategy_returns)
            correlation = covariance / (strategy_std * price_std)

    # Tracking error: population stdev of the per-bar return differences.
    # ``_compute_period_returns`` already emits values in percent units, so
    # the diffs are percent-in-percent-out — no additional scaling required.
    if len(strategy_returns) >= 2:
        return_diffs = [s - p for s, p in zip(strategy_returns, price_returns)]
        tracking_error_pct = pstdev(return_diffs)
    else:
        tracking_error_pct = 0.0

    return BacktestBenchmarkStats(
        buy_hold_return_pct=round(buy_hold_return_pct, 4),
        buy_hold_max_drawdown_pct=round(buy_hold_max_drawdown_pct, 4),
        strategy_over_buy_hold_pct=round(strategy_over_buy_hold_pct, 4),
        alpha_pct=round(alpha_pct, 4),
        correlation=round(correlation, 4),
        tracking_error_pct=round(tracking_error_pct, 4),
    )


def _compute_exposure_stats(
    equity_curve: List[float],
    period_returns: List[float],
    total_return_pct: float,
    max_drawdown_pct: float,
) -> BacktestExposureStats:
    """Derive higher-moment and drawdown-shape descriptors.

    Every branch short-circuits to the relevant default when its inputs are
    degenerate (empty series, flat returns, missing drawdown). The helper
    therefore never raises — an all-zero payload signals "not enough data" to
    downstream consumers without forcing them to guard against ``None``.

    Skew uses the Fisher-Pearson adjusted formula
    ``n * Σ(x_i - μ)^3 / ((n-1)(n-2) σ^3)``; excess kurtosis uses the unbiased
    correction ``n(n+1)/((n-1)(n-2)(n-3)) · Σ((x-μ)/σ)^4 − 3(n-1)^2/((n-2)(n-3))``
    so a normal distribution maps to ``0.0``. Both require a non-zero sample
    stdev to avoid division by zero.
    """

    skew = 0.0
    kurtosis = 0.0
    if period_returns is not None and len(period_returns) >= 3:
        n = len(period_returns)
        mean_value = mean(period_returns)
        # Sample stdev (ddof=1) lines up with the Fisher-Pearson adjustment.
        variance = sum((value - mean_value) ** 2 for value in period_returns) / (n - 1)
        if variance > 0:
            std = math.sqrt(variance)
            third_moment = sum((value - mean_value) ** 3 for value in period_returns)
            skew = (n / ((n - 1) * (n - 2))) * (third_moment / (std ** 3))
            if n >= 4:
                fourth_sum = sum(((value - mean_value) / std) ** 4 for value in period_returns)
                leading = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))
                trailing = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
                kurtosis = leading * fourth_sum - trailing

    ulcer_index_pct = 0.0
    if equity_curve:
        squared_drawdowns: List[float] = []
        running_peak = equity_curve[0]
        for value in equity_curve:
            if value > running_peak:
                running_peak = value
            if running_peak <= 0:
                # Non-positive peak means no meaningful drawdown reference —
                # skip rather than emit noise.
                continue
            drawdown_pct = max(0.0, (running_peak - value) / running_peak * 100.0)
            squared_drawdowns.append(drawdown_pct ** 2)
        if squared_drawdowns:
            ulcer_index_pct = math.sqrt(sum(squared_drawdowns) / len(squared_drawdowns))

    if max_drawdown_pct is None or max_drawdown_pct == 0:
        recovery_factor = 0.0
    else:
        recovery_factor = total_return_pct / abs(max_drawdown_pct)

    downside_deviation_pct = 0.0
    if period_returns:
        negatives = [value for value in period_returns if value < 0]
        if negatives:
            downside_deviation_pct = pstdev(negatives) * 100.0 if len(negatives) >= 1 else 0.0

    return BacktestExposureStats(
        return_skew=round(skew, 6),
        return_kurtosis=round(kurtosis, 6),
        ulcer_index_pct=round(ulcer_index_pct, 4),
        recovery_factor=round(recovery_factor, 4),
        downside_deviation_pct=round(downside_deviation_pct, 4),
    )


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
) -> tuple[BacktestMetrics, bool, List[float]]:
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
    return metrics, used_reference_path, equity_curve


def _run_mean_reversion(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
) -> tuple[BacktestMetrics, bool, List[float]]:
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
    return metrics, used_reference_path, equity_curve


def _run_breakout(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
) -> tuple[BacktestMetrics, bool, List[float]]:
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
    return metrics, used_reference_path, equity_curve


def run_local_backtest(strategy: StrategySummary, candles: List[CandlePoint], timeframe: str, data_range: str) -> BacktestComputation:
    params = _parameter_map(strategy)
    retrieved_candle_count = len(candles)
    history_truncated = retrieved_candle_count > BACKTEST_ENGINE_MAX_CANDLES
    effective_candles = candles[-BACKTEST_ENGINE_MAX_CANDLES:] if history_truncated else candles
    used_candle_count = len(effective_candles)
    retrieved_range_start, retrieved_range_end = _candle_time_bounds(candles)
    used_range_start, used_range_end = _candle_time_bounds(effective_candles)
    if strategy.id.startswith("trend-"):
        metrics, used_reference_path, final_equity_curve = _run_trend_follow(effective_candles, params, timeframe)
    elif strategy.id.startswith("eth-revert") or "均值回归" in strategy.name:
        metrics, used_reference_path, final_equity_curve = _run_mean_reversion(effective_candles, params, timeframe)
    else:
        metrics, used_reference_path, final_equity_curve = _run_breakout(effective_candles, params, timeframe)
    bars_per_year = 365 * 24 / _timeframe_hours(timeframe)
    volatility_stats = _compute_volatility_stats(
        final_equity_curve,
        bars_per_year,
    )
    # Derive the realized total return directly from the equity curve (the
    # pydantic ``BacktestMetrics`` only carries formatted strings). Short spans
    # produce unstable annualizations, but ``_compute_risk_ratios`` falls back
    # to zero when denominators collapse.
    if final_equity_curve and final_equity_curve[0] > 0:
        total_return_pct = (final_equity_curve[-1] / final_equity_curve[0] - 1.0) * 100.0
    else:
        total_return_pct = 0.0
    span_bars = max(len(final_equity_curve) - 1, 1)
    annualized_return_pct = total_return_pct * (bars_per_year / span_bars)
    period_returns = _compute_period_returns(final_equity_curve)
    risk_ratios = _compute_risk_ratios(
        final_equity_curve,
        period_returns,
        annualized_return_pct,
        bars_per_year,
    )
    trade_rhythm_stats = _compute_trade_rhythm_stats(period_returns)
    # Benchmark stats compare the realized strategy equity curve against a
    # passive buy-and-hold of the reference price path. The strategy runners
    # do not export the path explicitly, so we reconstruct it here from the
    # effective-candle closes — these are the exact prices the runners
    # consumed when building ``final_equity_curve``.
    reference_price_path = [candle.close for candle in effective_candles]
    benchmark_stats = _compute_benchmark_stats(
        final_equity_curve,
        reference_price_path,
        bars_per_year,
    )
    # Exposure stats reuse the already-realized equity curve, its period
    # returns, and the drawdown produced by ``_compute_max_drawdown`` so the
    # higher-order descriptors line up with the other stat payloads.
    max_drawdown_pct = _compute_max_drawdown(final_equity_curve)
    exposure_stats = _compute_exposure_stats(
        final_equity_curve,
        period_returns,
        total_return_pct,
        max_drawdown_pct,
    )

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
        volatility_stats=volatility_stats,
        risk_ratios=risk_ratios,
        trade_rhythm_stats=trade_rhythm_stats,
        benchmark_stats=benchmark_stats,
        exposure_stats=exposure_stats,
    )
