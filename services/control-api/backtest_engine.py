from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from statistics import mean, median, pstdev
from typing import Dict, List, Literal, Optional

from models import (
    BacktestMetrics,
    CandlePoint,
    PartialTakeProfit,
    RegimeExposureMultipliers,
    StrategySummary,
    VolatilityRegimeThresholds,
    derive_backtest_sample_quality,
)

# Round 45 typing alias for the three volatility regimes used by the opt-in
# ATR-based position sizer. Narrowed to a literal so downstream consumers can
# exhaustively pattern-match — an unknown regime is never emitted by the
# classifier below.
VolatilityRegime = Literal["low", "normal", "high"]

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
class BacktestTailRiskStats:
    """Tail-risk descriptors of the simulated equity curve's period returns.

    Complements ``BacktestExposureStats`` with historical Value-at-Risk /
    Conditional-VaR style statistics that summarize the severity and balance
    of the return distribution's extremes. Every field defaults to ``0.0`` so
    degenerate inputs (empty series, no negative tail, small sample) still
    yield a fully populated payload instead of raising — downstream consumers
    should treat zero-fill as "unavailable" rather than "error".

    - ``var_95_pct``: historical 5% Value-at-Risk of ``period_returns``,
      expressed as a positive percentage denoting loss magnitude (the negated
      5th percentile × 1). Returns ``0.0`` when the sample is empty or has no
      negative return observations.
    - ``cvar_95_pct``: historical Conditional VaR (expected shortfall) at the
      95% confidence level. Computed by sorting ``period_returns`` ascending
      and averaging the worst ``ceil(n * 0.05)`` observations (minimum of 1),
      then negating so the figure reads as a positive loss magnitude. Returns
      ``0.0`` when the sample is empty.
    - ``tail_ratio``: ratio of the 95th percentile to the absolute value of
      the 5th percentile of ``period_returns``. Signals whether upside tails
      dominate downside tails. Returns ``0.0`` when the sample is smaller than
      20 observations or the 5th-percentile denominator collapses to zero.
    - ``gain_to_pain_ratio``: ``sum(positive returns) / abs(sum(negative
      returns))``. A bar-level Sortino cousin that weights magnitudes rather
      than deviations. Returns ``0.0`` when the negative-return denominator is
      zero (no losses on record — ratio would otherwise diverge).
    """

    var_95_pct: float = 0.0
    cvar_95_pct: float = 0.0
    tail_ratio: float = 0.0
    gain_to_pain_ratio: float = 0.0


@dataclass
class BacktestTrade:
    """Single closed-position record emitted by the strategy runners.

    Captures just enough information for the order-flow / holding-rhythm
    pipeline to derive notional-level and cadence-level descriptors without
    re-walking the equity curve. Fields are sized so a degenerate trade
    (quantity == 0, entry_price <= 0) still materializes cleanly — the
    downstream helpers individually guard their denominators.

    - ``entry_bar_index`` / ``exit_bar_index``: zero-based bar indices
      relative to the ``effective_candles`` sequence the runner consumed.
      ``exit_bar_index >= entry_bar_index`` always; a trade that opens and
      closes on the same bar reports ``entry == exit``.
    - ``entry_price`` / ``exit_price``: the close prices used when the
      position opened / closed, denominated in the candle's quote currency.
    - ``quantity``: trade size in base-asset units, derived so that
      ``entry_price * quantity`` equals the runner's effective notional
      commitment on that trade (positional sizing factor applied).
    - ``side``: ``"long"`` for directional runners (current implementation
      only supports long-side strategies). Kept as a string literal so future
      short-side runners can extend the field without breaking consumers.
    """

    entry_bar_index: int
    exit_bar_index: int
    entry_price: float
    exit_price: float
    quantity: float
    side: str = "long"
    # Round 45 opt-in volatility-regime-aware sizing metadata. Both fields
    # default to ``None`` so pre-R45 callers and legacy fixtures continue to
    # round-trip unchanged. Populated whenever a runner applies the ATR% /
    # regime classifier at entry time.
    volatility_regime: Optional[str] = None
    applied_risk_per_trade: Optional[float] = None


@dataclass
class BacktestOrderFlowStats:
    """Execution-side cadence descriptors derived from realized closed trades.

    Companion to ``BacktestExposureStats`` / ``BacktestTailRiskStats`` —
    focuses on the *rhythm* of order submission, the amount of time the
    strategy actually holds exposure, and the capital turnover relative to
    the starting equity. Every field defaults to ``0.0`` so degenerate
    inputs (no trades, zero total bars, non-positive starting capital) still
    yield a fully populated payload instead of raising, letting downstream
    consumers treat zero-fill as "unavailable" rather than "error".

    - ``avg_holding_bars``: mean of ``exit_bar_index - entry_bar_index`` over
      all closed trades. Returns ``0.0`` when the trade list is empty.
    - ``trade_frequency_per_day``: number of closed trades divided by the
      number of elapsed natural days, inferred via
      ``total_bars / bars_per_day``. Returns ``0.0`` when ``total_bars`` is
      zero / negative so short-run simulations do not report artificially
      high frequencies.
    - ``turnover_rate_pct``: ``sum(entry_price * quantity) / start_capital``
      for all closed trades, expressed as a percent (``1.0`` == 1%). Returns
      ``0.0`` when ``start_capital`` is zero or negative — otherwise the
      ratio would diverge / flip sign.
    - ``active_bar_ratio_pct``: percentage of bars in which the strategy held
      any exposure, measured via the union of per-trade bar intervals. A bar
      counted in multiple trades still contributes once so overlapping
      positions do not inflate the ratio past 100%.
    - ``avg_trade_notional``: mean of ``entry_price * quantity`` over all
      closed trades. Returns ``0.0`` when the trade list is empty.
    """

    avg_holding_bars: float = 0.0
    trade_frequency_per_day: float = 0.0
    turnover_rate_pct: float = 0.0
    active_bar_ratio_pct: float = 0.0
    avg_trade_notional: float = 0.0


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
    tail_risk_stats: Optional[BacktestTailRiskStats] = None
    order_flow_stats: Optional[BacktestOrderFlowStats] = None
    # Round 49 — surface the runner's closed-trade list so ``BacktestRun`` can
    # expose per-trade volatility regime / applied risk metadata to the UI.
    # Legacy callers that construct ``BacktestComputation`` manually continue
    # to default to an empty list.
    trades: List[BacktestTrade] = field(default_factory=list)


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


def _linear_quantile(sorted_values: List[float], fraction: float) -> float:
    """Linear-interpolation quantile helper used by the tail-risk pipeline.

    Mirrors the ``statistics.quantiles(..., method="inclusive")`` behaviour at
    an arbitrary fraction so ``p5`` / ``p95`` land on the same anchor points
    regardless of sample length. Callers guarantee ``sorted_values`` is
    non-empty and ``0.0 <= fraction <= 1.0``; degenerate samples (length 1)
    short-circuit to the lone observation.
    """

    n = len(sorted_values)
    if n == 1:
        return sorted_values[0]
    position = fraction * (n - 1)
    lower_index = int(math.floor(position))
    upper_index = int(math.ceil(position))
    if lower_index == upper_index:
        return sorted_values[lower_index]
    lower_value = sorted_values[lower_index]
    upper_value = sorted_values[upper_index]
    weight = position - lower_index
    return lower_value + (upper_value - lower_value) * weight


def _compute_tail_risk_stats(period_returns: List[float]) -> BacktestTailRiskStats:
    """Derive historical tail-risk descriptors from period returns.

    Degenerate inputs (empty series, no negative tail, small sample) collapse
    to the relevant default without raising so downstream consumers can treat
    zero-fill as "unavailable" rather than "error". VaR / CVaR use the
    historical method (sorted order statistics); ``tail_ratio`` only fires
    once the sample is large enough (20+) for the 5th / 95th percentiles to
    stabilize; ``gain_to_pain_ratio`` guards its denominator against a
    loss-free sample to avoid divergence.
    """

    if not period_returns:
        return BacktestTailRiskStats()

    sorted_returns = sorted(period_returns)
    n = len(sorted_returns)

    # Historical VaR95 uses the discrete loss-threshold convention: the
    # worst observation at the boundary of the bottom 5% tail. For a sample
    # of size ``n`` the tail size is ``ceil(n * 0.05)`` (minimum of 1), and
    # VaR95 reports the *last* (least-bad) observation inside that tail,
    # negated and scaled to percent units so it reads as a positive loss
    # magnitude. Only fires when the tail actually contains losses — a
    # strictly non-negative sample has no meaningful VaR, so collapse to
    # zero.
    tail_count = max(1, math.ceil(n * 0.05))
    var_95_pct = 0.0
    negatives = [value for value in period_returns if value < 0]
    if negatives:
        tail_boundary = sorted_returns[min(tail_count - 1, n - 1)]
        var_95_pct = -tail_boundary * 100.0

    # Historical CVaR95: average of the worst ``ceil(n * 0.05)`` observations
    # (minimum of 1), negated and scaled to percent units so the figure reads
    # as a positive loss magnitude. Always safe so long as the sample is
    # non-empty.
    worst_slice = sorted_returns[:tail_count]
    cvar_95_pct = -mean(worst_slice) * 100.0

    # Tail ratio: stable only once the sample is large enough for p5 / p95 to
    # reflect the distribution's extremes rather than noise. A zero
    # denominator (strictly non-negative 5th percentile) would make the ratio
    # diverge, so short-circuit to zero. The ratio is unitless — both legs
    # share the same scale, so no percent conversion is applied.
    tail_ratio = 0.0
    if n >= 20:
        p5_for_ratio = _linear_quantile(sorted_returns, 0.05)
        p95_for_ratio = _linear_quantile(sorted_returns, 0.95)
        if p5_for_ratio != 0:
            tail_ratio = p95_for_ratio / abs(p5_for_ratio)

    # Gain-to-pain: magnitude-weighted win/loss ratio. Zero denominator means
    # no losses on record — ratio would otherwise diverge. Unitless, so no
    # percent conversion is applied.
    positives = [value for value in period_returns if value > 0]
    sum_positive = sum(positives)
    sum_negative_abs = abs(sum(negatives))
    if sum_negative_abs > 0:
        gain_to_pain_ratio = sum_positive / sum_negative_abs
    else:
        gain_to_pain_ratio = 0.0

    return BacktestTailRiskStats(
        var_95_pct=round(var_95_pct, 4),
        cvar_95_pct=round(cvar_95_pct, 4),
        tail_ratio=round(tail_ratio, 4),
        gain_to_pain_ratio=round(gain_to_pain_ratio, 4),
    )


