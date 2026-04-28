from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


BacktestSampleQuality = Literal["reference_only", "low_sample", "sufficient"]
BacktestTimeframe = Literal["15m", "1h", "4h", "1d"]
BacktestHistoryGapReason = Literal["none", "sample_cap", "insufficient_history"]
BacktestHistorySource = Literal["exchange_history", "market_detail_fallback"]
BacktestHistorySourceReason = Literal["none", "exchange_fetch_failed", "insufficient_exchange_samples"]
BacktestDecisionReadiness = Literal["ready", "sample_incomplete", "research_only"]


def derive_backtest_sample_quality(reference_only: bool, trade_count: int) -> BacktestSampleQuality:
    if reference_only:
        return "reference_only"
    if trade_count < 5:
        return "low_sample"
    return "sufficient"


def normalize_backtest_timeframe(timeframe: Any) -> BacktestTimeframe:
    normalized = str(timeframe or "1h").strip().lower()
    mapping = {
        "15": "15m",
        "15m": "15m",
        "60": "1h",
        "1h": "1h",
        "240": "4h",
        "4h": "4h",
        "d": "1d",
        "1d": "1d",
    }
    resolved = mapping.get(normalized)
    if resolved is None:
        raise ValueError("回测周期仅支持 15m / 1h / 4h / 1d。")
    return resolved


