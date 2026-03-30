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


class ControlSnapshot(BaseModel):
    account_metrics: List[MetricCard]
    risk_metrics: List[MetricCard]
    strategy_metrics: List[MetricCard]
    scheduler: SchedulerState
    alerts_summary: Dict[str, int]
    pending_tasks: List[TaskSummary]
    today_performance: Dict[str, str]


class WatchlistInstrument(BaseModel):
    symbol: str
    market: Literal["spot", "perp"]
    last_price: float
    change_24h: float
    volume_24h: float
    signal: Literal["neutral", "watch", "active"]
    position_side: Literal["flat", "long", "short"]
    risk_level: Literal["low", "medium", "high"]


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


class MarketDetail(BaseModel):
    symbol: str
    market: Literal["spot", "perp"]
    timeframe: str
    candles: List[CandlePoint]
    bids: List[OrderBookLevel]
    asks: List[OrderBookLevel]
    headline: str
    stats: Dict[str, str]
    source: Literal["mock", "bybit_rest"] = "mock"
    updated_at: Optional[str] = None


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
    allowed_actions: List[str]
    timeout: int = 120
    idempotency_key: str
    writeback_target: str
    status: JobStatus
    created_at: str
    updated_at: str
    result_summary: Optional[str] = None


class AgentJobCreate(BaseModel):
    job_type: str
    context: Dict[str, Any]
    allowed_actions: List[str] = Field(default_factory=list)
    timeout: int = 120
    idempotency_key: str
    writeback_target: str = "scheduler"


class SchedulerCommand(BaseModel):
    command: SchedulerCommandType
    job_id: Optional[str] = None
    requested_by: str = "desktop_operator"
    reason: Optional[str] = None


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


class ReviewDocument(BaseModel):
    id: str
    period: str
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


class NewsEvent(BaseModel):
    id: str
    source: str
    title: str
    summary: str
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
    origin: Literal["manual", "strategy"]
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
    source: Literal["mock", "bybit_private"]
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


class PositionRecord(BaseModel):
    source: Literal["mock", "bybit_private"]
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
    source: Literal["mock", "bybit_private"]
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


class WorkspacePreferences(BaseModel):
    active_section: Literal[
        "overview",
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
    selected_strategy_id: Optional[str] = None
    overview_card_order: List[str]
    overview_visible_cards: List[str]
    updated_at: str


class WorkspacePreferencesUpdate(BaseModel):
    active_section: Literal[
        "overview",
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
    selected_strategy_id: Optional[str] = None
    overview_card_order: List[str]
    overview_visible_cards: List[str]


class OpenClawStatus(BaseModel):
    configured: bool
    gateway_url: Optional[str] = None
    auth_mode: Optional[str] = None
    default_agent: Optional[str] = None
    heartbeat: Optional[str] = None
    health_output: Optional[str] = None
    status_output: Optional[str] = None
    reachable: bool = False


class BybitPrivateStatus(BaseModel):
    configured: bool
    can_query_private: bool
    source: Literal["env", "file", "none"]
    api_base_url: str
    account_type: str
    mode: AccountMode
    key_hint: Optional[str] = None
    last_error: Optional[str] = None
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
    backtests: List[BacktestRun]
    change_requests: List[ChangeRequest]
    agent_jobs: List[AgentJob]
    reviews: List[ReviewDocument]
    alerts: List[AlertRecord]
    news_events: List[NewsEvent]
    trades: List[TradeRecord]
    audit_events: List[ExecutionEvent]
    settings: SettingsPayload
    workspace_preferences: WorkspacePreferences