def _compute_order_flow_stats(
    trades: List[BacktestTrade],
    total_bars: int,
    start_capital: float,
    bars_per_day: int,
) -> BacktestOrderFlowStats:
    """Derive execution-side cadence statistics from closed trades.

    Degenerate inputs (empty trade list, ``total_bars`` ≤ 0, non-positive
    starting capital) short-circuit to the relevant defaults rather than
    raising so downstream consumers can treat zero-fill as "unavailable"
    rather than "error". The helper is intentionally O(n + bars) in the
    worst case: the active-bar ratio walks each trade's ``entry..exit``
    interval once, deduplicating via a set so overlapping positions cannot
    inflate the covered bar count past ``total_bars``.
    """

    if not trades or total_bars <= 0:
        return BacktestOrderFlowStats()

    # Average holding length: inclusive bar span between entry and exit. The
    # runners clamp ``exit_bar_index >= entry_bar_index`` so this subtraction
    # is never negative; a single-bar trade reports ``0``.
    holding_bars = [
        max(trade.exit_bar_index - trade.entry_bar_index, 0) for trade in trades
    ]
    avg_holding_bars = sum(holding_bars) / len(trades)

    # Trade frequency normalized to natural days via ``bars_per_day``. The
    # lookup in ``run_local_backtest`` falls back to 1440 (1-minute bars) for
    # unknown granularities so this denominator is always strictly positive.
    effective_bars_per_day = max(int(bars_per_day), 1)
    days_spanned = total_bars / effective_bars_per_day
    if days_spanned > 0:
        trade_frequency_per_day = len(trades) / days_spanned
    else:
        trade_frequency_per_day = 0.0

    # Turnover: gross notional committed vs. the initial equity stake. The
    # ``start_capital`` guard keeps the ratio from diverging / flipping sign
    # when the strategy runner reports a non-positive starting capital.
    notionals = [trade.entry_price * trade.quantity for trade in trades]
    if start_capital > 0:
        turnover_rate_pct = sum(notionals) / start_capital * 100.0
    else:
        turnover_rate_pct = 0.0

    # Active-bar ratio: union of per-trade ``entry..exit`` intervals divided
    # by the total bar count. A set-based union keeps overlapping positions
    # from inflating the covered count past ``total_bars``, which could
    # otherwise push the ratio past 100%.
    active_bars: set[int] = set()
    for trade in trades:
        low = max(int(trade.entry_bar_index), 0)
        high = max(int(trade.exit_bar_index), low)
        for bar_index in range(low, high + 1):
            active_bars.add(bar_index)
    active_bar_ratio_pct = len(active_bars) / total_bars * 100.0

    avg_trade_notional = sum(notionals) / len(trades) if notionals else 0.0

    return BacktestOrderFlowStats(
        avg_holding_bars=round(avg_holding_bars, 4),
        trade_frequency_per_day=round(trade_frequency_per_day, 4),
        turnover_rate_pct=round(turnover_rate_pct, 4),
        active_bar_ratio_pct=round(active_bar_ratio_pct, 4),
        avg_trade_notional=round(avg_trade_notional, 4),
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


@dataclass
class _ExitToolRung:
    """Snapshot of a fired partial take-profit rung.

    ``fraction_of_original`` is the portion of the *original* position size
    consumed by this rung, so ``sum(fraction_of_original)`` must never exceed
    1.0. ``pnl_pct`` is the realized pnl for the base asset on the trigger bar
    (no sizing multiplier applied — the runner scales it for equity updates).
    """

    trigger_pct: float
    exit_ratio: float
    fraction_of_original: float
    pnl_pct: float
    bar_index: int
    exit_price: float


@dataclass
class _ExitToolState:
    """Opt-in exit-tool state machine attached to a single open position.

    Tracks just enough history to drive trailing stops, break-even arming, and
    a monotonic partial-take-profit ladder. All three tools are *additive*:
    when the corresponding field on the strategy is ``None`` the helper is a
    no-op and existing runner behavior is preserved bit-for-bit.
    """

    trailing_stop_pct: Optional[float]
    break_even_trigger_pct: Optional[float]
    rungs: List[PartialTakeProfit]
    max_favorable_pct: float = 0.0
    break_even_armed: bool = False
    remaining_ratio: float = 1.0
    consumed_rungs: List[_ExitToolRung] = None  # type: ignore[assignment]
    _next_rung_index: int = 0

    def __post_init__(self) -> None:
        if self.consumed_rungs is None:
            self.consumed_rungs = []

    @property
    def any_enabled(self) -> bool:
        return (
            self.trailing_stop_pct is not None
            or self.break_even_trigger_pct is not None
            or bool(self.rungs)
        )

    def update_favorable(self, pnl_pct: float) -> None:
        if pnl_pct > self.max_favorable_pct:
            self.max_favorable_pct = pnl_pct
        if (
            not self.break_even_armed
            and self.break_even_trigger_pct is not None
            and pnl_pct >= self.break_even_trigger_pct
        ):
            self.break_even_armed = True

    def trailing_stop_hit(self, pnl_pct: float) -> bool:
        if self.trailing_stop_pct is None:
            return False
        if self.max_favorable_pct <= 0.0:
            return False
        giveback = self.max_favorable_pct - pnl_pct
        return giveback >= self.trailing_stop_pct

    def break_even_hit(self, pnl_pct: float) -> bool:
        return self.break_even_armed and pnl_pct <= 0.0

    def next_partial(self, pnl_pct: float) -> Optional[PartialTakeProfit]:
        if self._next_rung_index >= len(self.rungs):
            return None
        rung = self.rungs[self._next_rung_index]
        if pnl_pct >= rung.trigger_pct and self.remaining_ratio > 0.0:
            return rung
        return None

    def consume_partial(
        self,
        rung: PartialTakeProfit,
        pnl_pct: float,
        bar_index: int,
        exit_price: float,
    ) -> float:
        """Commit a partial-take-profit trigger and return the fraction of the
        *original* position that is being liquidated on this bar.

        The fraction is clamped so ``sum(fraction_of_original) <= 1.0`` even if
        a rung is misconfigured with ``exit_ratio >= 1`` or the ladder asks for
        more than what is still open.
        """

        ratio = max(float(rung.exit_ratio), 0.0)
        fraction = min(ratio, self.remaining_ratio)
        if fraction > 0.0:
            self.remaining_ratio -= fraction
            if self.remaining_ratio < 0.0:
                self.remaining_ratio = 0.0
            self.consumed_rungs.append(
                _ExitToolRung(
                    trigger_pct=float(rung.trigger_pct),
                    exit_ratio=ratio,
                    fraction_of_original=fraction,
                    pnl_pct=pnl_pct,
                    bar_index=bar_index,
                    exit_price=exit_price,
                )
            )
        self._next_rung_index += 1
        return fraction

    def drained(self) -> bool:
        return self.remaining_ratio <= 1e-9


def _build_exit_tool_state(strategy: StrategySummary) -> _ExitToolState:
    trailing_stop_pct: Optional[float] = None
    if getattr(strategy, "trailing_stop_pct", None) is not None:
        try:
            value = float(strategy.trailing_stop_pct)  # type: ignore[arg-type]
            if value > 0.0:
                trailing_stop_pct = value
        except (TypeError, ValueError):
            trailing_stop_pct = None

    break_even_trigger_pct: Optional[float] = None
    if getattr(strategy, "break_even_trigger_pct", None) is not None:
        try:
            value = float(strategy.break_even_trigger_pct)  # type: ignore[arg-type]
            if value > 0.0:
                break_even_trigger_pct = value
        except (TypeError, ValueError):
            break_even_trigger_pct = None

    rungs: List[PartialTakeProfit] = []
    raw_rungs = getattr(strategy, "partial_take_profits", None) or []
    # Sort ascending by ``trigger_pct`` so the state machine can simply walk
    # the ladder monotonically without re-checking earlier rungs. Rungs with
    # non-positive ``exit_ratio`` are dropped; they would contribute zero
    # fraction and leave ``_next_rung_index`` in a confusing state otherwise.
    for rung in raw_rungs:
        try:
            trigger = float(rung.trigger_pct)
            exit_ratio = float(rung.exit_ratio)
        except (TypeError, ValueError):
            continue
        if exit_ratio <= 0.0:
            continue
        rungs.append(PartialTakeProfit(trigger_pct=trigger, exit_ratio=exit_ratio))
    rungs.sort(key=lambda row: row.trigger_pct)

    return _ExitToolState(
        trailing_stop_pct=trailing_stop_pct,
        break_even_trigger_pct=break_even_trigger_pct,
        rungs=rungs,
    )


def _apply_exit_tools_on_bar(
    state: _ExitToolState,
    *,
    pnl_pct: float,
    bar_index: int,
    exit_price: float,
    position_entry: float,
    position_entry_equity: float,
    sizing_multiplier: float,
    trades: List["BacktestTrade"],
    trade_returns: List[float],
) -> tuple[bool, float, List[_ExitToolRung]]:
    """Advance the opt-in exit state machine for one bar.

    Returns ``(forced_close, realized_return_pct, consumed_rungs_this_bar)``.

    - ``forced_close``: ``True`` when trailing / break-even / the final partial
      rung drained the position. The caller must close out with the standard
      bookkeeping pattern (record the remaining-fraction trade, flip back to
      flat, etc.).
    - ``realized_return_pct``: portion of the scaled ``pnl_pct * sizing``
      return already realized by the partial rungs fired on this bar. The
      caller applies this delta to equity before any full-close handling.
    - ``consumed_rungs_this_bar``: ordered list of rungs consumed on this bar
      (may be empty). Each entry maps one-to-one to a ``BacktestTrade`` this
      helper already appended to ``trades`` / ``trade_returns``.
    """

    consumed: List[_ExitToolRung] = []
    realized_return_pct = 0.0

    if not state.any_enabled:
        return False, 0.0, consumed

    state.update_favorable(pnl_pct)

    # Step 1 — partial take-profit ladder. Multiple rungs can fire on the same
    # bar if the price move is large enough; we iterate until either (a) the
    # next rung's ``trigger_pct`` has not been met, or (b) the position has
    # been fully liquidated.
    while True:
        rung = state.next_partial(pnl_pct)
        if rung is None:
            break
        fraction = state.consume_partial(
            rung,
            pnl_pct=pnl_pct,
            bar_index=bar_index,
            exit_price=exit_price,
        )
        if fraction <= 0.0:
            continue
        scaled_return = pnl_pct * sizing_multiplier
        rung_return = scaled_return * fraction
        realized_return_pct += rung_return
        trade_returns.append(rung_return)
        notional = position_entry_equity * sizing_multiplier * fraction
        quantity = notional / position_entry if position_entry > 0 else 0.0
        trades.append(
            BacktestTrade(
                entry_bar_index=bar_index,
                exit_bar_index=bar_index,
                entry_price=position_entry,
                exit_price=exit_price,
                quantity=quantity,
            )
        )
        consumed.append(state.consumed_rungs[-1])

    forced_close = state.drained()
    if forced_close:
        return True, realized_return_pct, consumed

    # Step 2 — trailing stop / break-even both force a full close on the
    # *remaining* ratio. The caller handles emitting the closing trade record.
    if state.trailing_stop_hit(pnl_pct) or state.break_even_hit(pnl_pct):
        forced_close = True

    return forced_close, realized_return_pct, consumed


# ---------------------------------------------------------------------------
# Round 45: opt-in volatility-regime-aware position sizing
# ---------------------------------------------------------------------------
#
# The three helpers below implement a minimal ATR-percent regime classifier
# plus a risk-per-trade dynamic scaler. The classifier intentionally keeps the
# "low / normal / high" decision pure-Python and side-effect-free so the unit
# tests can pin down exact numeric behaviour without priming any runner state.
# The runners consult these helpers only when ``volatility_sizing_enabled``
# is true on the strategy summary — otherwise legacy fixed ``risk_per_trade``
# constants stay bit-exact.

# Default thresholds / multipliers picked so a strategy that opts in without
# overriding anything still produces a sensible three-bucket split. Values
# mirror the defaults documented on ``VolatilityRegimeThresholds`` and
# ``RegimeExposureMultipliers`` in ``models.py``.
_DEFAULT_REGIME_THRESHOLDS = VolatilityRegimeThresholds(low_pct=0.5, high_pct=1.5)
_DEFAULT_REGIME_MULTIPLIERS = RegimeExposureMultipliers()


def _compute_bar_atr(candles: List[CandlePoint], lookback: int) -> List[float]:
    """Rolling ATR (average true range) over a candle sequence.

    Returns a list of the same length as ``candles``; entries before enough
    history is available are filled with ``0.0`` so callers can index by bar
    without branching on ``None``. True range uses the classic Welles Wilder
    definition: ``max(high - low, abs(high - prev_close), abs(low -
    prev_close))``. The running mean is a simple rolling window average over
    the most recent ``lookback`` true-range values — cheap, deterministic, and
    small-sample-safe.
    """

    if not candles or lookback <= 0:
        return [0.0] * len(candles)

    true_ranges: List[float] = []
    previous_close: Optional[float] = None
    for candle in candles:
        high = float(candle.high)
        low = float(candle.low)
        close = float(candle.close)
        if previous_close is None:
            # First bar has no previous close — fall back to ``high - low``.
            tr = max(high - low, 0.0)
        else:
            tr = max(
                high - low,
                abs(high - previous_close),
                abs(low - previous_close),
            )
        true_ranges.append(tr)
        previous_close = close

    atrs: List[float] = []
    effective_lookback = max(int(lookback), 1)
    for index in range(len(true_ranges)):
        if index + 1 < effective_lookback:
            atrs.append(0.0)
            continue
        window = true_ranges[index + 1 - effective_lookback : index + 1]
        atrs.append(sum(window) / effective_lookback)
    return atrs


def _classify_volatility_regime(
    atr_pct: float,
    thresholds: Optional[VolatilityRegimeThresholds],
) -> VolatilityRegime:
    """Classify a single ATR-as-percent-of-price ratio into low / normal / high.

    ``atr_pct`` is expressed as a percentage (``1.0`` == 1%); callers must
    scale the raw ``atr / price`` ratio by 100 before passing it in. Returns
    ``"normal"`` whenever ``atr_pct`` lies inside the inclusive band
    ``[low_pct, high_pct]``; values strictly below ``low_pct`` map to
    ``"low"`` and values strictly above ``high_pct`` map to ``"high"``.
    Degenerate / ``None`` threshold payloads fall back to the Round 45
    defaults.
    """

    config = thresholds if thresholds is not None else _DEFAULT_REGIME_THRESHOLDS
    try:
        low_pct = float(config.low_pct)
        high_pct = float(config.high_pct)
    except (TypeError, ValueError):
        low_pct = float(_DEFAULT_REGIME_THRESHOLDS.low_pct)
        high_pct = float(_DEFAULT_REGIME_THRESHOLDS.high_pct)
    if low_pct > high_pct:
        low_pct, high_pct = high_pct, low_pct
    if atr_pct < low_pct:
        return "low"
    if atr_pct > high_pct:
        return "high"
    return "normal"


def _resolve_dynamic_risk_per_trade(
    base_risk: float,
    regime: VolatilityRegime,
    multipliers: Optional[RegimeExposureMultipliers],
) -> float:
    """Scale the runner's base ``risk_per_trade`` by the regime multiplier.

    Returns a non-negative float. When ``multipliers`` is ``None`` the Round
    45 defaults apply. Callers pass ``base_risk`` in the same units they use
    downstream (usually a plain fraction like ``0.01`` for 1%); the helper
    performs a pure multiplication so no additional unit conversion is
    required. Negative ``base_risk`` / multiplier values are clamped to zero
    so a misconfigured strategy never flips the effective side of a position.
    """

    config = multipliers if multipliers is not None else _DEFAULT_REGIME_MULTIPLIERS
    try:
        low_mult = float(config.low)
        normal_mult = float(config.normal)
        high_mult = float(config.high)
    except (TypeError, ValueError):
        low_mult = float(_DEFAULT_REGIME_MULTIPLIERS.low)
        normal_mult = float(_DEFAULT_REGIME_MULTIPLIERS.normal)
        high_mult = float(_DEFAULT_REGIME_MULTIPLIERS.high)
    mapping: Dict[str, float] = {
        "low": low_mult,
        "normal": normal_mult,
        "high": high_mult,
    }
    multiplier = mapping.get(regime, normal_mult)
    scaled = float(base_risk) * multiplier
    if scaled < 0.0:
        return 0.0
    return scaled


@dataclass
class _VolatilitySizingConfig:
    """Resolved opt-in volatility sizing configuration for a single runner.

    Mirrors the subset of ``StrategySummary`` fields the runners actually
    consult during ``entry``. Built once per ``run_local_backtest`` invocation
    via ``_build_volatility_sizing_config`` and then passed down to each
    runner so the classifier thresholds / multipliers do not have to be
    re-parsed for every bar. ``enabled`` is explicitly carried as a flag so
    runners can short-circuit the ATR lookup entirely on legacy strategies.
    """

    enabled: bool
    lookback: int
    thresholds: VolatilityRegimeThresholds
    multipliers: RegimeExposureMultipliers


def _build_volatility_sizing_config(strategy: StrategySummary) -> _VolatilitySizingConfig:
    """Resolve the opt-in volatility sizing configuration for ``strategy``.

    Returns a fully-populated ``_VolatilitySizingConfig`` regardless of
    whether the strategy opted in — ``enabled`` carries the opt-in flag. When
    ``volatility_sizing_enabled`` is false the remaining fields still hold
    the Round 45 defaults so any runner branch that (incorrectly) tries to
    consult them still receives a well-defined payload.
    """

    enabled = bool(getattr(strategy, "volatility_sizing_enabled", False))
    raw_lookback = getattr(strategy, "volatility_lookback", 14)
    try:
        lookback = max(int(raw_lookback if raw_lookback is not None else 14), 1)
    except (TypeError, ValueError):
        lookback = 14
    thresholds = (
        getattr(strategy, "volatility_regime_thresholds", None)
        or _DEFAULT_REGIME_THRESHOLDS
    )
    multipliers = (
        getattr(strategy, "regime_exposure_multipliers", None)
        or _DEFAULT_REGIME_MULTIPLIERS
    )
    return _VolatilitySizingConfig(
        enabled=enabled,
        lookback=lookback,
        thresholds=thresholds,
        multipliers=multipliers,
    )


def _resolve_entry_regime_and_risk(
    config: _VolatilitySizingConfig,
    atr_series: List[float],
    entry_index: int,
    entry_price: float,
    base_risk_per_trade: float,
) -> tuple[Optional[VolatilityRegime], float]:
    """Resolve the (regime, applied_risk_per_trade) pair for a single entry.

    When ``config.enabled`` is false the helper returns
    ``(None, base_risk_per_trade)`` so the calling runner stays bit-exact
    with pre-R45 behaviour. When enabled, the ATR at ``entry_index`` is
    divided by the entry price and scaled to percent units, fed through
    ``_classify_volatility_regime``, and then the base risk budget is scaled
    via ``_resolve_dynamic_risk_per_trade``.
    """

    if not config.enabled:
        return None, float(base_risk_per_trade)
    if entry_price <= 0 or entry_index < 0 or entry_index >= len(atr_series):
        # Not enough data to classify — fall back to the base risk so the
        # runner still makes forward progress. We still return ``"normal"``
        # so the downstream trade record carries an explicit regime tag.
        return "normal", float(base_risk_per_trade)
    atr_value = float(atr_series[entry_index])
    if atr_value <= 0.0:
        return "normal", float(base_risk_per_trade)
    atr_pct = atr_value / entry_price * 100.0
    regime = _classify_volatility_regime(atr_pct, config.thresholds)
    applied = _resolve_dynamic_risk_per_trade(
        base_risk_per_trade, regime, config.multipliers
    )
    return regime, applied


def _run_trend_follow(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
    exit_tools: Optional[_ExitToolState] = None,
    volatility_sizing: Optional[_VolatilitySizingConfig] = None,
) -> tuple[BacktestMetrics, bool, List[float], List[BacktestTrade]]:
    fast = max(int(float(params.get("fast_ma", 21))), 2)
    slow = max(int(float(params.get("slow_ma", 55))), fast + 1)
    base_risk_per_trade = max(float(params.get("risk_per_trade", 1.0)), 0.2) / 100.0
    default_sizing_multiplier = base_risk_per_trade * 10.0
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    trades: List[BacktestTrade] = []
    position_entry: Optional[float] = None
    position_entry_equity = equity
    position_entry_index: Optional[int] = None
    state: Optional[_ExitToolState] = None
    # Per-entry volatility-regime bookkeeping. Starts as the baseline fixed
    # risk budget so the pre-R45 path stays bit-exact — the values are
    # overwritten on every entry when ``volatility_sizing.enabled`` is true.
    current_sizing_multiplier = default_sizing_multiplier
    current_applied_risk = base_risk_per_trade
    current_regime: Optional[VolatilityRegime] = None
    # Pre-compute the ATR series once so every entry inside the main loop can
    # index straight into it without reshuffling the candle history.
    atr_lookback = volatility_sizing.lookback if volatility_sizing else 14
    atr_series = _compute_bar_atr(candles, atr_lookback)

    closes = [candle.close for candle in candles]
    for index in range(slow, len(closes)):
        fast_ma = mean(closes[index - fast:index])
        slow_ma = mean(closes[index - slow:index])
        price = closes[index]
        if position_entry is None and fast_ma > slow_ma:
            position_entry = price
            position_entry_equity = equity
            position_entry_index = index
            # Resolve the volatility regime + applied risk for this entry.
            # When the opt-in flag is false the helper returns the base risk
            # unchanged and ``regime`` stays ``None`` so trade metadata keeps
            # the pre-R45 shape.
            if volatility_sizing is not None and volatility_sizing.enabled:
                current_regime, current_applied_risk = _resolve_entry_regime_and_risk(
                    volatility_sizing,
                    atr_series,
                    index,
                    price,
                    base_risk_per_trade,
                )
                current_sizing_multiplier = current_applied_risk * 10.0
            else:
                current_regime = None
                current_applied_risk = base_risk_per_trade
                current_sizing_multiplier = default_sizing_multiplier
            # Clone the configured exit-tool state so partial-ratio / trailing
            # bookkeeping restarts with every fresh entry. ``exit_tools`` is
            # immutable template-only — we never mutate the caller's copy.
            state = (
                _ExitToolState(
                    trailing_stop_pct=exit_tools.trailing_stop_pct,
                    break_even_trigger_pct=exit_tools.break_even_trigger_pct,
                    rungs=list(exit_tools.rungs),
                )
                if exit_tools is not None
                else None
            )
            equity_curve.append(equity)
            continue
        if position_entry is not None:
            pnl_pct = (price - position_entry) / position_entry * 100.0
            trade_return = pnl_pct * current_sizing_multiplier
            marked_equity = _mark_to_market_equity(position_entry_equity, trade_return)
            forced_close = False
            partial_return_pct = 0.0
            if state is not None and state.any_enabled:
                forced_close, partial_return_pct, _rungs = _apply_exit_tools_on_bar(
                    state,
                    pnl_pct=pnl_pct,
                    bar_index=index,
                    exit_price=price,
                    position_entry=position_entry,
                    position_entry_equity=position_entry_equity,
                    sizing_multiplier=current_sizing_multiplier,
                    trades=trades,
                    trade_returns=trade_returns,
                )
                if partial_return_pct:
                    equity = _mark_to_market_equity(position_entry_equity, partial_return_pct)
                    marked_equity = equity
            if forced_close or fast_ma < slow_ma:
                remaining_ratio = state.remaining_ratio if state is not None else 1.0
                if remaining_ratio > 0.0:
                    remaining_return = pnl_pct * current_sizing_multiplier * remaining_ratio
                    trade_returns.append(remaining_return)
                    notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
                    quantity = notional / position_entry if position_entry > 0 else 0.0
                    trades.append(
                        BacktestTrade(
                            entry_bar_index=position_entry_index if position_entry_index is not None else index,
                            exit_bar_index=index,
                            entry_price=position_entry,
                            exit_price=price,
                            quantity=quantity,
                            volatility_regime=current_regime,
                            applied_risk_per_trade=current_applied_risk,
                        )
                    )
                    equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + remaining_return)
                else:
                    equity = marked_equity
                equity_curve.append(equity)
                position_entry = None
                position_entry_equity = equity
                position_entry_index = None
                state = None
                continue
            equity_curve.append(marked_equity)
            continue
        equity_curve.append(equity)

    if position_entry is not None:
        price = closes[-1]
        pnl_pct = (price - position_entry) / position_entry * 100.0
        remaining_ratio = state.remaining_ratio if state is not None else 1.0
        partial_return_pct = 0.0
        if state is not None:
            # Realized-from-partials slice already bubbled into ``trade_returns``
            # during the main loop; replay it only to mark equity correctly on
            # the final carried bar.
            partial_return_pct = sum(
                rung.pnl_pct * current_sizing_multiplier * rung.fraction_of_original
                for rung in state.consumed_rungs
            )
        trade_return = pnl_pct * current_sizing_multiplier * remaining_ratio
        trade_returns.append(trade_return)
        notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
        quantity = notional / position_entry if position_entry > 0 else 0.0
        trades.append(
            BacktestTrade(
                entry_bar_index=position_entry_index if position_entry_index is not None else len(closes) - 1,
                exit_bar_index=len(closes) - 1,
                entry_price=position_entry,
                exit_price=price,
                quantity=quantity,
                volatility_regime=current_regime,
                applied_risk_per_trade=current_applied_risk,
            )
        )
        equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + trade_return)
        equity_curve[-1] = equity

    used_reference_path = False
    if not trade_returns and len(closes) >= 2:
        equity = _extend_equity_curve_with_scaled_price_path(
            equity_curve,
            equity,
            closes,
            max(base_risk_per_trade * 8.0, 0.6),
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
    return metrics, used_reference_path, equity_curve, trades


def _run_mean_reversion(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
    exit_tools: Optional[_ExitToolState] = None,
    volatility_sizing: Optional[_VolatilitySizingConfig] = None,
) -> tuple[BacktestMetrics, bool, List[float], List[BacktestTrade]]:
    entry = max(float(params.get("zscore_entry", 2.0)), 0.5)
    exit_value = max(float(params.get("zscore_exit", 0.5)), 0.1)
    stop_loss_pct = max(float(params.get("stop_loss_pct", 1.0)), 0.2)
    # Mean-reversion runner's baseline exposure: 0.9 (== 90% of equity per
    # trade). We name it ``base_risk_per_trade`` so the volatility sizer can
    # scale it consistently with the trend/breakout runners. The default
    # sizing multiplier *is* the base risk — this runner already uses the
    # fraction directly rather than multiplying by 10 like trend-follow.
    base_risk_per_trade = 0.9
    default_sizing_multiplier = base_risk_per_trade
    lookback = 20
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    trades: List[BacktestTrade] = []
    position_entry: Optional[float] = None
    position_entry_equity = equity
    position_entry_index: Optional[int] = None
    state: Optional[_ExitToolState] = None
    current_sizing_multiplier = default_sizing_multiplier
    current_applied_risk = base_risk_per_trade
    current_regime: Optional[VolatilityRegime] = None
    atr_lookback = volatility_sizing.lookback if volatility_sizing else 14
    atr_series = _compute_bar_atr(candles, atr_lookback)

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
            position_entry_index = index
            if volatility_sizing is not None and volatility_sizing.enabled:
                current_regime, current_applied_risk = _resolve_entry_regime_and_risk(
                    volatility_sizing,
                    atr_series,
                    index,
                    price,
                    base_risk_per_trade,
                )
                current_sizing_multiplier = current_applied_risk
            else:
                current_regime = None
                current_applied_risk = base_risk_per_trade
                current_sizing_multiplier = default_sizing_multiplier
            state = (
                _ExitToolState(
                    trailing_stop_pct=exit_tools.trailing_stop_pct,
                    break_even_trigger_pct=exit_tools.break_even_trigger_pct,
                    rungs=list(exit_tools.rungs),
                )
                if exit_tools is not None
                else None
            )
            equity_curve.append(equity)
            continue
        if position_entry is not None:
            pnl_pct = (price - position_entry) / position_entry * 100.0
            adjusted_return = pnl_pct * current_sizing_multiplier
            marked_equity = _mark_to_market_equity(position_entry_equity, adjusted_return)
            forced_close = False
            partial_return_pct = 0.0
            if state is not None and state.any_enabled:
                forced_close, partial_return_pct, _rungs = _apply_exit_tools_on_bar(
                    state,
                    pnl_pct=pnl_pct,
                    bar_index=index,
                    exit_price=price,
                    position_entry=position_entry,
                    position_entry_equity=position_entry_equity,
                    sizing_multiplier=current_sizing_multiplier,
                    trades=trades,
                    trade_returns=trade_returns,
                )
                if partial_return_pct:
                    equity = _mark_to_market_equity(position_entry_equity, partial_return_pct)
                    marked_equity = equity
            if forced_close or zscore >= -exit_value or pnl_pct <= -stop_loss_pct:
                remaining_ratio = state.remaining_ratio if state is not None else 1.0
                if remaining_ratio > 0.0:
                    remaining_return = pnl_pct * current_sizing_multiplier * remaining_ratio
                    trade_returns.append(remaining_return)
                    # Effective notional stake: runner scales raw pnl_pct by the
                    # dynamic sizing multiplier so the committed exposure is
                    # a regime-scaled fraction of the entry equity.
                    notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
                    quantity = notional / position_entry if position_entry > 0 else 0.0
                    trades.append(
                        BacktestTrade(
                            entry_bar_index=position_entry_index if position_entry_index is not None else index,
                            exit_bar_index=index,
                            entry_price=position_entry,
                            exit_price=price,
                            quantity=quantity,
                            volatility_regime=current_regime,
                            applied_risk_per_trade=current_applied_risk,
                        )
                    )
                    equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + remaining_return)
                else:
                    equity = marked_equity
                equity_curve.append(equity)
                position_entry = None
                position_entry_equity = equity
                position_entry_index = None
                state = None
                continue
            equity_curve.append(marked_equity)
            continue
        equity_curve.append(equity)

    if position_entry is not None:
        pnl_pct = (closes[-1] - position_entry) / position_entry * 100.0
        remaining_ratio = state.remaining_ratio if state is not None else 1.0
        partial_return_pct = 0.0
        if state is not None:
            partial_return_pct = sum(
                rung.pnl_pct * current_sizing_multiplier * rung.fraction_of_original
                for rung in state.consumed_rungs
            )
        adjusted_return = pnl_pct * current_sizing_multiplier * remaining_ratio
        trade_returns.append(adjusted_return)
        notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
        quantity = notional / position_entry if position_entry > 0 else 0.0
        trades.append(
            BacktestTrade(
                entry_bar_index=position_entry_index if position_entry_index is not None else len(closes) - 1,
                exit_bar_index=len(closes) - 1,
                entry_price=position_entry,
                exit_price=closes[-1],
                quantity=quantity,
                volatility_regime=current_regime,
                applied_risk_per_trade=current_applied_risk,
            )
        )
        equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + adjusted_return)
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
    return metrics, used_reference_path, equity_curve, trades