class PriorityLevel(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class ChangeRequestStatus(str, Enum):
    DRAFT = "draft"
    QUEUED = "queued"
    RUNNING = "running"
    APPLIED = "applied"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    WAITING = "waiting"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SchedulerCommandType(str, Enum):
    PAUSE = "pause"
    RESUME = "resume"
    CANCEL_JOB = "cancel_job"
    CANCEL_ALL = "cancel_all"
    FREEZE_PUBLISH = "freeze_publish"
    ENTER_MANUAL_OVERRIDE = "enter_manual_override"


class EventSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class Direction(str, Enum):
    BUY = "buy"
    SELL = "sell"


class AccountMode(str, Enum):
    PAPER = "paper"
    DEMO = "demo"
    LIVE = "live"


# Round 103 — the complement of :attr:`AccountMode.PAPER` within the enum.
# Captures the "real-market-connection" set used by every gate that wants to
# distinguish simulated paper state from modes that actually submit orders to
# Bybit (``DEMO`` hits Bybit demo account; ``LIVE`` hits production).  Before
# R103 this was inlined as ``{AccountMode.DEMO, AccountMode.LIVE}`` /
# ``{AccountMode.LIVE, AccountMode.DEMO}`` across 11 callsites in
# ``main.py`` and ``alert_and_guard_sync.py``; a single constant makes any
# future mode extension surface as a single audit point.
NON_PAPER_ACCOUNT_MODES: frozenset = frozenset({AccountMode.DEMO, AccountMode.LIVE})


class MetricCard(BaseModel):
    label: str
    value: str
    delta: Optional[str] = None
    tone: Literal["neutral", "positive", "warning", "critical"] = "neutral"


class SchedulerState(BaseModel):
    status: Literal["running", "paused", "manual_override", "degraded"] = "running"
    freeze_publish: bool = False
    current_job_id: Optional[str] = None
    queue_depth: int = 0
    last_heartbeat_at: str
    openclaw_connected: bool = False
    current_mode: AccountMode = AccountMode.PAPER


class TaskSummary(BaseModel):
    id: str
    title: str
    type: str
    status: JobStatus
    owner: str
    updated_at: str


class ExecutionHealthSummary(BaseModel):
    runtime_worker_running: bool = False
    runtime_worker_issue: bool = False
    runtime_worker_stale: bool = False
    runtime_worker_stopped: bool = False
    runtime_stale_seconds: int = 0
    runtime_last_refresh_at: Optional[str] = None
    runtime_last_error: Optional[str] = None
    public_execution_channel_issue: bool = False
    public_execution_stale: bool = False
    public_execution_stale_seconds: int = 0
    private_execution_channel_issue: bool = False
    private_execution_stale: bool = False
    private_execution_stale_seconds: int = 0
    active_stop_loss_guards: int = 0
    cooldowns: int = 0
    auto_dispatch_blocked: int = 0
    rejection_guards: int = 0
    stale_order_guards: int = 0
    drifts: int = 0
    top_issue: Optional[str] = None
    top_issue_strategy_id: Optional[str] = None
    top_issue_strategy_name: Optional[str] = None
    top_issue_symbol: Optional[str] = None
    top_issue_detail: Optional[str] = None
    top_issue_recommended_action: Optional[str] = None


class LatestSchedulerCommand(BaseModel):
    command: Optional[SchedulerCommandType] = None
    summary: str
    impact_detail: Optional[str] = None
    job_id: Optional[str] = None
    strategy_id: Optional[str] = None
    linked_review_id: Optional[str] = None
    backtest_id: Optional[str] = None
    source_change_request_id: Optional[str] = None
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    occurred_at: str
    severity: EventSeverity = EventSeverity.INFO


class ControlSnapshot(BaseModel):
    account_metrics: List[MetricCard]
    risk_metrics: List[MetricCard]
    strategy_metrics: List[MetricCard]
    scheduler: SchedulerState
    alerts_summary: Dict[str, int]
    pending_tasks: List[TaskSummary]
    today_performance: Dict[str, str]
    execution_health: ExecutionHealthSummary = Field(default_factory=ExecutionHealthSummary)
    latest_scheduler_command: Optional[LatestSchedulerCommand] = None


class WatchlistInstrument(BaseModel):
    symbol: str
    market: Literal["spot", "perp"]
    last_price: float
    change_24h: float
    volume_24h: float
    signal: Literal["neutral", "watch", "active"]
    position_side: Literal["flat", "long", "short"]
    risk_level: Literal["low", "medium", "high"]
    alert_enabled: bool = True
    alert_threshold_pct: float = 2.5


class WatchlistCreatePayload(BaseModel):
    symbol: str
    market: Literal["spot", "perp"] = "perp"
    requested_by: str = "desktop_operator"


class WatchlistRemoveResult(BaseModel):
    symbol: str
    removed: bool
    updated_at: str
    next_selected_symbol: Optional[str] = None


class CandlePoint(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class OrderBookLevel(BaseModel):
    price: float
    size: float
    total: float


class MarketRecentTrade(BaseModel):
    side: Literal["buy", "sell"]
    price: float
    size: float
    value: float
    occurred_at: str
    is_block_trade: bool = False


class MarketDetail(BaseModel):
    symbol: str
    market: Literal["spot", "perp"]
    timeframe: str
    candles: List[CandlePoint]
    bids: List[OrderBookLevel]
    asks: List[OrderBookLevel]
    recent_public_trades: List[MarketRecentTrade] = Field(default_factory=list)
    headline: str
    stats: Dict[str, str]
    source: Literal["mock", "fallback", "bybit_rest", "bybit_ws"] = "fallback"
    updated_at: Optional[str] = None


class MarketLiveSnapshot(BaseModel):
    selected_symbol: str
    watchlist: List[WatchlistInstrument]
    detail: MarketDetail
    watchlist_details: List[MarketDetail] = Field(default_factory=list)
    diagnostics: "MarketLiveDiagnostics"
    generated_at: str


class MarketLiveDiagnostics(BaseModel):
    requested_symbol: str
    effective_symbol: str
    timeframe: str
    selection_corrected: bool = False
    detail_source: Literal["mock", "fallback", "bybit_rest", "bybit_ws"] = "fallback"
    detail_candle_count: int = 0
    watchlist_symbol_count: int = 0
    watchlist_real_detail_count: int = 0
    watchlist_fallback_detail_count: int = 0
    watchlist_source_breakdown: Dict[str, int] = Field(default_factory=dict)
    generated_in_ms: int = 0


class OpsLiveSummary(BaseModel):
    pending_alerts: int
    p0_alerts: int
    recent_trades: int
    manual_trades: int
    strategy_trades: int
    audit_warnings: int
    audit_critical: int
    execution_issue_total: int = 0
    execution_top_issue: Optional[str] = None
    execution_top_issue_strategy_id: Optional[str] = None
    execution_top_issue_strategy_name: Optional[str] = None
    execution_top_issue_symbol: Optional[str] = None
    execution_top_issue_detail: Optional[str] = None
    latest_event_type: Optional[str] = None


class OpsLiveSnapshot(BaseModel):
    summary: OpsLiveSummary
    alerts: List["AlertRecord"]
    trades: List["TradeRecord"]
    audit_events: List["ExecutionEvent"]
    latest_scheduler_command: Optional[LatestSchedulerCommand] = None
    generated_at: str


class StrategyParameter(BaseModel):
    key: str
    label: str
    value: Union[float, int, str, bool]
    unit: Optional[str] = None


class PartialTakeProfit(BaseModel):
    """Single rung of a scaled take-profit ladder.

    ``trigger_pct`` is the unrealized pnl (percentage points, e.g. ``1.0`` ==
    1%) that must be reached before the rung activates. ``exit_ratio`` is the
    fraction of the *original* position size that should be liquidated on the
    triggering bar (``0.5`` == half the original exposure). Engines must
    enforce the cumulative sum of ``exit_ratio`` never exceeding ``1.0``.
    """

    trigger_pct: float
    exit_ratio: float


class VolatilityRegimeThresholds(BaseModel):
    """Round 45 opt-in ATR%-based regime classifier thresholds.

    ``low_pct`` and ``high_pct`` are expressed as ATR-as-percent-of-price
    values (e.g. ``0.5`` == ``0.5%``). A bar whose ATR/price ratio lies strictly
    below ``low_pct`` is classified as ``low`` volatility, strictly above
    ``high_pct`` as ``high`` volatility, and everything in between (inclusive
    of both boundaries) as ``normal``. ``low_pct`` must be less than or equal
    to ``high_pct``; when they coincide the ``normal`` band collapses to a
    single point which is acceptable for the classifier.
    """

    low_pct: float
    high_pct: float


class RegimeExposureMultipliers(BaseModel):
    """Round 45 opt-in per-regime multipliers applied to ``risk_per_trade``.

    When ``volatility_sizing_enabled`` is true each runner consults the
    classifier below and scales its baseline risk budget by the matching
    multiplier. Defaults favour slightly more exposure in calm markets and
    trim exposure when ATR expands — consistent with classic volatility
    targeting playbooks — but callers may override any of the three slots to
    fit strategy-specific risk appetites. The multipliers are always non-
    negative; a runner that receives ``0`` simply trades with zero sizing for
    that regime (a hard block without breaking the data contract).
    """

    low: float = 1.2
    normal: float = 1.0
    high: float = 0.6


class ConfidenceRegimeAdjustments(BaseModel):
    """Round 46 opt-in per-regime multipliers applied to signal confidence.

    When ``confidence_calibration_enabled`` is true, the runtime pipeline
    multiplies the raw kernel confidence by the matching regime multiplier
    before clamping. Defaults mildly boost confidence when ATR is calm and
    penalise it when ATR is elevated — a hedge against over-trusting signal
    fidelity during hectic regimes. Operators can override any of the three
    slots without breaking the ``confidence_calibration_enabled`` contract;
    the numbers are always non-negative so a misconfigured multiplier cannot
    flip the sign of the calibrated confidence.
    """

    low: float = 1.1
    normal: float = 1.0
    high: float = 0.75


class StrategySummary(BaseModel):
    id: str
    name: str
    category: Literal["template", "python"]
    status: Literal["running", "paused", "paper_only", "shadow"]
    symbols: List[str]
    mode: AccountMode
    version: str
    pnl_7d: str
    max_drawdown: str
    risk_budget: str
    description: str
    parameters: List[StrategyParameter]
    # Round 44 additive exit tooling. All three fields are ``None`` by default
    # so existing strategy payloads keep their current single-stop / single-
    # take-profit behavior; opt-in happens purely by populating these fields.
    trailing_stop_pct: Optional[float] = None
    break_even_trigger_pct: Optional[float] = None
    partial_take_profits: Optional[List[PartialTakeProfit]] = None
    # Round 45 additive volatility-regime-aware position sizing. All five
    # fields default to ``None`` / ``False`` so existing payloads continue to
    # use the legacy fixed ``risk_per_trade`` constants; opt-in happens purely
    # by flipping ``volatility_sizing_enabled`` and optionally overriding the
    # classifier thresholds / per-regime multipliers.
    volatility_sizing_enabled: bool = False
    volatility_lookback: Optional[int] = 14
    volatility_target_pct: Optional[float] = None
    volatility_regime_thresholds: Optional[VolatilityRegimeThresholds] = None
    regime_exposure_multipliers: Optional[RegimeExposureMultipliers] = None
    # Round 46 additive signal-confidence calibration. All four fields default
    # to ``None`` / ``False`` / ``0.0`` so legacy strategies keep producing
    # bit-exact confidences. Opt-in happens by flipping
    # ``confidence_calibration_enabled`` and optionally tuning the regime
    # multipliers / drift penalty / multi-timeframe alignment toggle.
    confidence_calibration_enabled: bool = False
    confidence_regime_adjustments: Optional[ConfidenceRegimeAdjustments] = None
    confidence_parameter_drift_penalty: Optional[float] = 0.0
    confidence_multi_timeframe_alignment: Optional[bool] = False
    # Round 47 additive kernel selector + three new kernel parameter groups.
    # ``kernel`` is an opt-in override for the routing logic — when unset the
    # legacy ``strategy.id`` / ``strategy.name`` heuristic picks the kernel so
    # historical payloads keep their current behavior. New values route the
    # strategy to the momentum / bollinger-squeeze / RSI-reversal kernels. All
    # downstream parameter fields default to ``None`` so unsetting them is
    # exactly equivalent to pre-R47 behavior — the runners / evaluators fall
    # back to their built-in defaults.
    kernel: Optional[
        Literal[
            "trend",
            "mean_revert",
            "breakout",
            "momentum",
            "bollinger_squeeze",
            "rsi_reversal",
        ]
    ] = None
    # Momentum kernel parameters (ROC-over-window + EMA confirmation).
    roc_window: Optional[int] = None
    ema_trend_window: Optional[int] = None
    momentum_threshold_pct: Optional[float] = None
    # Bollinger squeeze kernel parameters.
    bollinger_window: Optional[int] = None
    bollinger_std: Optional[float] = None
    squeeze_bandwidth_pct: Optional[float] = None
    # RSI reversal kernel parameters.
    rsi_window: Optional[int] = None
    rsi_overbought: Optional[float] = None
    rsi_oversold: Optional[float] = None


class StrategyRuntimeSnapshot(BaseModel):
    strategy_id: str
    strategy_name: str
    symbol: str
    market: Literal["spot", "perp"]
    mode: AccountMode
    runtime_status: Literal["running", "paused", "paper_only", "shadow"]
    signal: Literal["long", "short", "flat", "watch"]
    confidence: float = 0.0
    last_price: float
    reference_price: float
    change_24h: float
    note: str
    next_action: str
    guard_state: Literal["none", "live_stop_loss", "cooldown", "auto_dispatch_blocked"] = "none"
    guard_detail: Optional[str] = None
    active_order_count: int = 0
    active_order: Optional["OrderRecord"] = None
    current_position_side: Literal["flat", "long", "short"] = "flat"
    current_position_size: Optional[str] = None
    current_position_avg_price: Optional[str] = None
    target_position_side: Literal["flat", "long", "short"] = "flat"
    target_position_size: Optional[str] = None
    position_alignment: Literal["aligned", "reconciling", "drifted", "unknown"] = "unknown"
    position_alignment_detail: Optional[str] = None
    last_execution_event_type: Optional[str] = None
    last_execution_at: Optional[str] = None
    last_execution_severity: Optional[EventSeverity] = None
    last_execution_detail: Optional[str] = None
    last_evaluated_at: str
    last_trade_id: Optional[str] = None
    last_trade_at: Optional[str] = None
    execution_preview: Optional[ExecutionPreview] = None


class StrategyLiveSnapshot(BaseModel):
    items: List[StrategyRuntimeSnapshot]
    generated_at: str


class StrategyActivityLatestOpsSnapshot(BaseModel):
    latest_active_order: Optional[str] = None
    latest_historical_order: Optional[str] = None
    latest_order: Optional[str] = None
    latest_pending_alert: Optional[str] = None
    latest_trade: Optional[str] = None
    latest_alert: Optional[str] = None
    latest_audit_event: Optional[str] = None
    latest_active_order_record: Optional["OrderRecord"] = None
    latest_historical_order_record: Optional["OrderRecord"] = None
    latest_order_record: Optional["OrderRecord"] = None
    latest_pending_alert_record: Optional["AlertRecord"] = None
    latest_trade_record: Optional["TradeRecord"] = None
    latest_alert_record: Optional["AlertRecord"] = None
    latest_audit_event_record: Optional["ExecutionEvent"] = None


class StrategyActivityLatestRuntimeSnapshot(BaseModel):
    runtime: Optional["StrategyRuntimeSnapshot"] = None
    latest_ops: Optional[StrategyActivityLatestOpsSnapshot] = None


class StrategyActivityProposalDecisionContext(BaseModel):
    latest_backtest_record: Optional["BacktestRun"] = None
    latest_review_record: Optional["ReviewDocument"] = None
    latest_job_record: Optional["AgentJob"] = None
    actionable_backtest_record: Optional["BacktestRun"] = None
    actionable_review_record: Optional["ReviewDocument"] = None
    actionable_job_record: Optional["AgentJob"] = None


class StrategyActivityChangeRequestDecisionContext(BaseModel):
    latest_backtest_record: Optional["BacktestRun"] = None
    latest_review_record: Optional["ReviewDocument"] = None
    latest_job_record: Optional["AgentJob"] = None
    latest_source_backtest_record: Optional["BacktestRun"] = None
    latest_source_review_record: Optional["ReviewDocument"] = None
    latest_source_proposal_record: Optional["StrategyProposal"] = None
    actionable_backtest_record: Optional["BacktestRun"] = None
    actionable_review_record: Optional["ReviewDocument"] = None
    actionable_job_record: Optional["AgentJob"] = None
    actionable_source_backtest_record: Optional["BacktestRun"] = None
    actionable_source_review_record: Optional["ReviewDocument"] = None
    actionable_source_proposal_record: Optional["StrategyProposal"] = None


class StrategyActivityBacktestDecisionContext(BaseModel):
    latest_record: Optional["BacktestRun"] = None
    actionable_record: Optional["BacktestRun"] = None
    latest_review_record: Optional["ReviewDocument"] = None
    latest_job_record: Optional["AgentJob"] = None
    actionable_review_record: Optional["ReviewDocument"] = None
    actionable_job_record: Optional["AgentJob"] = None


class StrategyActivityReviewDecisionContext(BaseModel):
    latest_primary_record: Optional["ReviewDocument"] = None
    latest_actionable_primary_record: Optional["ReviewDocument"] = None


class StrategyActivityTrackingDecisionContext(BaseModel):
    latest_review_record: Optional["ReviewDocument"] = None
    latest_job_record: Optional["AgentJob"] = None
    latest_retryable_job_record: Optional["AgentJob"] = None


class StrategyActivityDecisionContext(BaseModel):
    proposal: Optional[StrategyActivityProposalDecisionContext] = None
    change_request: Optional[StrategyActivityChangeRequestDecisionContext] = None
    backtest: Optional[StrategyActivityBacktestDecisionContext] = None
    review: Optional[StrategyActivityReviewDecisionContext] = None
    tracking: Optional[StrategyActivityTrackingDecisionContext] = None


class StrategyActivityProposalSection(BaseModel):
    latest: Optional["StrategyProposal"] = None
    latest_actionable: Optional["StrategyProposal"] = None
    latest_change_request: Optional["ChangeRequest"] = None
    latest_backtest: Optional["StrategyActivityBacktestSummary"] = None
    latest_review: Optional["StrategyActivityReviewSummary"] = None
    latest_job: Optional["StrategyActivityJobSummary"] = None
    latest_backtest_record: Optional["BacktestRun"] = None
    latest_review_record: Optional["ReviewDocument"] = None
    latest_job_record: Optional["AgentJob"] = None
    latest_actionable_change_request: Optional["ChangeRequest"] = None
    latest_actionable_backtest: Optional["StrategyActivityBacktestSummary"] = None
    latest_actionable_review: Optional["StrategyActivityReviewSummary"] = None
    latest_actionable_job: Optional["StrategyActivityJobSummary"] = None
    latest_actionable_backtest_record: Optional["BacktestRun"] = None
    latest_actionable_review_record: Optional["ReviewDocument"] = None
    latest_actionable_job_record: Optional["AgentJob"] = None


class StrategyActivityChangeRequestSection(BaseModel):
    latest: Optional["ChangeRequest"] = None
    latest_actionable: Optional["ChangeRequest"] = None
    latest_backtest_record: Optional["BacktestRun"] = None
    latest_review_record: Optional["ReviewDocument"] = None
    latest_job_record: Optional["AgentJob"] = None
    latest_source_backtest_record: Optional["BacktestRun"] = None
    latest_source_review_record: Optional["ReviewDocument"] = None
    latest_source_proposal_record: Optional["StrategyProposal"] = None
    latest_actionable_backtest_record: Optional["BacktestRun"] = None
    latest_actionable_review_record: Optional["ReviewDocument"] = None
    latest_actionable_job_record: Optional["AgentJob"] = None
    latest_actionable_source_backtest_record: Optional["BacktestRun"] = None
    latest_actionable_source_review_record: Optional["ReviewDocument"] = None
    latest_actionable_source_proposal_record: Optional["StrategyProposal"] = None


class StrategyActivityBacktestSection(BaseModel):
    latest: Optional["StrategyActivityBacktestSummary"] = None
    latest_actionable: Optional["StrategyActivityBacktestSummary"] = None
    latest_record: Optional["BacktestRun"] = None
    latest_actionable_record: Optional["BacktestRun"] = None
    latest_review: Optional["StrategyActivityReviewSummary"] = None
    latest_job: Optional["StrategyActivityJobSummary"] = None
    latest_actionable_review: Optional["StrategyActivityReviewSummary"] = None
    latest_actionable_job: Optional["StrategyActivityJobSummary"] = None
    latest_review_record: Optional["ReviewDocument"] = None
    latest_job_record: Optional["AgentJob"] = None
    latest_actionable_review_record: Optional["ReviewDocument"] = None
    latest_actionable_job_record: Optional["AgentJob"] = None


class StrategyActivityReviewSection(BaseModel):
    latest_primary: Optional["StrategyActivityReviewSummary"] = None
    latest_actionable_primary: Optional["StrategyActivityReviewSummary"] = None
    latest_tracking: Optional["StrategyActivityReviewSummary"] = None
    latest_primary_record: Optional["ReviewDocument"] = None
    latest_actionable_primary_record: Optional["ReviewDocument"] = None
    latest_tracking_record: Optional["ReviewDocument"] = None


class StrategyActivityTrackingSection(BaseModel):
    latest_review: Optional["StrategyActivityReviewSummary"] = None
    latest_job: Optional["StrategyActivityJobSummary"] = None
    latest_retryable_job: Optional["StrategyActivityJobSummary"] = None
    latest_review_record: Optional["ReviewDocument"] = None
    latest_job_record: Optional["AgentJob"] = None
    latest_retryable_job_record: Optional["AgentJob"] = None


class StrategyActivitySections(BaseModel):
    proposal: Optional[StrategyActivityProposalSection] = None
    change_request: Optional[StrategyActivityChangeRequestSection] = None
    backtest: Optional[StrategyActivityBacktestSection] = None
    review: Optional[StrategyActivityReviewSection] = None
    tracking: Optional[StrategyActivityTrackingSection] = None


class StrategyActivitySnapshotCore(BaseModel):
    strategy_id: str
    strategy_name: str
    symbol: str
    market: Literal["spot", "perp"]
    mode: AccountMode
    runtime: Optional[StrategyRuntimeSnapshot] = None
    latest_runtime: Optional[StrategyActivityLatestRuntimeSnapshot] = None
    latest_ops: Optional[StrategyActivityLatestOpsSnapshot] = None
    decision_context: Optional[StrategyActivityDecisionContext] = None
    activity_sections: Optional[StrategyActivitySections] = None


class StrategyActivitySnapshotBacktestReviewFlatFields(BaseModel):
    latest_backtest: Optional["StrategyActivityBacktestSummary"] = None
    latest_actionable_backtest: Optional["StrategyActivityBacktestSummary"] = None
    latest_backtest_record: Optional["BacktestRun"] = None
    latest_actionable_backtest_record: Optional["BacktestRun"] = None
    latest_backtest_review: Optional["StrategyActivityReviewSummary"] = None
    latest_backtest_job: Optional["StrategyActivityJobSummary"] = None
    latest_actionable_backtest_review: Optional["StrategyActivityReviewSummary"] = None
    latest_actionable_backtest_job: Optional["StrategyActivityJobSummary"] = None
    latest_backtest_review_record: Optional["ReviewDocument"] = None
    latest_backtest_job_record: Optional["AgentJob"] = None
    latest_actionable_backtest_review_record: Optional["ReviewDocument"] = None
    latest_actionable_backtest_job_record: Optional["AgentJob"] = None
    latest_primary_review: Optional["StrategyActivityReviewSummary"] = None
    latest_actionable_primary_review: Optional["StrategyActivityReviewSummary"] = None
    latest_primary_review_record: Optional["ReviewDocument"] = None
    latest_actionable_primary_review_record: Optional["ReviewDocument"] = None
    latest_tracking_review: Optional["StrategyActivityReviewSummary"] = None
    latest_tracking_job: Optional["StrategyActivityJobSummary"] = None
    latest_tracking_review_record: Optional["ReviewDocument"] = None
    latest_tracking_job_record: Optional["AgentJob"] = None
    latest_retryable_tracking_job: Optional["StrategyActivityJobSummary"] = None
    latest_retryable_tracking_job_record: Optional["AgentJob"] = None


class StrategyActivitySnapshotProposalFlatFields(BaseModel):
    latest_proposal: Optional["StrategyProposal"] = None
    latest_actionable_proposal: Optional["StrategyProposal"] = None
    latest_proposal_change_request: Optional["ChangeRequest"] = None
    latest_proposal_backtest: Optional["StrategyActivityBacktestSummary"] = None
    latest_proposal_review: Optional["StrategyActivityReviewSummary"] = None
    latest_proposal_job: Optional["StrategyActivityJobSummary"] = None
    latest_proposal_backtest_record: Optional["BacktestRun"] = None
    latest_proposal_review_record: Optional["ReviewDocument"] = None
    latest_proposal_job_record: Optional["AgentJob"] = None
    latest_actionable_proposal_change_request: Optional["ChangeRequest"] = None
    latest_actionable_proposal_backtest: Optional["StrategyActivityBacktestSummary"] = None
    latest_actionable_proposal_review: Optional["StrategyActivityReviewSummary"] = None
    latest_actionable_proposal_job: Optional["StrategyActivityJobSummary"] = None
    latest_actionable_proposal_backtest_record: Optional["BacktestRun"] = None
    latest_actionable_proposal_review_record: Optional["ReviewDocument"] = None
    latest_actionable_proposal_job_record: Optional["AgentJob"] = None


class StrategyActivitySnapshotChangeRequestFlatFields(BaseModel):
    latest_change_request: Optional["ChangeRequest"] = None
    latest_actionable_change_request: Optional["ChangeRequest"] = None
    latest_change_request_backtest_record: Optional["BacktestRun"] = None
    latest_change_request_review_record: Optional["ReviewDocument"] = None
    latest_change_request_job_record: Optional["AgentJob"] = None
    latest_change_request_source_backtest_record: Optional["BacktestRun"] = None
    latest_change_request_source_review_record: Optional["ReviewDocument"] = None
    latest_change_request_source_proposal_record: Optional["StrategyProposal"] = None
    latest_actionable_change_request_backtest_record: Optional["BacktestRun"] = None
    latest_actionable_change_request_review_record: Optional["ReviewDocument"] = None
    latest_actionable_change_request_job_record: Optional["AgentJob"] = None
    latest_actionable_change_request_source_backtest_record: Optional["BacktestRun"] = None
    latest_actionable_change_request_source_review_record: Optional["ReviewDocument"] = None
    latest_actionable_change_request_source_proposal_record: Optional["StrategyProposal"] = None


class StrategyActivitySnapshotLineageFields(
    StrategyActivitySnapshotBacktestReviewFlatFields,
    StrategyActivitySnapshotProposalFlatFields,
    StrategyActivitySnapshotChangeRequestFlatFields,
):
    pass


class StrategyActivitySnapshotRecentCollections(BaseModel):
    recent_proposals: List["StrategyProposal"] = Field(default_factory=list)
    recent_change_requests: List["ChangeRequest"] = Field(default_factory=list)
    recent_backtests: List["StrategyActivityBacktestSummary"] = Field(default_factory=list)
    recent_reviews: List["StrategyActivityReviewSummary"] = Field(default_factory=list)
    active_orders: List["OrderRecord"] = Field(default_factory=list)
    recent_orders: List["OrderRecord"] = Field(default_factory=list)
    recent_trades: List["TradeRecord"] = Field(default_factory=list)
    recent_alerts: List["AlertRecord"] = Field(default_factory=list)
    recent_audit_events: List["ExecutionEvent"] = Field(default_factory=list)
    recent_agent_jobs: List["StrategyActivityJobSummary"] = Field(default_factory=list)


class StrategyActivitySnapshot(
    StrategyActivitySnapshotCore,
    StrategyActivitySnapshotLineageFields,
    StrategyActivitySnapshotRecentCollections,
):
    generated_at: str


class StrategyActivityReviewSummary(BaseModel):
    id: str
    period: str
    backtest_id: Optional[str] = None
    source_job_id: Optional[str] = None
    source_job_type: Optional[str] = None
    source_job_status: Optional[str] = None
    source_change_request_id: Optional[str] = None
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    trigger_reason: Optional[str] = None
    title: str
    summary: str
    proposal_count: int = 0
    created_at: str


class StrategyActivityBacktestSummary(BaseModel):
    id: str
    status: str
    timeframe: BacktestTimeframe
    data_range: str
    sample_quality: BacktestSampleQuality
    history_source: BacktestHistorySource
    decision_readiness: BacktestDecisionReadiness
    source_change_request_id: Optional[str] = None
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    trigger_reason: Optional[str] = None
    created_at: str
    finished_at: Optional[str] = None


class StrategyActivityJobSummary(BaseModel):
    id: str
    job_type: str
    status: JobStatus
    strategy_id: Optional[str] = None
    backtest_id: Optional[str] = None
    source_change_request_id: Optional[str] = None
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    requested_by: Optional[str] = None
    result_summary: Optional[str] = None
    linked_review_id: Optional[str] = None
    linked_review_title: Optional[str] = None
    linked_review_period: Optional[str] = None
    writeback_target: str
    created_at: str
    updated_at: str
    retry_count: int = 0
    retried_from_job_id: Optional[str] = None


class StrategyExecutionRequest(BaseModel):
    requested_by: str = "desktop_operator"
    note: Optional[str] = None
    mode: Optional[AccountMode] = None


class BacktestMetrics(BaseModel):
    annual_return: str
    max_drawdown: str
    sharpe: str
    win_rate: str
    pnl: str
    trades: int


class BacktestVolatilityStatsModel(BaseModel):
    return_volatility_pct: float = 0.0
    annualized_volatility_pct: float = 0.0
    max_drawdown_duration_bars: int = 0
    max_run_up_pct: float = 0.0
    positive_bar_ratio_pct: float = 0.0


class BacktestRiskRatiosModel(BaseModel):
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    profit_factor: float = 0.0
    expectancy_pct: float = 0.0
    worst_bar_return_pct: float = 0.0
    best_bar_return_pct: float = 0.0


class BacktestTradeRhythmStatsModel(BaseModel):
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


class BacktestBenchmarkStatsModel(BaseModel):
    buy_hold_return_pct: float = 0.0
    buy_hold_max_drawdown_pct: float = 0.0
    strategy_over_buy_hold_pct: float = 0.0
    alpha_pct: float = 0.0
    correlation: float = 0.0
    tracking_error_pct: float = 0.0


class BacktestExposureStatsModel(BaseModel):
    return_skew: float = 0.0
    return_kurtosis: float = 0.0
    ulcer_index_pct: float = 0.0
    recovery_factor: float = 0.0
    downside_deviation_pct: float = 0.0


class BacktestTailRiskStatsModel(BaseModel):
    var_95_pct: float = 0.0
    cvar_95_pct: float = 0.0
    tail_ratio: float = 0.0
    gain_to_pain_ratio: float = 0.0


class BacktestOrderFlowStatsModel(BaseModel):
    avg_holding_bars: float = 0.0
    trade_frequency_per_day: float = 0.0
    turnover_rate_pct: float = 0.0
    active_bar_ratio_pct: float = 0.0
    avg_trade_notional: float = 0.0


# Round 49 — Pydantic counterpart of the internal ``BacktestTrade`` dataclass
# in ``backtest_engine``. Kept lean so newly completed runs can surface the
# trade list to the frontend without pulling the dataclass into the API
# boundary. Volatility regime / applied risk metadata are opt-in (Round 45).
class BacktestTradeModel(BaseModel):
    entry_bar_index: int
    exit_bar_index: int
    entry_price: float
    exit_price: float
    quantity: float
    side: str = "long"
    volatility_regime: Optional[str] = None
    applied_risk_per_trade: Optional[float] = None


# Cap the number of trades serialized on a single BacktestRun response. Keeps
# the API payload bounded even when a long-horizon backtest produces thousands
# of closed positions. The cap is inclusive — the first N trades (chronological
# order as emitted by the runner) are preserved.
BACKTEST_RUN_TRADE_SERIALIZATION_CAP = 500


class BacktestRun(BaseModel):
    id: str
    strategy_id: str
    strategy_name: str
    source_change_request_id: Optional[str] = None
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    trigger_reason: Optional[str] = None
    status: Literal["queued", "running", "completed", "failed"]
    started_at: str
    finished_at: Optional[str] = None
    symbol_scope: List[str]
    timeframe: BacktestTimeframe
    data_range: str
    data_granularity: str
    fee_model: str
    slippage_model: str
    parameter_snapshot: Dict[str, Any]
    metrics: BacktestMetrics
    reference_only: bool = False
    sample_quality: BacktestSampleQuality = "sufficient"
    history_source: BacktestHistorySource = "exchange_history"
    history_source_reason: BacktestHistorySourceReason = "none"
    history_source_detail: Optional[str] = None
    history_source_recommended_data_range: Optional[str] = None
    history_source_recommended_timeframe: Optional[BacktestTimeframe] = None
    history_source_recommended_action: Optional[str] = None
    decision_readiness: BacktestDecisionReadiness = "ready"
    decision_readiness_detail: str = ""
    decision_recommended_data_range: Optional[str] = None
    decision_recommended_timeframe: Optional[BacktestTimeframe] = None
    decision_readiness_action: Optional[str] = None
    requested_candle_estimate: int = 0
    requested_candle_limit: int = 0
    requested_range_start: Optional[str] = None
    requested_range_end: Optional[str] = None
    retrieved_window_completion_pct: float = 0.0
    used_window_completion_pct: float = 0.0
    retrieved_candle_count: int = 0
    used_candle_count: int = 0
    retrieved_range_start: Optional[str] = None
    retrieved_range_end: Optional[str] = None
    used_range_start: Optional[str] = None
    used_range_end: Optional[str] = None
    history_truncated: bool = False
    history_gap_reason: BacktestHistoryGapReason = "none"
    full_window_recommended_data_range: Optional[str] = None
    full_window_recommended_timeframe: Optional[BacktestTimeframe] = None
    full_window_recommended_action: Optional[str] = None
    notes: str
    volatility_stats: Optional[BacktestVolatilityStatsModel] = None
    risk_ratios: Optional[BacktestRiskRatiosModel] = None
    trade_rhythm_stats: Optional[BacktestTradeRhythmStatsModel] = None
    benchmark_stats: Optional[BacktestBenchmarkStatsModel] = None
    exposure_stats: Optional[BacktestExposureStatsModel] = None
    tail_risk_stats: Optional[BacktestTailRiskStatsModel] = None
    order_flow_stats: Optional[BacktestOrderFlowStatsModel] = None
    # Round 49 — closed-trade surface for completed runs. Legacy persisted runs
    # have no trade list so the field stays Optional / None; populated only by
    # newly executed backtests (capped by BACKTEST_RUN_TRADE_SERIALIZATION_CAP).
    trades: Optional[List[BacktestTradeModel]] = None


class ChangeRequest(BaseModel):
    id: str
    type: str
    payload: Dict[str, Any]
    requested_by: str
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    trigger_reason: Optional[str] = None
    manual_followup_required: bool = False
    manual_followup_detail: Optional[str] = None
    target_mode: AccountMode
    priority: PriorityLevel
    status: ChangeRequestStatus
    correlation_id: str
    linked_backtest_id: Optional[str] = None
    linked_backtest_timeframe: Optional[BacktestTimeframe] = None
    linked_backtest_data_range: Optional[str] = None
    linked_backtest_sample_quality: Optional[BacktestSampleQuality] = None
    linked_backtest_decision_readiness: Optional[BacktestDecisionReadiness] = None
    linked_backtest_decision_readiness_detail: Optional[str] = None
    linked_backtest_decision_recommended_data_range: Optional[str] = None
    linked_backtest_decision_recommended_timeframe: Optional[BacktestTimeframe] = None
    linked_backtest_decision_readiness_action: Optional[str] = None
    linked_backtest_history_source: Optional[BacktestHistorySource] = None
    linked_backtest_history_source_reason: Optional[BacktestHistorySourceReason] = None
    linked_backtest_history_source_detail: Optional[str] = None
    linked_backtest_history_source_recommended_data_range: Optional[str] = None
    linked_backtest_history_source_recommended_timeframe: Optional[BacktestTimeframe] = None
    linked_backtest_history_source_recommended_action: Optional[str] = None
    linked_backtest_requested_candle_estimate: int = 0
    linked_backtest_requested_candle_limit: int = 0
    linked_backtest_requested_range_start: Optional[str] = None
    linked_backtest_requested_range_end: Optional[str] = None
    linked_backtest_retrieved_window_completion_pct: float = 0.0
    linked_backtest_used_window_completion_pct: float = 0.0
    linked_backtest_retrieved_candle_count: int = 0
    linked_backtest_used_candle_count: int = 0
    linked_backtest_retrieved_range_start: Optional[str] = None
    linked_backtest_retrieved_range_end: Optional[str] = None
    linked_backtest_used_range_start: Optional[str] = None
    linked_backtest_used_range_end: Optional[str] = None
    linked_backtest_history_truncated: Optional[bool] = None
    linked_backtest_history_gap_reason: Optional[BacktestHistoryGapReason] = None
    linked_backtest_full_window_recommended_data_range: Optional[str] = None
    linked_backtest_full_window_recommended_timeframe: Optional[BacktestTimeframe] = None
    linked_backtest_full_window_recommended_action: Optional[str] = None
    follow_up_job_id: Optional[str] = None
    follow_up_job_type: Optional[str] = None
    follow_up_job_status: Optional[JobStatus] = None
    follow_up_result_summary: Optional[str] = None
    linked_review_id: Optional[str] = None
    linked_review_title: Optional[str] = None
    linked_review_period: Optional[str] = None
    created_at: str
    updated_at: str
    summary: str


class ChangeRequestCreate(BaseModel):
    type: str
    payload: Dict[str, Any]
    requested_by: str = "desktop_operator"
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    trigger_reason: Optional[str] = "manual_create"
    manual_followup_required: bool = False
    manual_followup_detail: Optional[str] = None
    target_mode: AccountMode = AccountMode.PAPER
    priority: PriorityLevel = PriorityLevel.NORMAL
    summary: str


class AgentJob(BaseModel):
    id: str
    job_type: str
    context: Dict[str, Any]
    strategy_id: Optional[str] = None
    allowed_actions: List[str]
    timeout: int = 120
    idempotency_key: str
    writeback_target: str
    status: JobStatus
    created_at: str
    updated_at: str
    result_summary: Optional[str] = None
    linked_review_id: Optional[str] = None
    linked_review_title: Optional[str] = None
    linked_review_period: Optional[str] = None
    retried_from_job_id: Optional[str] = None
    retry_count: int = 0


class AgentJobCreate(BaseModel):
    job_type: str
    context: Dict[str, Any]
    allowed_actions: List[str] = Field(default_factory=list)
    timeout: int = 120
    idempotency_key: str
    writeback_target: str = "scheduler"


class StrategyTrackingReviewRequest(BaseModel):
    review_kind: Literal["issue", "change"]
    summary: str
    detail: Optional[str] = None
    requested_by: str = "desktop_operator"
    request_key: Optional[str] = None


class SchedulerCommand(BaseModel):
    command: SchedulerCommandType
    job_id: Optional[str] = None
    requested_by: str = "desktop_operator"
    reason: Optional[str] = None


class RuntimeWorkerActionPayload(BaseModel):
    requested_by: str = "desktop_operator"
    reason: Optional[str] = None


class RuntimeWorkerActionResult(BaseModel):
    running: bool
    restarted_at: str
    last_error: Optional[str] = None
    last_refresh_at: Optional[str] = None
    message: str


class RuntimeWorkerStatus(BaseModel):
    running: bool
    started_once: bool = False
    issue: bool = False
    stale: bool = False
    stopped: bool = False
    stale_seconds: int = 0
    last_refresh_at: Optional[str] = None
    last_error: Optional[str] = None
    top_issue: Optional[str] = None
    recommended_action: Optional[str] = None
    generated_at: str


class SchedulerSnapshot(BaseModel):
    scheduler: SchedulerState
    jobs: List[AgentJob]
    change_requests: List[ChangeRequest]
    latest_scheduler_command: Optional[LatestSchedulerCommand] = None


class AiLiveSnapshot(SchedulerSnapshot):
    activity_feed: List["ExecutionEvent"]
    generated_at: str


class StrategyProposal(BaseModel):
    id: str
    proposal_type: Literal[
        "param_update",
        "pause_resume",
        "risk_update",
        "backtest_request",
        "script_patch_proposal",
        "publish_recommendation",
    ]
    strategy_id: str
    title: str
    description: str
    created_at: str
    status: Literal["pending", "accepted", "rejected", "testing"]
    expected_impact: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class StrategyProposalActionPayload(BaseModel):
    action: Literal["accept", "reject"]
    requested_by: str = "desktop_operator"


class StrategyProposalActionResult(BaseModel):
    proposal: StrategyProposal
    created_change_request: Optional[ChangeRequest] = None
    created_backtest: Optional[BacktestRun] = None


class ReviewDocument(BaseModel):
    id: str
    period: str
    strategy_id: Optional[str] = None
    backtest_id: Optional[str] = None
    source_change_request_id: Optional[str] = None
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    trigger_reason: Optional[str] = None
    source_job_id: Optional[str] = None
    source_job_type: Optional[str] = None
    source_job_status: Optional[str] = None
    decision_readiness: Optional[BacktestDecisionReadiness] = None
    decision_readiness_detail: Optional[str] = None
    decision_recommended_data_range: Optional[str] = None
    decision_recommended_timeframe: Optional[BacktestTimeframe] = None
    decision_readiness_action: Optional[str] = None
    title: str
    summary: str
    highlights: List[str]
    risks: List[str]
    proposals: List[StrategyProposal]
    created_at: str


class ExecutionImpactRecord(BaseModel):
    id: str
    strategy_id: str
    strategy_name: str
    window_start: str
    window_end: str
    summary: str = ""
    impact_level: str = "moderate"
    direction: str = "neutral"
    affected_orders: List[str] = Field(default_factory=list)
    affected_positions: List[str] = Field(default_factory=list)
    metrics_deltas: List[str] = Field(default_factory=list)
    follow_up_checks: List[str] = Field(default_factory=list)
    raw_text: str = ""
    agent_job_id: Optional[str] = None
    source: str = "openclaw"
    created_at: str
    updated_at: str


class AlertRecord(BaseModel):
    id: str
    severity: Literal["P0", "P1", "P2"]
    symbol: str
    title: str
    description: str
    triggered_at: str
    related_news_id: Optional[str] = None
    suggested_action: str
    acknowledged: bool = False
    source_type: Literal["rule", "news", "backtest", "system"] = "system"
    rule_id: Optional[str] = None
    rule_key: Optional[str] = None
    trigger_value: Optional[float] = None
    threshold_value: Optional[float] = None
    # Round 76 — typed discriminator set by the alert emitter (e.g.
    # ``AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE``, a
    # ``RISK_REASON_*`` code, or any other stable machine-readable tag).
    # Consumers that need to branch on "what kind of alert is this" should
    # inspect this field instead of substring-probing ``description``.
    reason_code: Optional[str] = None
    # Round 100 — finer-grained discriminator populated by channel-outage
    # emitters (one of the ``CHANNEL_ISSUE_KIND_*`` tags from
    # :mod:`execution_health`).  Decorators that pick the "no_feed" / "stale"
    # / "auth" recovery copy now read this field directly instead of re-
    # classifying ``description`` via ``_classify_channel_issue_kind``.  Kept
    # optional so alerts without a channel-outage taxonomy (manual ack,
    # news-driven, backtest-triggered, …) leave it unset.
    issue_kind: Optional[str] = None


class AlertRule(BaseModel):
    id: str
    symbol: str
    market: Literal["spot", "perp"]
    rule_type: Literal["price_change_pct"] = "price_change_pct"
    threshold_pct: float
    enabled: bool = True
    cooldown_minutes: int = 30
    created_at: str
    updated_at: str
    last_triggered_at: Optional[str] = None
    last_triggered_change_24h: Optional[float] = None
    rule_key: Optional[str] = None


class AlertAcknowledgePayload(BaseModel):
    acknowledged: bool = True
    requested_by: str = "desktop_operator"


class NewsEvent(BaseModel):
    id: str
    source: str
    title: str
    summary: str
    url: Optional[str] = None
    symbols: List[str]
    impact_score: int
    published_at: str
    category: Literal["announcement", "macro", "market", "ai_summary"]
    related_alert_ids: List[str] = Field(default_factory=list)


class TradeRecord(BaseModel):
    id: str
    symbol: str
    market: Literal["spot", "perp"]
    mode: AccountMode
    origin: Literal["manual", "strategy", "exchange"]
    side: Direction
    quantity: float
    price: float
    pnl: str
    strategy_id: Optional[str] = None
    created_at: str
    status: Literal["filled", "partially_filled", "cancelled"]


class AccountAsset(BaseModel):
    coin: str
    wallet_balance: str
    usd_value: str
    available_balance: str


class AccountOverview(BaseModel):
    source: Literal["mock", "paper", "bybit_private"]
    mode: AccountMode
    account_type: str
    total_equity: str
    total_wallet_balance: str
    total_available_balance: str
    unrealised_pnl: str
    positions_count: int
    open_orders_count: int
    top_holdings: List[AccountAsset]
    updated_at: str


class AccountLiveSnapshot(BaseModel):
    overview: AccountOverview
    positions: List["PositionRecord"]
    orders: List["OrderRecord"]
    order_history: List["OrderRecord"]
    generated_at: str


class PositionRecord(BaseModel):
    source: Literal["mock", "paper", "bybit_private"]
    symbol: str
    market: Literal["spot", "perp"]
    side: Literal["long", "short"]
    size: str
    avg_price: str
    mark_price: str
    value: str
    leverage: str
    unrealised_pnl: str
    updated_at: str


class OrderRecord(BaseModel):
    source: Literal["mock", "paper", "bybit_private"]
    origin: Literal["manual", "strategy"] = "manual"
    strategy_id: Optional[str] = None
    order_id: str
    symbol: str
    market: Literal["spot", "perp"]
    side: Direction
    order_type: str
    qty: str
    price: str
    status: str
    created_at: str


class ManualOrderRequest(BaseModel):
    symbol: str
    market: Literal["spot", "perp"]
    mode: AccountMode
    side: Direction
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    note: Optional[str] = None


class ExecutionPreviewRequest(BaseModel):
    symbol: str
    market: Literal["spot", "perp"]
    mode: AccountMode
    side: Direction
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    origin: Literal["manual", "strategy"] = "manual"
    strategy_id: Optional[str] = None
    note: Optional[str] = None
    exclude_order_id: Optional[str] = None
    release_order_ids: List[str] = Field(default_factory=list)


class ExecutionPreview(BaseModel):
    symbol: str
    market: Literal["spot", "perp"]
    mode: AccountMode
    side: Direction
    origin: Literal["manual", "strategy"]
    strategy_id: Optional[str] = None
    quantity: float
    price: float
    notional: str
    action: str
    allowed: bool
    blocked_reason: Optional[str] = None
    # Round 70 — optional typed ``block_code`` produced at the risk-guard /
    # preview-builder source alongside the free-form Chinese ``blocked_reason``.
    # ``evaluate_risk_decision`` (see ``risk_decision.py``) prefers this field
    # when set and only falls back to the substring-probe helper
    # ``derive_block_reason_code`` when a preview arrived without a typed code.
    block_code: Optional[str] = None
    # Round 80 — finer-grained discriminator when ``block_code`` is an umbrella
    # like ``RISK_REASON_RUNTIME_UNAVAILABLE`` that has multiple recovery
    # paths.  Today this carries the ``RISK_REASON_RUNTIME_UNAVAILABLE_*``
    # sub-codes so recommendation builders can pick between private-channel
    # / public-channel / worker-thread recovery copy without re-parsing
    # ``blocked_reason``.  Consumers should always check the umbrella
    # ``block_code`` first and only read this field when they need the
    # finer distinction.
    sub_block_code: Optional[str] = None
    recommended_action: Optional[str] = None
    sizing_risk_budget: Optional[str] = None
    sizing_budget_notional: Optional[str] = None
    sizing_minimum_required_notional: Optional[str] = None
    sizing_available_balance_gap: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    current_position_side: Literal["flat", "long", "short"] = "flat"
    current_position_size: str
    current_avg_price: str
    projected_position_side: Literal["flat", "long", "short"] = "flat"
    projected_position_size: str
    projected_avg_price: str
    available_balance_before: str
    available_balance_after: str
    estimated_realized_pnl: str
    generated_at: str


# Round 58 — ``RiskDecision`` wraps ``ExecutionPreview`` so every callsite that
# today inspects ``preview.allowed`` / ``preview.blocked_reason`` / the free-form
# ``preview.warnings`` list gets a single, typed verdict to branch on.  The
# embedded ``preview`` is preserved verbatim so numeric fields (notional,
# projected position, sizing budgets, …) stay readable.  The ``verdict`` and
# ``reason_code`` are the stable machine-readable contract; ``reason_detail``
# carries the human-readable message that used to live in ``blocked_reason``.
RiskVerdict = Literal["allow", "block", "degrade", "wait"]


# Stable machine-readable reason codes emitted by ``evaluate_risk_decision``.
# ``allow``-path decisions carry ``RISK_REASON_APPROVED``.  The ``block``-path
# codes map today's implicit block reasons onto a small, stable vocabulary;
# callers must never branch on substrings of ``reason_detail`` and should rely
# on ``reason_code`` instead.
RISK_REASON_APPROVED = "risk.approved"
RISK_REASON_ACCOUNT_MODE_UNAVAILABLE = "risk.account_mode_unavailable"
RISK_REASON_INSUFFICIENT_BALANCE = "risk.insufficient_balance"
RISK_REASON_INSUFFICIENT_INVENTORY = "risk.insufficient_inventory"
RISK_REASON_EXCHANGE_CONSTRAINT = "risk.exchange_constraint"
# Round 68 — precondition-validation failures (e.g. non-positive quantity /
# price) are conceptually distinct from risk rejections and from
# exchange-side step / min-notional constraints.  They used to fall through
# to ``risk.preview_blocked`` which made it impossible for auditors to tell
# invalid-input blocks from genuine risk blocks.  The new code tags those
# precondition failures so the fallback code is reserved for truly novel
# reasons.
RISK_REASON_INVALID_REQUEST = "risk.invalid_request"
# Round 71 — runtime-worker / websocket unavailability blocks.  Previously
# these infra-level blocks (e.g. "当前策略运行线程存在异常", "私有 WS 未就绪")
# fell through to ``risk.preview_blocked`` because they predate any typed
# classification and share no substring with the existing account-mode hints.
# The new code tags runtime / websocket outages so auditors can separate
# infra outages from true risk blocks.
RISK_REASON_RUNTIME_UNAVAILABLE = "risk.runtime_unavailable"
# Round 80 — finer-grained sub-codes for the ``RISK_REASON_RUNTIME_UNAVAILABLE``
# umbrella.  Prior to R80, ``_build_execution_preview_recommended_action``
# substring-probed the detail for ``"私有 WS"`` / ``"公共 WS"`` / ``"运行线程"``
# to pick between three different recovery copies.  The sub-codes below let
# preview builders and typed exception subclasses tag the kind at source so
# the recommendation branch dispatches on a stable machine-readable string.
# The umbrella ``RISK_REASON_RUNTIME_UNAVAILABLE`` stays wire-compatible so
# existing consumers that only check the top-level code keep working.
RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL = "risk.runtime_unavailable.private_channel"
RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL = "risk.runtime_unavailable.public_channel"
RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD = "risk.runtime_unavailable.worker_thread"
# Round 82 — typed code for real-mode stop-loss-guard blocks.  Previously the
# stop-loss-guard preview at ``_build_strategy_execution_preview_from_state``
# attached ``blocked_reason="当前已触发真实模式止损保护..."`` with no typed
# ``block_code``; ``_build_execution_preview_recommended_action`` re-classified
# via an ``if "止损保护" in detail:`` substring probe.  The new code tags the
# block at source so downstream recommenders, audit consumers and
# ``derive_block_reason_code`` all see a stable machine-readable code.
RISK_REASON_STOP_LOSS_GUARD = "risk.stop_loss_guard"
RISK_REASON_PREVIEW_BLOCKED = "risk.preview_blocked"


# Round 78 — sub-classification of Bybit exchange-order constraint violations
# produced by ``_validate_exchange_order_constraints``.  Prior to R78 the
# validator returned a free-form Chinese message and downstream recommendation
# helpers re-parsed the message with a brittle substring probe (which silently
# missed the ``min_notional`` branch because its copy says "最小下单金额" while
# the helper searched for "最小名义价值").  The typed ``kind`` discriminator
# makes the violation family explicit so recommendation code branches on the
# enum rather than the Chinese copy.
ExchangeConstraintViolationKind = Literal[
    "min_order_qty",
    "qty_step",
    "tick_size",
    "min_notional",
]


class ExchangeConstraintViolation(BaseModel):
    """Typed return for ``_validate_exchange_order_constraints`` (R78).

    * ``kind`` — which of the four exchange-side constraint rules tripped.
    * ``message`` — human-readable Chinese copy kept verbatim from the
      historical validator output so ``ExecutionPreview.blocked_reason``
      stays wire-compatible with existing auditors and UI surfaces.
    * ``limit_value`` — the numeric threshold the validator checked against
      (min order qty, qty step, tick size, or min notional) so downstream
      surfaces can render per-kind UI without re-parsing ``message``.
    """

    kind: ExchangeConstraintViolationKind
    message: str
    limit_value: float


class RiskDecisionRecommendation(BaseModel):
    """Round 73 — typed recommendation attached to a :class:`RiskDecision`.

    Historical callers passed a free-form ``Dict[str, Any]`` and downstream
    consumers read it with ``.get("recommendation" / "size_multiplier" / …)``.
    The three keys below cover every production and test usage today; the
    model accepts *and* serialises dict-shaped inputs unchanged so existing
    JSON-round-trip consumers keep working.

    * ``recommendation`` — free-form Chinese string echoed from
      ``preview.recommended_action`` on the block path so downstream UI can
      render it without a second fetch.
    * ``size_multiplier`` — fraction (``0 < x <= 1``) suggested for ``degrade``
      verdicts (future expansion; no production caller sets this today).
    * ``retry_after_seconds`` — integer delay suggested for ``wait`` verdicts
      (future expansion; no production caller sets this today).
    """

    recommendation: Optional[str] = None
    size_multiplier: Optional[float] = None
    retry_after_seconds: Optional[int] = None


class RiskDecision(BaseModel):
    """Structured risk verdict wrapping an :class:`ExecutionPreview`.

    * ``allow`` — proceed with the embedded preview as planned.
    * ``block`` — reject outright; ``reason_code`` and ``reason_detail`` explain why.
    * ``degrade`` — proceed with reduced size / adjusted params;
      ``recommended_action`` carries the delta (e.g. ``size_multiplier=0.5``).
    * ``wait`` — retry later; ``recommended_action`` carries e.g.
      ``retry_after_seconds=30``.

    The wrapped ``preview`` is kept intact so callers can still read numeric
    fields such as ``preview.notional`` or ``preview.projected_position_size``.
    """

    verdict: RiskVerdict
    reason_code: str
    reason_detail: str
    recommended_action: Optional[RiskDecisionRecommendation] = None
    preview: ExecutionPreview
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StrategyExecutionResult(BaseModel):
    kind: Literal["paper_trade", "exchange_order"]
    strategy_id: str
    mode: AccountMode
    preview: ExecutionPreview
    message: str
    trade: Optional[TradeRecord] = None
    order: Optional[OrderRecord] = None
    generated_at: str


# Round 57 — ``ExecutionIntent`` is the canonical handoff between the two
# strategy-signal entry points (manual "Execute" button / REST POST, and the
# autonomous strategy-runtime worker) and the shared dispatcher that converts
# an intent into either a Paper ``TradeRecord`` or a Live ``OrderRecord``.
#
# The intent freezes everything the downstream dispatcher needs so the Paper
# and Live branches no longer have to re-derive state from ``repo.snapshot()``:
# the ``preview`` (numeric fields), the ``decision`` (R58 verdict + reason
# code), and the ``parameter_snapshot`` (R51+ frozen parameters) travel
# together.  ``source`` discriminates manual vs. autonomous dispatch so the
# dispatcher can pick the right audit emission / alert-clear semantics
# without re-parsing ``requested_by``.
ExecutionIntentSource = Literal["manual", "auto"]


class ExecutionIntent(BaseModel):
    strategy_id: str
    strategy_name: str
    source: ExecutionIntentSource
    mode: AccountMode
    symbol: str
    market: Literal["spot", "perp"]
    side: Direction
    quantity: float
    price: float
    signal: str
    preview: ExecutionPreview
    decision: RiskDecision
    parameter_snapshot: Dict[str, Any]
    requested_by: str
    note: Optional[str] = None
    created_at: str


# Round 59 — ``LiveOrderReconciliation`` captures the outcome of comparing a
# frozen :class:`ExecutionIntent` against the pre-existing strategy orders on
# the exchange.  Before R59, ``_dispatch_live_intent`` interleaved the
# "which branch?" decision with the "act on the decision" side effects, so
# the 3-way branch (reuse / amend / submit) could not be inspected or tested
# in isolation.  Wrapping the decision in a typed record — in the same
# shape as R58's :class:`RiskDecision` — freezes the reconciliation verdict,
# the machine-readable reason code, the matched order (if any) and the
# stale orders that must be cancelled before the chosen action runs.
LiveOrderAction = Literal["reuse", "amend", "submit"]


class LiveOrderReconciliation(BaseModel):
    action: LiveOrderAction
    reason_code: str
    reason_detail: Optional[str] = None
    matching_order: Optional[OrderRecord] = None
    stale_orders: List[OrderRecord] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Round 127 — typed models for the wave-3-A unified ExecutionEngine
# (P0-4.2 §F.1 Shadow Mode).  These shapes mirror the design doc §B.2-§B.5
# and let :mod:`execution_engine` produce a fully typed :class:`ExecutionDecision`
# (and downstream :class:`ExecutionResult`) that the legacy dispatcher's
# ``_dispatch_paper_intent`` / ``_dispatch_live_intent`` will compare against
# in shadow mode.  Numeric quantities use ``float`` to match the rest of
# ``models.py`` (no ``Decimal`` is used in this file); the engine itself is
# responsible for honouring the qty-step / tick-size constraints upstream
# of constructing :class:`TargetPosition`.


# §B.2 — TargetPosition: where the engine thinks the strategy *should* be.
TargetPositionSide = Literal["flat", "long", "short"]
TargetPositionDerivedFrom = Literal[
    "strategy_signal",
    "manual_intent",
    "stop_loss",
    "external_close",
]


class TargetPosition(BaseModel):
    """Engine view of "this strategy should be at <side> <size> @ <ref>".

    All shadow-mode call sites pass ``derived_from="strategy_signal"`` since
    the live / paper paths derive the position from a strategy preview;
    other variants (manual / stop-loss / external close) land in wave-3-B/C
    when the engine takes ownership of the corresponding flows.
    """

    strategy_id: str
    symbol: str
    market: Literal["spot", "perp"]
    side: TargetPositionSide
    size: float = Field(ge=0)
    reference_price: float = Field(ge=0)
    confidence: float = 0.0
    derived_from: TargetPositionDerivedFrom = "strategy_signal"
    decided_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# §B.3 — ActiveExchangeOrder: thin wrapper over :class:`OrderRecord` that
# threads the intent linkage + reconciliation state.  The wrapper does not
# alter :class:`OrderRecord`'s wire schema (desktop unaffected); ``intent_id``
# / ``exchange_link_id`` may be ``None`` for legacy / external orders the
# engine reattaches during recovery (§E.1).
class FillFragment(BaseModel):
    """One execution slice against an active order (matches Bybit's
    ``execution`` topic granularity).
    """

    fill_id: str
    quantity: float = Field(ge=0)
    price: float = Field(ge=0)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ActiveExchangeOrder(BaseModel):
    order: OrderRecord
    intent_id: Optional[str] = None
    exchange_link_id: Optional[str] = None
    state: str = "ACKED"  # one of ``EXECUTION_STATE_*`` from execution_state_machine
    last_observed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    last_known_status: str = ""
    fills: List[FillFragment] = Field(default_factory=list)
    drift_detected: bool = False


# §B.4 — NewOrderRequest: the typed RPC payload the engine forwards when
# verb in {submit, cancel_and_resubmit}.  Mirrors the manual order flow's
# :class:`ManualOrderRequest` but adds the strategy linkage so the engine
# stamps ``orderLinkId`` correctly without piggybacking on ``ManualOrderRequest``.
class NewOrderRequest(BaseModel):
    strategy_id: Optional[str] = None
    symbol: str
    market: Literal["spot", "perp"]
    mode: AccountMode
    side: Direction
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    reduce_only: bool = False
    note: Optional[str] = None
    exchange_link_id: Optional[str] = None


# §B.4 — ExecutionDecision: the next action the engine has chosen.
# Pure output of :meth:`execution_engine.ExecutionEngine.compute_decision`;
# realising the decision is :meth:`execute`'s job (lands in F.2 / F.3).
ExecutionVerb = Literal[
    "keep",
    "amend",
    "cancel_and_resubmit",
    "cancel_only",
    "submit",
    "noop",
]


class ExecutionDecision(BaseModel):
    verb: ExecutionVerb
    intent: ExecutionIntent
    target_order: Optional[ActiveExchangeOrder] = None
    stale_orders: List[ActiveExchangeOrder] = Field(default_factory=list)
    new_order_request: Optional[NewOrderRequest] = None
    risk_decision: RiskDecision
    reason_code: str
    reason_detail: Optional[str] = None
    decided_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# §B.5 — ExecutionResult: the engine's terminal outcome after :meth:`execute`.
# Wave-3-A does not write this yet (no execute path) but the type is needed
# now so ``execution_engine.py`` can declare the return type.
ExecutionResultStatus = Literal[
    "submitted",
    "amended",
    "reused",
    "cancelled",
    "noop",
    "blocked",
    "rejected",
    "failed_transient",
    "externally_modified",
]


class ExecutionResult(BaseModel):
    intent_id: str
    status: ExecutionResultStatus
    final_state: str  # one of ``EXECUTION_STATE_*``
    order: Optional[ActiveExchangeOrder] = None
    audit_event_ids: List[str] = Field(default_factory=list)
    risk_decision: RiskDecision
    error_detail: Optional[str] = None
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# RecoveryReport: the artefact :meth:`recover` produces (§E.1).  Wave-3-A
# only declares the shape; F.4 lands the body.
class RecoveryDivergence(BaseModel):
    order_id: str
    reason: Literal["local_only", "exchange_only", "qty_mismatch", "status_mismatch"]
    detail: str = ""


class RecoveryReport(BaseModel):
    active_orders: List[ActiveExchangeOrder] = Field(default_factory=list)
    divergences: List[RecoveryDivergence] = Field(default_factory=list)
    recovered_intents: List[str] = Field(default_factory=list)
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Round 60 — ``AutoDispatchGate`` captures the verdict of the autonomous
# strategy-runtime worker's pre-flight guard chain.  Before R60, six
# ``continue``-style guards inside ``_auto_dispatch_strategy_signal_changes``
# interleaved the "should we dispatch?" decision with the "what side effects
# do we run on block?" logic (cancel existing orders / clear
# auto_dispatch alerts / record an issue).  Wrapping the verdict in a typed
# record — in the same shape as R58's :class:`RiskDecision` and R59's
# :class:`LiveOrderReconciliation` — makes each guard individually
# unit-testable via ``_evaluate_strategy_auto_dispatch_gate``.
AutoDispatchVerdict = Literal["allow", "block"]


class AutoDispatchGate(BaseModel):
    verdict: AutoDispatchVerdict
    reason_code: str
    reason_detail: str = ""
    cancel_existing_orders: bool = False
    clear_alerts: bool = False
    record_issue: bool = False
    # Round 76 — finer-grained discriminator surfaced when ``reason_code`` is
    # the umbrella ``auto.scheduler_or_channel_gate``; carries the typed
    # ``AutoDispatchGateReasonContext.reason_code`` (one of the
    # ``AUTO_DISPATCH_GATE_REASON_*`` constants) so alert emitters can tag
    # the resulting ``AlertRecord.reason_code`` without re-classifying the
    # free-form ``reason_detail`` string.
    sub_reason_code: Optional[str] = None
    # Round 100 — typed ``CHANNEL_ISSUE_KIND_*`` discriminator mirroring
    # ``AutoDispatchGateReasonContext.issue_kind``; carried on the gate so
    # the alert emitter can thread ``AlertRecord.issue_kind`` without
    # reaching back into the context object.  ``None`` for non-channel
    # gate reasons (paused / stop-loss / cooldown / scheduler-only).
    issue_kind: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Round 61 — ``AutoDispatchOutcome`` captures the terminal result of a
# single autonomous ``_dispatch_strategy_signal_from_state`` call inside
# ``_auto_dispatch_strategy_signal_changes``.  Before R61 the try/except
# had four side-effect branches: success (clear alerts), RuntimeError
# carrying ``"无需再次提交委托"`` (noop event + clear alerts),
# :class:`StrategyExecutionBlockedError` (record issue with
# ``recommended_action``), other ``RuntimeError`` (record issue with
# detail), and the catch-all ``Exception`` (record issue with generic
# detail).  Wrapping the verdict in a typed record — same shape as
# R60's :class:`AutoDispatchGate` — makes every outcome individually
# unit-testable and pins the side effects the dispatcher must run on
# each verdict.
AutoDispatchOutcomeVerdict = Literal["dispatched", "noop", "blocked", "failed"]


class AutoDispatchOutcome(BaseModel):
    verdict: AutoDispatchOutcomeVerdict
    reason_code: str
    reason_detail: str = ""
    recommended_action: Optional[str] = None
    clear_alerts: bool = False
    emit_noop_event: bool = False
    record_issue: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Round 75 — typed return of ``_strategy_auto_dispatch_gate_reason`` replacing
# the historical ``Optional[str]`` shape.  Before R75 the gate evaluator
# decided whether to cancel existing orders by substring-probing the
# free-form detail string for ``"公共 WS"`` / ``"私有 WS"`` alongside a
# scheduler-status check; the classifier is now carried explicitly on the
# context object so every sub-reason (manual override / scheduler paused /
# freeze publish / public channel outage / private channel outage) has a
# machine-readable identity that drives the ``cancel_existing`` side effect
# and can be extended without reaching back into substring rules.
AUTO_DISPATCH_GATE_REASON_SCHEDULER_MANUAL_OVERRIDE = "auto.scheduler.manual_override"
AUTO_DISPATCH_GATE_REASON_SCHEDULER_PAUSED = "auto.scheduler.paused"
AUTO_DISPATCH_GATE_REASON_SCHEDULER_FREEZE_PUBLISH = "auto.scheduler.freeze_publish"
AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE = "auto.channel.public_outage"
AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE = "auto.channel.private_outage"

AutoDispatchGateReasonCode = Literal[
    "auto.scheduler.manual_override",
    "auto.scheduler.paused",
    "auto.scheduler.freeze_publish",
    "auto.channel.public_outage",
    "auto.channel.private_outage",
]


class AutoDispatchGateReasonContext(BaseModel):
    reason_code: AutoDispatchGateReasonCode
    detail: str
    cancel_existing: bool
    # Round 100 — typed ``CHANNEL_ISSUE_KIND_*`` discriminator emitted at the
    # channel-outage source (``_build_{public,private}_execution_channel_health``)
    # so the downstream ``_record_strategy_auto_dispatch_issue`` callsite can
    # forward it onto ``AlertRecord.issue_kind`` without re-classifying the
    # free-form ``detail`` string.  Scheduler / freeze-publish branches carry
    # ``None`` since their detail strings have no channel-kind taxonomy.
    issue_kind: Optional[str] = None


class ClosePaperPositionPayload(BaseModel):
    requested_by: str = "desktop_operator"


class PaperOrderCancelPayload(BaseModel):
    requested_by: str = "desktop_operator"


class PaperOrderReplacePayload(BaseModel):
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    requested_by: str = "desktop_operator"


class PaperOrderBulkCancelResult(BaseModel):
    cancelled_count: int
    cancelled_order_ids: List[str]
    requested_by: str
    updated_at: str


class PaperPositionBulkCloseResult(BaseModel):
    closed_count: int
    trade_ids: List[str]
    requested_by: str
    updated_at: str


class ExchangePositionBulkCloseResult(BaseModel):
    submitted_count: int
    order_ids: List[str]
    requested_by: str
    updated_at: str


class ExecutionEvent(BaseModel):
    id: str
    event_type: str
    severity: EventSeverity
    source: str
    symbol: Optional[str] = None
    strategy_id: Optional[str] = None
    payload: Dict[str, Any]
    summary: Optional[str] = None
    impact_detail: Optional[str] = None
    priority: Optional[int] = None
    is_key_event: Optional[bool] = None
    # Round B — strategy-originated events carry a frozen snapshot of the
    # parameters that were in effect at dispatch time. Non-strategy events
    # (manual paper trades, exchange-only order lifecycle, news alerts, etc.)
    # leave this ``None`` so legacy callers continue to behave as before.
    parameter_snapshot: Optional[Dict[str, Any]] = None
    trace_id: str
    occurred_at: str


class SettingsPayload(BaseModel):
    bybit_web_entry: str
    api_base_url: str
    openclaw_gateway_url: str
    openclaw_agent: str
    default_mode: AccountMode
    notification_channels: List[str]
    notification_quiet_hours_enabled: bool = False
    notification_quiet_hours_start: str = "23:00"
    notification_quiet_hours_end: str = "08:00"
    product_language: str = "zh-CN"
    grafana_base_url: Optional[str] = None
    grafana_dashboard_uid: Optional[str] = None
    grafana_org_id: int = 1
    grafana_theme: Literal["dark", "light"] = "dark"


class SettingsUpdatePayload(BaseModel):
    bybit_web_entry: Optional[str] = None
    api_base_url: Optional[str] = None
    default_mode: Optional[AccountMode] = None
    notification_channels: Optional[List[str]] = None
    notification_quiet_hours_enabled: Optional[bool] = None
    notification_quiet_hours_start: Optional[str] = None
    notification_quiet_hours_end: Optional[str] = None
    product_language: Optional[str] = None
    grafana_base_url: Optional[str] = None
    grafana_dashboard_uid: Optional[str] = None
    grafana_org_id: Optional[int] = None
    grafana_theme: Optional[Literal["dark", "light"]] = None


class GrafanaIntegrationStatus(BaseModel):
    configured: bool
    base_url: Optional[str] = None
    dashboard_uid: Optional[str] = None
    org_id: int = 1
    theme: Literal["dark", "light"] = "dark"
    metrics_path: str = "/metrics"
    dashboard_url: Optional[str] = None
    recommended_scope: Literal["ops_monitoring_only"] = "ops_monitoring_only"
    note: str


class WorkspacePreferences(BaseModel):
    active_section: Literal[
        "overview",
        "settings",
        "market",
        "strategy",
        "backtest",
        "scheduler",
        "news",
        "alerts",
        "trades",
        "replay",
        "audit",
    ]
    layout_preset: Literal["balanced", "focus", "dense"]
    selected_mode: AccountMode
    selected_symbol: str
    selected_market_timeframe: Literal["15m", "1h", "4h", "1d"] = "1h"
    selected_strategy_id: Optional[str] = None
    selected_backtest_id: Optional[str] = None
    selected_scheduler_job_id: Optional[str] = None
    selected_strategy_detail_panel: Optional[Literal["activity", "tracking", "editor"]] = None
    selected_strategy_tracking_kind: Optional[Literal["issue", "change"]] = None
    selected_strategy_tracking_summary: str = ""
    selected_strategy_tracking_detail: str = ""
    selected_strategy_editor_strategy_id: Optional[str] = None
    selected_strategy_editor_parameter_drafts: Dict[str, str] = Field(default_factory=dict)
    selected_strategy_editor_risk_budget_draft: str = ""
    selected_review_inspector_id: Optional[str] = None
    selected_review_inspector_strategy_id: Optional[str] = None
    selected_review_id: Optional[str] = None
    selected_proposal_id: Optional[str] = None
    selected_change_request_id: Optional[str] = None
    backtest_filter: Literal["selected", "all"] = "selected"
    replay_tracking_scope: Literal["all", "selected"] = "all"
    alert_severity_filter: Literal["all", "P0", "P1", "P2"] = "all"
    alert_status_filter: Literal["all", "pending", "acknowledged"] = "pending"
    alert_scope_filter: Literal["all", "selected"] = "all"
    trade_mode_filter: Literal["all", "paper", "demo", "live"] = "all"
    trade_origin_filter: Literal["all", "manual", "strategy", "exchange"] = "all"
    trade_scope_filter: Literal["all", "selected"] = "all"
    audit_severity_filter: Literal["all", "info", "warning", "error", "critical"] = "all"
    audit_source_filter: str = "all"
    audit_scope_filter: Literal["all", "selected"] = "all"
    audit_search: str = ""
    overview_card_order: List[str]
    overview_visible_cards: List[str]
    overview_collapsed_cards: List[str] = Field(default_factory=list)
    updated_at: str


class WorkspacePreferencesUpdate(BaseModel):
    active_section: Literal[
        "overview",
        "settings",
        "market",
        "strategy",
        "backtest",
        "scheduler",
        "news",
        "alerts",
        "trades",
        "replay",
        "audit",
    ]
    layout_preset: Literal["balanced", "focus", "dense"]
    selected_mode: AccountMode
    selected_symbol: str
    selected_market_timeframe: Literal["15m", "1h", "4h", "1d"] = "1h"
    selected_strategy_id: Optional[str] = None
    selected_backtest_id: Optional[str] = None
    selected_scheduler_job_id: Optional[str] = None
    selected_strategy_detail_panel: Optional[Literal["activity", "tracking", "editor"]] = None
    selected_strategy_tracking_kind: Optional[Literal["issue", "change"]] = None
    selected_strategy_tracking_summary: str = ""
    selected_strategy_tracking_detail: str = ""
    selected_strategy_editor_strategy_id: Optional[str] = None
    selected_strategy_editor_parameter_drafts: Dict[str, str] = Field(default_factory=dict)
    selected_strategy_editor_risk_budget_draft: str = ""
    selected_review_inspector_id: Optional[str] = None
    selected_review_inspector_strategy_id: Optional[str] = None
    selected_review_id: Optional[str] = None
    selected_proposal_id: Optional[str] = None
    selected_change_request_id: Optional[str] = None
    backtest_filter: Literal["selected", "all"] = "selected"
    replay_tracking_scope: Literal["all", "selected"] = "all"
    alert_severity_filter: Literal["all", "P0", "P1", "P2"] = "all"
    alert_status_filter: Literal["all", "pending", "acknowledged"] = "pending"
    alert_scope_filter: Literal["all", "selected"] = "all"
    trade_mode_filter: Literal["all", "paper", "demo", "live"] = "all"
    trade_origin_filter: Literal["all", "manual", "strategy", "exchange"] = "all"
    trade_scope_filter: Literal["all", "selected"] = "all"
    audit_severity_filter: Literal["all", "info", "warning", "error", "critical"] = "all"
    audit_source_filter: str = "all"
    audit_scope_filter: Literal["all", "selected"] = "all"
    audit_search: str = ""
    overview_card_order: List[str]
    overview_visible_cards: List[str]
    overview_collapsed_cards: List[str] = Field(default_factory=list)


class OpenClawStatus(BaseModel):
    configured: bool
    config_path: Optional[str] = None
    config_exists: bool = False
    command_available: bool = False
    gateway_url: Optional[str] = None
    auth_mode: Optional[str] = None
    default_agent: Optional[str] = None
    resolved_agent: Optional[str] = None
    heartbeat: Optional[str] = None
    health_output: Optional[str] = None
    status_output: Optional[str] = None
    reachable: bool = False
    worker_running: bool = False
    active_job_id: Optional[str] = None
    last_worker_event_at: Optional[str] = None
    last_job_id: Optional[str] = None
    last_job_status: Optional[str] = None
    last_job_summary: Optional[str] = None


class BybitBalanceDiagnostic(BaseModel):
    account_type: str
    coin: str = "USDT"
    wallet_balance: str = "0"
    transfer_balance: str = "0"
    available_balance: str = "0"
    source: Literal["coin-balance", "wallet-balance", "error"] = "coin-balance"
    error: Optional[str] = None


class BybitPrivateStatus(BaseModel):
    configured: bool
    can_query_private: bool
    source: Literal["env", "file", "none"]
    config_path: Optional[str] = None
    config_exists: bool = False
    example_config_path: Optional[str] = None
    api_base_url: str
    account_type: str
    mode: AccountMode
    key_hint: Optional[str] = None
    last_error: Optional[str] = None
    realtime_enabled: bool = False
    realtime_connected: bool = False
    realtime_authenticated: bool = False
    realtime_last_message_at: Optional[str] = None
    realtime_stale: bool = False
    realtime_stale_seconds: int = 0
    realtime_last_error: Optional[str] = None
    realtime_recommended_action: Optional[str] = None
    usdt_balance_diagnostics: List[BybitBalanceDiagnostic] = Field(default_factory=list)
    updated_at: str


class BybitPublicSymbolDiagnostic(BaseModel):
    symbol: str
    market: Literal["spot", "perp"]
    channel: Literal["spot", "linear"]
    connected: bool = False
    has_symbol_feed: bool = False
    stale: bool = False
    stale_seconds: int = 0
    last_message_at: Optional[str] = None
    issue: Optional[str] = None
    recommended_action: Optional[str] = None


class BybitPublicStatus(BaseModel):
    enabled: bool
    connected_spot: bool = False
    connected_linear: bool = False
    spot_stale: bool = False
    spot_stale_seconds: int = 0
    linear_stale: bool = False
    linear_stale_seconds: int = 0
    last_message_at_spot: Optional[str] = None
    last_message_at_linear: Optional[str] = None
    last_message_at: Optional[str] = None
    last_error: Optional[str] = None
    rest_reachable: Optional[bool] = None
    rest_last_error: Optional[str] = None
    rest_tested_at: Optional[str] = None
    recommended_action: Optional[str] = None
    watched_symbol_diagnostics: List[BybitPublicSymbolDiagnostic] = Field(default_factory=list)
    updated_at: str


class BybitTradeProbeResult(BaseModel):
    configured: bool
    authenticated: bool
    trade_permission: Optional[bool] = None
    outcome: Literal[
        "not_configured",
        "validation_rejected",
        "permission_denied",
        "request_rejected",
        "accepted_unexpectedly",
        "network_error",
    ]
    detail: str
    ret_code: Optional[int] = None
    order_link_id: Optional[str] = None
    tested_at: str


class AppState(BaseModel):
    control_snapshot: ControlSnapshot
    watchlist: List[WatchlistInstrument]
    market_details: Dict[str, MarketDetail]
    strategies: List[StrategySummary]
    strategy_runtime_snapshots: List[StrategyRuntimeSnapshot] = Field(default_factory=list)
    backtests: List[BacktestRun]
    change_requests: List[ChangeRequest]
    agent_jobs: List[AgentJob]
    reviews: List[ReviewDocument]
    execution_impact_records: List[ExecutionImpactRecord] = Field(default_factory=list)
    alerts: List[AlertRecord]
    alert_rules: List[AlertRule] = Field(default_factory=list)
    news_events: List[NewsEvent]
    trades: List[TradeRecord]
    paper_orders: List[OrderRecord] = Field(default_factory=list)
    paper_order_history: List[OrderRecord] = Field(default_factory=list)
    audit_events: List[ExecutionEvent]
    settings: SettingsPayload
    workspace_preferences: WorkspacePreferences


class ReconcileChangeRequestOutcome(BaseModel):
    """Structured outcome returned by a ``reconcile_change_request`` agent job.

    This shape is populated from the OpenClaw agent response (JSON preferred,
    plain-text fallback parsed best-effort). It is written back to the
    originating ``ChangeRequest`` so the desktop can tell at a glance whether
    the change actually landed or still needs human follow-up, and what the
    next suggested actions are.
    """

    change_request_id: str
    summary: str
    landed: Optional[bool] = None
    needs_manual_review: Optional[bool] = None
    needs_manual_review_detail: Optional[str] = None
    next_actions: List[str] = Field(default_factory=list)
