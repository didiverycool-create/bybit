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
RISK_REASON_PREVIEW_BLOCKED = "risk.preview_blocked"


class RiskDecision(BaseModel):
    """Structured risk verdict wrapping an :class:`ExecutionPreview`.

    * ``allow`` — proceed with the embedded preview as planned.
    * ``block`` — reject outright; ``reason_code`` and ``reason_detail`` explain why.
    * ``degrade`` — proceed with reduced size / adjusted params;
      ``recommended_action`` carries the delta (e.g. ``{"size_multiplier": 0.5}``).
    * ``wait`` — retry later; ``recommended_action`` carries e.g.
      ``{"retry_after_seconds": 30}``.

    The wrapped ``preview`` is kept intact so callers can still read numeric
    fields such as ``preview.notional`` or ``preview.projected_position_size``.
    """

    verdict: RiskVerdict
    reason_code: str
    reason_detail: str
    recommended_action: Optional[Dict[str, Any]] = None
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
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