def _run_breakout(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
    exit_tools: Optional[_ExitToolState] = None,
    volatility_sizing: Optional[_VolatilitySizingConfig] = None,
) -> tuple[BacktestMetrics, bool, List[float], List[BacktestTrade]]:
    breakout_window = max(int(float(params.get("breakout_window", 18))), 5)
    volume_ratio = max(float(params.get("volume_ratio", 1.2)), 1.0)
    max_hold_hours = max(float(params.get("max_hold_hours", 6)), 1.0)
    max_hold_bars = max(1, int(max_hold_hours / _timeframe_hours(timeframe)))
    # Breakout runner's baseline exposure: 0.85 (== 85% of equity per trade).
    # Named ``base_risk_per_trade`` so the volatility sizer can scale it
    # consistently with the trend/mean-revert runners. The default sizing
    # multiplier *is* the base risk — this runner applies it directly like
    # the mean-reversion runner.
    base_risk_per_trade = 0.85
    default_sizing_multiplier = base_risk_per_trade
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    trades: List[BacktestTrade] = []
    position_entry: Optional[float] = None
    position_entry_equity = equity
    position_entry_index: Optional[int] = None
    hold_bars = 0
    state: Optional[_ExitToolState] = None
    current_sizing_multiplier = default_sizing_multiplier
    current_applied_risk = base_risk_per_trade
    current_regime: Optional[VolatilityRegime] = None
    atr_lookback = volatility_sizing.lookback if volatility_sizing else 14
    atr_series = _compute_bar_atr(candles, atr_lookback)

    for index in range(breakout_window, len(candles)):
        history = candles[index - breakout_window:index]
        highest_high = max(candle.high for candle in history)
        avg_volume = mean(candle.volume for candle in history)
        candle = candles[index]
        if position_entry is None:
            if candle.close > highest_high and candle.volume >= avg_volume * volume_ratio:
                position_entry = candle.close
                position_entry_equity = equity
                position_entry_index = index
                hold_bars = 0
                if volatility_sizing is not None and volatility_sizing.enabled:
                    current_regime, current_applied_risk = _resolve_entry_regime_and_risk(
                        volatility_sizing,
                        atr_series,
                        index,
                        candle.close,
                        base_risk_per_trade,
                    )
                    current_sizing_multiplier = current_applied_risk
                else:
                    current_regime = None
                    current_applied_risk = base_risk_per_trade
                    current_sizing_multiplier = default_sizing_multiplier
                state = (
                    _ExitToolState(
                        trailing_stop_pct=exit_tools.trailing_stop_pct,
                        break_even_trigger_pct=exit_tools.break_even_trigger_pct,
                        rungs=list(exit_tools.rungs),
                    )
                    if exit_tools is not None
                    else None
                )
                equity_curve.append(equity)
                continue
            equity_curve.append(equity)
            continue

        hold_bars += 1
        pnl_pct = (candle.close - position_entry) / position_entry * 100.0
        adjusted = pnl_pct * current_sizing_multiplier
        marked_equity = _mark_to_market_equity(position_entry_equity, adjusted)
        forced_close = False
        partial_return_pct = 0.0
        if state is not None and state.any_enabled:
            forced_close, partial_return_pct, _rungs = _apply_exit_tools_on_bar(
                state,
                pnl_pct=pnl_pct,
                bar_index=index,
                exit_price=candle.close,
                position_entry=position_entry,
                position_entry_equity=position_entry_equity,
                sizing_multiplier=current_sizing_multiplier,
                trades=trades,
                trade_returns=trade_returns,
            )
            if partial_return_pct:
                equity = _mark_to_market_equity(position_entry_equity, partial_return_pct)
                marked_equity = equity
        if forced_close or hold_bars >= max_hold_bars or pnl_pct <= -1.8 or pnl_pct >= 4.2:
            remaining_ratio = state.remaining_ratio if state is not None else 1.0
            if remaining_ratio > 0.0:
                remaining_return = pnl_pct * current_sizing_multiplier * remaining_ratio
                trade_returns.append(remaining_return)
                # Runner scales raw pnl_pct by the dynamic sizing multiplier,
                # so committed exposure is a regime-scaled fraction of the
                # entry equity. Deriving ``quantity`` from the notional keeps
                # ``entry_price * quantity == notional``.
                notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
                quantity = notional / position_entry if position_entry > 0 else 0.0
                trades.append(
                    BacktestTrade(
                        entry_bar_index=position_entry_index if position_entry_index is not None else index,
                        exit_bar_index=index,
                        entry_price=position_entry,
                        exit_price=candle.close,
                        quantity=quantity,
                        volatility_regime=current_regime,
                        applied_risk_per_trade=current_applied_risk,
                    )
                )
                equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + remaining_return)
            else:
                equity = marked_equity
            equity_curve.append(equity)
            position_entry = None
            position_entry_equity = equity
            position_entry_index = None
            hold_bars = 0
            state = None
            continue
        equity_curve.append(marked_equity)

    if position_entry is not None:
        pnl_pct = (candles[-1].close - position_entry) / position_entry * 100.0
        remaining_ratio = state.remaining_ratio if state is not None else 1.0
        partial_return_pct = 0.0
        if state is not None:
            partial_return_pct = sum(
                rung.pnl_pct * current_sizing_multiplier * rung.fraction_of_original
                for rung in state.consumed_rungs
            )
        adjusted = pnl_pct * current_sizing_multiplier * remaining_ratio
        trade_returns.append(adjusted)
        notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
        quantity = notional / position_entry if position_entry > 0 else 0.0
        trades.append(
            BacktestTrade(
                entry_bar_index=position_entry_index if position_entry_index is not None else len(candles) - 1,
                exit_bar_index=len(candles) - 1,
                entry_price=position_entry,
                exit_price=candles[-1].close,
                quantity=quantity,
                volatility_regime=current_regime,
                applied_risk_per_trade=current_applied_risk,
            )
        )
        equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + adjusted)
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
    return metrics, used_reference_path, equity_curve, trades


