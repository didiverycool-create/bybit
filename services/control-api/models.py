from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


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


class ControlSnapshot(BaseModel):
    account_metrics: List[MetricCard]
    risk_metrics: List[MetricCard]
    strategy_metrics: List[MetricCard]
    scheduler: SchedulerState
    alerts_summary: Dict[str, int]
    pending_tasks: List[TaskSummary]
    today_performance: Dict[str, str]
    execution_health: ExecutionHealthSummary = Field(default_factory=ExecutionHealthSummary)


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
    source: Literal["mock", "bybit_rest", "bybit_ws"] = "mock"
    updated_at: Optional[str] = None


class MarketLiveSnapshot(BaseModel):
    selected_symbol: str
    watchlist: List[WatchlistInstrument]
    detail: MarketDetail
    generated_at: str


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
    generated_at: str


class StrategyParameter(BaseModel):
    key: str
    label: str
    value: Union[float, int, str, bool]
    unit: Optional[str] = None


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


class StrategyActivitySnapshot(BaseModel):
    strategy_id: str
    strategy_name: str
    symbol: str
    market: Literal["spot", "perp"]
    mode: AccountMode
    runtime: Optional[StrategyRuntimeSnapshot] = None
    latest_primary_review: Optional["StrategyActivityReviewSummary"] = None
    latest_tracking_review: Optional["StrategyActivityReviewSummary"] = None
    latest_tracking_job: Optional["StrategyActivityJobSummary"] = None
    recent_reviews: List["StrategyActivityReviewSummary"] = Field(default_factory=list)
    active_orders: List["OrderRecord"] = Field(default_factory=list)
    recent_orders: List["OrderRecord"] = Field(default_factory=list)
    recent_trades: List["TradeRecord"] = Field(default_factory=list)
    recent_alerts: List["AlertRecord"] = Field(default_factory=list)
    recent_audit_events: List["ExecutionEvent"] = Field(default_factory=list)
    recent_agent_jobs: List["StrategyActivityJobSummary"] = Field(default_factory=list)
    generated_at: str


class StrategyActivityReviewSummary(BaseModel):
    id: str
    period: str
    title: str
    summary: str
    proposal_count: int = 0
    created_at: str


class StrategyActivityJobSummary(BaseModel):
    id: str
    job_type: str
    status: JobStatus
    strategy_id: Optional[str] = None
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


class BacktestRun(BaseModel):
    id: str
    strategy_id: str
    strategy_name: str
    status: Literal["queued", "running", "completed", "failed"]
    started_at: str
    finished_at: Optional[str] = None
    symbol_scope: List[str]
    timeframe: str
    data_range: str
    data_granularity: str
    fee_model: str
    slippage_model: str
    parameter_snapshot: Dict[str, Any]
    metrics: BacktestMetrics
    notes: str


class ChangeRequest(BaseModel):
    id: str
    type: str
    payload: Dict[str, Any]
    requested_by: str
    target_mode: AccountMode
    priority: PriorityLevel
    status: ChangeRequestStatus
    correlation_id: str
    created_at: str
    updated_at: str
    summary: str


class ChangeRequestCreate(BaseModel):
    type: str
    payload: Dict[str, Any]
    requested_by: str = "desktop_operator"
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


class AiLiveSnapshot(BaseModel):
    scheduler: SchedulerState
    jobs: List[AgentJob]
    change_requests: List[ChangeRequest]
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
    source_job_id: Optional[str] = None
    source_job_type: Optional[str] = None
    source_job_status: Optional[str] = None
    title: str
    summary: str
    highlights: List[str]
    risks: List[str]
    proposals: List[StrategyProposal]
    created_at: str


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


class StrategyExecutionResult(BaseModel):
    kind: Literal["paper_trade", "exchange_order"]
    strategy_id: str
    mode: AccountMode
    preview: ExecutionPreview
    message: str
    trade: Optional[TradeRecord] = None
    order: Optional[OrderRecord] = None
    generated_at: str


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
    trace_id: str
    occurred_at: str


class SettingsPayload(BaseModel):
    bybit_web_entry: str
    api_base_url: str
    openclaw_gateway_url: str
    openclaw_agent: str
    default_mode: AccountMode
    notification_channels: List[str]
    product_language: str = "zh-CN"
    grafana_base_url: Optional[str] = None
    grafana_dashboard_uid: Optional[str] = None
    grafana_org_id: int = 1
    grafana_theme: Literal["dark", "light"] = "dark"


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
    overview_card_order: List[str]
    overview_visible_cards: List[str]
    overview_collapsed_cards: List[str] = Field(default_factory=list)


class OpenClawStatus(BaseModel):
    configured: bool
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
    alerts: List[AlertRecord]
    alert_rules: List[AlertRule] = Field(default_factory=list)
    news_events: List[NewsEvent]
    trades: List[TradeRecord]
    paper_orders: List[OrderRecord] = Field(default_factory=list)
    paper_order_history: List[OrderRecord] = Field(default_factory=list)
    audit_events: List[ExecutionEvent]
    settings: SettingsPayload
    workspace_preferences: WorkspacePreferences