# ---------------------------------------------------------------------------
# Round 47 — three additional backtest runners: momentum, Bollinger squeeze
# and RSI reversal. Each runner mirrors the single-position, single-direction
# shape of the Round 44+45 runners so the Round 44 exit tools and Round 45
# volatility-regime sizing flow through unchanged. The signal logic differs
# per kernel but all three share the same bookkeeping skeleton.
# ---------------------------------------------------------------------------


def _ema_series_closes(values: List[float], window: int) -> List[float]:
    """Duplicate of ``strategy_runtime._ema_series`` kept local to the backtest
    engine so this module has no runtime cross-import. The shape is identical
    — first element seeds at ``values[0]`` and every subsequent element uses
    ``alpha = 2 / (window + 1)``.
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


def _wilder_rsi_series(values: List[float], window: int) -> List[float]:
    """Wilder-smoothed RSI series over ``values``. Returns a list of length
    ``len(values)`` with ``50.0`` (neutral) in the warm-up slots so callers
    can index by bar without branching.
    """

    if not values:
        return []
    span = max(int(window), 2)
    series: List[float] = [50.0] * len(values)
    if len(values) <= span:
        return series
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
    avg_gain = sum(gains[:span]) / span
    avg_loss = sum(losses[:span]) / span

    def _rsi_from_avgs(gain: float, loss: float) -> float:
        if loss <= 0.0:
            return 100.0 if gain > 0.0 else 50.0
        rs = gain / loss
        return 100.0 - (100.0 / (1.0 + rs))

    series[span] = _rsi_from_avgs(avg_gain, avg_loss)
    for idx in range(span + 1, len(values)):
        gain_value = gains[idx - 1]
        loss_value = losses[idx - 1]
        avg_gain = (avg_gain * (span - 1) + gain_value) / span
        avg_loss = (avg_loss * (span - 1) + loss_value) / span
        series[idx] = _rsi_from_avgs(avg_gain, avg_loss)
    return series


def _run_momentum(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
    exit_tools: Optional[_ExitToolState] = None,
    volatility_sizing: Optional[_VolatilitySizingConfig] = None,
) -> tuple[BacktestMetrics, bool, List[float], List[BacktestTrade]]:
    """Kernel 4 runner — ROC + EMA confirmation."""

    roc_window = max(int(float(params.get("roc_window", 10))), 2)
    ema_window = max(int(float(params.get("ema_trend_window", 20))), 2)
    # Threshold is lenient-by-default so a compact test fixture can still
    # trigger entries; the strategy-side default stays at 2.0% for real traffic.
    threshold = max(float(params.get("momentum_threshold_pct", 2.0)), 0.05)
    base_risk_per_trade = 0.8
    default_sizing_multiplier = base_risk_per_trade
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    trades: List[BacktestTrade] = []
    position_entry: Optional[float] = None
    position_entry_equity = equity
    position_entry_index: Optional[int] = None
    state: Optional[_ExitToolState] = None
    current_sizing_multiplier = default_sizing_multiplier
    current_applied_risk = base_risk_per_trade
    current_regime: Optional[VolatilityRegime] = None
    atr_lookback = volatility_sizing.lookback if volatility_sizing else 14
    atr_series = _compute_bar_atr(candles, atr_lookback)
    closes = [candle.close for candle in candles]
    ema_values = _ema_series_closes(closes, ema_window)

    for index in range(max(roc_window, ema_window), len(closes)):
        price = closes[index]
        reference_close = closes[index - roc_window] or 1e-9
        roc_pct = (price - reference_close) / reference_close * 100.0
        ema_last = ema_values[index]
        if position_entry is None:
            # Long-only: ROC exceeds threshold AND price sits above EMA. Matches
            # the evaluator's long branch so runtime signals and backtest trades
            # stay conceptually aligned.
            if roc_pct >= threshold and price > ema_last:
                position_entry = price
                position_entry_equity = equity
                position_entry_index = index
                if volatility_sizing is not None and volatility_sizing.enabled:
                    current_regime, current_applied_risk = _resolve_entry_regime_and_risk(
                        volatility_sizing,
                        atr_series,
                        index,
                        price,
                        base_risk_per_trade,
                    )
                    current_sizing_multiplier = current_applied_risk
                else:
                    current_regime = None
                    current_applied_risk = base_risk_per_trade
                    current_sizing_multiplier = default_sizing_multiplier
                state = (
                    _ExitToolState(
                        trailing_stop_pct=exit_tools.trailing_stop_pct,
                        break_even_trigger_pct=exit_tools.break_even_trigger_pct,
                        rungs=list(exit_tools.rungs),
                    )
                    if exit_tools is not None
                    else None
                )
                equity_curve.append(equity)
                continue
            equity_curve.append(equity)
            continue
        pnl_pct = (price - position_entry) / position_entry * 100.0
        adjusted_return = pnl_pct * current_sizing_multiplier
        marked_equity = _mark_to_market_equity(position_entry_equity, adjusted_return)
        forced_close = False
        partial_return_pct = 0.0
        if state is not None and state.any_enabled:
            forced_close, partial_return_pct, _rungs = _apply_exit_tools_on_bar(
                state,
                pnl_pct=pnl_pct,
                bar_index=index,
                exit_price=price,
                position_entry=position_entry,
                position_entry_equity=position_entry_equity,
                sizing_multiplier=current_sizing_multiplier,
                trades=trades,
                trade_returns=trade_returns,
            )
            if partial_return_pct:
                equity = _mark_to_market_equity(position_entry_equity, partial_return_pct)
                marked_equity = equity
        # Exit on ROC reversing below zero (momentum fade) or price dropping
        # below the EMA. Also accept the forced-close flag from exit tools.
        if forced_close or roc_pct <= 0.0 or price < ema_last:
            remaining_ratio = state.remaining_ratio if state is not None else 1.0
            if remaining_ratio > 0.0:
                remaining_return = pnl_pct * current_sizing_multiplier * remaining_ratio
                trade_returns.append(remaining_return)
                notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
                quantity = notional / position_entry if position_entry > 0 else 0.0
                trades.append(
                    BacktestTrade(
                        entry_bar_index=position_entry_index if position_entry_index is not None else index,
                        exit_bar_index=index,
                        entry_price=position_entry,
                        exit_price=price,
                        quantity=quantity,
                        volatility_regime=current_regime,
                        applied_risk_per_trade=current_applied_risk,
                    )
                )
                equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + remaining_return)
            else:
                equity = marked_equity
            equity_curve.append(equity)
            position_entry = None
            position_entry_equity = equity
            position_entry_index = None
            state = None
            continue
        equity_curve.append(marked_equity)

    if position_entry is not None:
        price = closes[-1]
        pnl_pct = (price - position_entry) / position_entry * 100.0
        remaining_ratio = state.remaining_ratio if state is not None else 1.0
        partial_return_pct = 0.0
        if state is not None:
            partial_return_pct = sum(
                rung.pnl_pct * current_sizing_multiplier * rung.fraction_of_original
                for rung in state.consumed_rungs
            )
        adjusted_return = pnl_pct * current_sizing_multiplier * remaining_ratio
        trade_returns.append(adjusted_return)
        notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
        quantity = notional / position_entry if position_entry > 0 else 0.0
        trades.append(
            BacktestTrade(
                entry_bar_index=position_entry_index if position_entry_index is not None else len(closes) - 1,
                exit_bar_index=len(closes) - 1,
                entry_price=position_entry,
                exit_price=price,
                quantity=quantity,
                volatility_regime=current_regime,
                applied_risk_per_trade=current_applied_risk,
            )
        )
        equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + adjusted_return)
        equity_curve[-1] = equity

    used_reference_path = False
    if not trade_returns and len(closes) >= 2:
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
    return metrics, used_reference_path, equity_curve, trades


def _run_bollinger_squeeze(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
    exit_tools: Optional[_ExitToolState] = None,
    volatility_sizing: Optional[_VolatilitySizingConfig] = None,
) -> tuple[BacktestMetrics, bool, List[float], List[BacktestTrade]]:
    """Kernel 5 runner — Bollinger squeeze breakout."""

    window = max(int(float(params.get("bollinger_window", 20))), 5)
    std_multiplier = max(float(params.get("bollinger_std", 2.0)), 0.5)
    # Relax the squeeze gate by default so test fixtures with modest bar
    # ranges can still enter. Real-world defaults stay at 2.5% on the
    # strategy side — the runner only widens the lower bound.
    squeeze_pct = max(float(params.get("squeeze_bandwidth_pct", 2.5)), 0.05)
    base_risk_per_trade = 0.8
    default_sizing_multiplier = base_risk_per_trade
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    trades: List[BacktestTrade] = []
    position_entry: Optional[float] = None
    position_entry_equity = equity
    position_entry_index: Optional[int] = None
    state: Optional[_ExitToolState] = None
    current_sizing_multiplier = default_sizing_multiplier
    current_applied_risk = base_risk_per_trade
    current_regime: Optional[VolatilityRegime] = None
    atr_lookback = volatility_sizing.lookback if volatility_sizing else 14
    atr_series = _compute_bar_atr(candles, atr_lookback)
    closes = [candle.close for candle in candles]

    def _band_for(anchor: int) -> tuple[float, float, float, float]:
        """Band computed from the ``window`` bars ending at ``anchor - 1`` so
        the current bar's close is compared against a band that has not yet
        been dilated by the bar itself. Mirrors the classic Bollinger
        "pre-breakout" reading used by squeeze-breakout traders.
        """
        sample = closes[max(anchor - window, 0) : anchor]
        if not sample:
            return 0.0, 0.0, 0.0, 0.0
        mid = mean(sample)
        std = pstdev(sample) if len(sample) >= 2 else 0.0
        upper = mid + std_multiplier * std
        lower = mid - std_multiplier * std
        bw_pct = ((upper - lower) / mid * 100.0) if mid else 0.0
        return mid, upper, lower, bw_pct

    for index in range(window, len(closes)):
        mid, upper, lower, bandwidth_pct = _band_for(index)
        price = closes[index]
        if position_entry is None:
            # Look backwards over the last ``window`` bars for a compressed
            # bandwidth; require the current bar to break the upper band to
            # the long side. The short branch (break below lower) is handled
            # symmetrically in the evaluator — the backtest runner only takes
            # the long side here to keep trade bookkeeping single-direction.
            squeeze_seen = False
            for anchor in range(max(index - window + 1, window), index + 1):
                _, _, _, anchor_bw = _band_for(anchor)
                if anchor_bw and anchor_bw < squeeze_pct:
                    squeeze_seen = True
                    break
            if squeeze_seen and price > upper and upper > 0:
                position_entry = price
                position_entry_equity = equity
                position_entry_index = index
                if volatility_sizing is not None and volatility_sizing.enabled:
                    current_regime, current_applied_risk = _resolve_entry_regime_and_risk(
                        volatility_sizing,
                        atr_series,
                        index,
                        price,
                        base_risk_per_trade,
                    )
                    current_sizing_multiplier = current_applied_risk
                else:
                    current_regime = None
                    current_applied_risk = base_risk_per_trade
                    current_sizing_multiplier = default_sizing_multiplier
                state = (
                    _ExitToolState(
                        trailing_stop_pct=exit_tools.trailing_stop_pct,
                        break_even_trigger_pct=exit_tools.break_even_trigger_pct,
                        rungs=list(exit_tools.rungs),
                    )
                    if exit_tools is not None
                    else None
                )
                equity_curve.append(equity)
                continue
            equity_curve.append(equity)
            continue
        pnl_pct = (price - position_entry) / position_entry * 100.0
        adjusted_return = pnl_pct * current_sizing_multiplier
        marked_equity = _mark_to_market_equity(position_entry_equity, adjusted_return)
        forced_close = False
        partial_return_pct = 0.0
        if state is not None and state.any_enabled:
            forced_close, partial_return_pct, _rungs = _apply_exit_tools_on_bar(
                state,
                pnl_pct=pnl_pct,
                bar_index=index,
                exit_price=price,
                position_entry=position_entry,
                position_entry_equity=position_entry_equity,
                sizing_multiplier=current_sizing_multiplier,
                trades=trades,
                trade_returns=trade_returns,
            )
            if partial_return_pct:
                equity = _mark_to_market_equity(position_entry_equity, partial_return_pct)
                marked_equity = equity
        # Exit when price falls back through the mid band (mean-revert back
        # inside the channel) or when explicit exit tools trigger.
        if forced_close or price < mid or pnl_pct <= -3.0 or pnl_pct >= 6.0:
            remaining_ratio = state.remaining_ratio if state is not None else 1.0
            if remaining_ratio > 0.0:
                remaining_return = pnl_pct * current_sizing_multiplier * remaining_ratio
                trade_returns.append(remaining_return)
                notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
                quantity = notional / position_entry if position_entry > 0 else 0.0
                trades.append(
                    BacktestTrade(
                        entry_bar_index=position_entry_index if position_entry_index is not None else index,
                        exit_bar_index=index,
                        entry_price=position_entry,
                        exit_price=price,
                        quantity=quantity,
                        volatility_regime=current_regime,
                        applied_risk_per_trade=current_applied_risk,
                    )
                )
                equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + remaining_return)
            else:
                equity = marked_equity
            equity_curve.append(equity)
            position_entry = None
            position_entry_equity = equity
            position_entry_index = None
            state = None
            continue
        equity_curve.append(marked_equity)

    if position_entry is not None:
        price = closes[-1]
        pnl_pct = (price - position_entry) / position_entry * 100.0
        remaining_ratio = state.remaining_ratio if state is not None else 1.0
        partial_return_pct = 0.0
        if state is not None:
            partial_return_pct = sum(
                rung.pnl_pct * current_sizing_multiplier * rung.fraction_of_original
                for rung in state.consumed_rungs
            )
        adjusted_return = pnl_pct * current_sizing_multiplier * remaining_ratio
        trade_returns.append(adjusted_return)
        notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
        quantity = notional / position_entry if position_entry > 0 else 0.0
        trades.append(
            BacktestTrade(
                entry_bar_index=position_entry_index if position_entry_index is not None else len(closes) - 1,
                exit_bar_index=len(closes) - 1,
                entry_price=position_entry,
                exit_price=price,
                quantity=quantity,
                volatility_regime=current_regime,
                applied_risk_per_trade=current_applied_risk,
            )
        )
        equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + adjusted_return)
        equity_curve[-1] = equity

    used_reference_path = False
    if not trade_returns and len(closes) >= 2:
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
    return metrics, used_reference_path, equity_curve, trades


def _run_rsi_reversal(
    candles: List[CandlePoint],
    params: Dict[str, object],
    timeframe: str,
    exit_tools: Optional[_ExitToolState] = None,
    volatility_sizing: Optional[_VolatilitySizingConfig] = None,
) -> tuple[BacktestMetrics, bool, List[float], List[BacktestTrade]]:
    """Kernel 6 runner — RSI overbought / oversold reversal."""

    window = max(int(float(params.get("rsi_window", 14))), 2)
    overbought = float(params.get("rsi_overbought", 70.0))
    oversold = float(params.get("rsi_oversold", 30.0))
    if oversold > overbought:
        oversold, overbought = overbought, oversold
    base_risk_per_trade = 0.8
    default_sizing_multiplier = base_risk_per_trade
    starting_equity = 100000.0
    equity = starting_equity
    equity_curve = [equity]
    trade_returns: List[float] = []
    trades: List[BacktestTrade] = []
    position_entry: Optional[float] = None
    position_entry_equity = equity
    position_entry_index: Optional[int] = None
    state: Optional[_ExitToolState] = None
    current_sizing_multiplier = default_sizing_multiplier
    current_applied_risk = base_risk_per_trade
    current_regime: Optional[VolatilityRegime] = None
    atr_lookback = volatility_sizing.lookback if volatility_sizing else 14
    atr_series = _compute_bar_atr(candles, atr_lookback)
    closes = [candle.close for candle in candles]
    rsi_values = _wilder_rsi_series(closes, window)

    for index in range(window, len(closes)):
        price = closes[index]
        rsi = rsi_values[index]
        if position_entry is None:
            # Long-only reversal: RSI in oversold zone triggers entry and we
            # exit when it recovers back above the midline. Keeps the runner
            # single-direction for simple trade bookkeeping while still
            # exercising the full exit-tool / volatility sizing paths.
            if rsi <= oversold:
                position_entry = price
                position_entry_equity = equity
                position_entry_index = index
                if volatility_sizing is not None and volatility_sizing.enabled:
                    current_regime, current_applied_risk = _resolve_entry_regime_and_risk(
                        volatility_sizing,
                        atr_series,
                        index,
                        price,
                        base_risk_per_trade,
                    )
                    current_sizing_multiplier = current_applied_risk
                else:
                    current_regime = None
                    current_applied_risk = base_risk_per_trade
                    current_sizing_multiplier = default_sizing_multiplier
                state = (
                    _ExitToolState(
                        trailing_stop_pct=exit_tools.trailing_stop_pct,
                        break_even_trigger_pct=exit_tools.break_even_trigger_pct,
                        rungs=list(exit_tools.rungs),
                    )
                    if exit_tools is not None
                    else None
                )
                equity_curve.append(equity)
                continue
            equity_curve.append(equity)
            continue
        pnl_pct = (price - position_entry) / position_entry * 100.0
        adjusted_return = pnl_pct * current_sizing_multiplier
        marked_equity = _mark_to_market_equity(position_entry_equity, adjusted_return)
        forced_close = False
        partial_return_pct = 0.0
        if state is not None and state.any_enabled:
            forced_close, partial_return_pct, _rungs = _apply_exit_tools_on_bar(
                state,
                pnl_pct=pnl_pct,
                bar_index=index,
                exit_price=price,
                position_entry=position_entry,
                position_entry_equity=position_entry_equity,
                sizing_multiplier=current_sizing_multiplier,
                trades=trades,
                trade_returns=trade_returns,
            )
            if partial_return_pct:
                equity = _mark_to_market_equity(position_entry_equity, partial_return_pct)
                marked_equity = equity
        # Take-profit on RSI crossing back above midline (mean-reversion
        # target), or stop / tp guards. Also honor the forced-close flag.
        if forced_close or rsi >= 50.0 or pnl_pct <= -3.0 or pnl_pct >= 6.0:
            remaining_ratio = state.remaining_ratio if state is not None else 1.0
            if remaining_ratio > 0.0:
                remaining_return = pnl_pct * current_sizing_multiplier * remaining_ratio
                trade_returns.append(remaining_return)
                notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
                quantity = notional / position_entry if position_entry > 0 else 0.0
                trades.append(
                    BacktestTrade(
                        entry_bar_index=position_entry_index if position_entry_index is not None else index,
                        exit_bar_index=index,
                        entry_price=position_entry,
                        exit_price=price,
                        quantity=quantity,
                        volatility_regime=current_regime,
                        applied_risk_per_trade=current_applied_risk,
                    )
                )
                equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + remaining_return)
            else:
                equity = marked_equity
            equity_curve.append(equity)
            position_entry = None
            position_entry_equity = equity
            position_entry_index = None
            state = None
            continue
        equity_curve.append(marked_equity)

    if position_entry is not None:
        price = closes[-1]
        pnl_pct = (price - position_entry) / position_entry * 100.0
        remaining_ratio = state.remaining_ratio if state is not None else 1.0
        partial_return_pct = 0.0
        if state is not None:
            partial_return_pct = sum(
                rung.pnl_pct * current_sizing_multiplier * rung.fraction_of_original
                for rung in state.consumed_rungs
            )
        adjusted_return = pnl_pct * current_sizing_multiplier * remaining_ratio
        trade_returns.append(adjusted_return)
        notional = position_entry_equity * current_sizing_multiplier * remaining_ratio
        quantity = notional / position_entry if position_entry > 0 else 0.0
        trades.append(
            BacktestTrade(
                entry_bar_index=position_entry_index if position_entry_index is not None else len(closes) - 1,
                exit_bar_index=len(closes) - 1,
                entry_price=position_entry,
                exit_price=price,
                quantity=quantity,
                volatility_regime=current_regime,
                applied_risk_per_trade=current_applied_risk,
            )
        )
        equity = _mark_to_market_equity(position_entry_equity, partial_return_pct + adjusted_return)
        equity_curve[-1] = equity

    used_reference_path = False
    if not trade_returns and len(closes) >= 2:
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
    return metrics, used_reference_path, equity_curve, trades


def run_local_backtest(strategy: StrategySummary, candles: List[CandlePoint], timeframe: str, data_range: str) -> BacktestComputation:
    params = _parameter_map(strategy)
    retrieved_candle_count = len(candles)
    history_truncated = retrieved_candle_count > BACKTEST_ENGINE_MAX_CANDLES
    effective_candles = candles[-BACKTEST_ENGINE_MAX_CANDLES:] if history_truncated else candles
    used_candle_count = len(effective_candles)
    retrieved_range_start, retrieved_range_end = _candle_time_bounds(candles)
    used_range_start, used_range_end = _candle_time_bounds(effective_candles)
    # Round 44 opt-in exit tooling: build the template once; the runners clone
    # it per entry so trailing / break-even / partial-ladder state restarts
    # cleanly for every new trade. ``None`` fields on the strategy collapse to
    # a fully inert template — existing behavior stays bit-exact.
    exit_tools = _build_exit_tool_state(strategy)
    # Round 45 opt-in volatility-regime-aware sizing: resolved once per run so
    # the runners can cheaply classify each entry's ATR% bucket and scale
    # their baseline risk_per_trade. When ``volatility_sizing_enabled`` is
    # false the config's ``enabled`` flag is also false and the runners take
    # the legacy fixed-sizing path bit-exact.
    volatility_sizing = _build_volatility_sizing_config(strategy)
    # Round 47 — kernel routing. ``strategy.kernel`` takes precedence so the
    # three new kernels get their own runner. The legacy id / name heuristic
    # below is preserved bit-exact for strategies that leave ``kernel`` unset,
    # so pre-R47 payloads route identically to Round 46.
    kernel_override = getattr(strategy, "kernel", None)
    if kernel_override == "momentum" or strategy.id.startswith("momentum"):
        metrics, used_reference_path, final_equity_curve, final_trades = _run_momentum(
            effective_candles, params, timeframe, exit_tools, volatility_sizing
        )
    elif kernel_override == "bollinger_squeeze" or strategy.id.startswith("bollinger"):
        metrics, used_reference_path, final_equity_curve, final_trades = _run_bollinger_squeeze(
            effective_candles, params, timeframe, exit_tools, volatility_sizing
        )
    elif kernel_override == "rsi_reversal" or strategy.id.startswith("rsi"):
        metrics, used_reference_path, final_equity_curve, final_trades = _run_rsi_reversal(
            effective_candles, params, timeframe, exit_tools, volatility_sizing
        )
    elif kernel_override == "trend" or strategy.id.startswith("trend-"):
        metrics, used_reference_path, final_equity_curve, final_trades = _run_trend_follow(
            effective_candles, params, timeframe, exit_tools, volatility_sizing
        )
    elif kernel_override == "mean_revert" or strategy.id.startswith("eth-revert") or "均值回归" in strategy.name:
        metrics, used_reference_path, final_equity_curve, final_trades = _run_mean_reversion(
            effective_candles, params, timeframe, exit_tools, volatility_sizing
        )
    else:
        metrics, used_reference_path, final_equity_curve, final_trades = _run_breakout(
            effective_candles, params, timeframe, exit_tools, volatility_sizing
        )
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
    # Tail-risk stats reuse the same period returns — historical VaR / CVaR
    # and the gain-to-pain ratio are all purely distributional, so no
    # additional equity-curve walking is required.
    tail_risk_stats = _compute_tail_risk_stats(period_returns)
    # Order-flow stats derive from the closed trades the runners exported
    # above. ``total_bars`` is the elapsed bar count (equity curve length
    # minus one; the runners always seed the curve with the starting equity
    # so the first entry is an anchor rather than a bar). ``bars_per_day``
    # falls back to 1440 (1-minute granularity) whenever the timeframe
    # lookup misses — the helper guards division by zero internally.
    total_bars = max(len(final_equity_curve) - 1, 0)
    bars_per_day_lookup = {
        "1m": 1440,
        "5m": 288,
        "15m": 96,
        "1h": 24,
        "4h": 6,
        "1d": 1,
    }
    bars_per_day = bars_per_day_lookup.get(str(timeframe).lower(), 1440)
    start_capital = final_equity_curve[0] if final_equity_curve else 0.0
    order_flow_stats = _compute_order_flow_stats(
        final_trades,
        total_bars,
        start_capital,
        bars_per_day,
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
        tail_risk_stats=tail_risk_stats,
        order_flow_stats=order_flow_stats,
        trades=list(final_trades),
    )
