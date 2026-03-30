export type SectionKey =
  | 'overview'
  | 'market'
  | 'strategy'
  | 'backtest'
  | 'scheduler'
  | 'news'
  | 'alerts'
  | 'trades'
  | 'replay'
  | 'audit'

export type LayoutPreset = 'balanced' | 'focus' | 'dense'
export type Mode = 'paper' | 'demo' | 'live'
export type ChangeRequestStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'applied'
  | 'failed'
  | 'rolled_back'
export type SchedulerStatus =
  | 'running'
  | 'paused'
  | 'manual_override'
  | 'degraded'
export type SchedulerCommandType =
  | 'pause'
  | 'resume'
  | 'cancel_job'
  | 'cancel_all'
  | 'freeze_publish'
  | 'enter_manual_override'
export type Severity = 'info' | 'warning' | 'error' | 'critical'

export interface MetricCard {
  label: string
  value: string
  delta?: string | null
  tone: 'neutral' | 'positive' | 'warning' | 'critical'
}

export interface TaskSummary {
  id: string
  title: string
  type: string
  status: 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'
  owner: string
  updated_at: string
}

export interface SchedulerState {
  status: SchedulerStatus
  freeze_publish: boolean
  current_job_id: string | null
  queue_depth: number
  last_heartbeat_at: string
  openclaw_connected: boolean
  current_mode: Mode
}

export interface ControlSnapshot {
  account_metrics: MetricCard[]
  risk_metrics: MetricCard[]
  strategy_metrics: MetricCard[]
  scheduler: SchedulerState
  alerts_summary: Record<string, number>
  pending_tasks: TaskSummary[]
  today_performance: Record<string, string>
}

export interface WatchlistInstrument {
  symbol: string
  market: 'spot' | 'perp'
  last_price: number
  change_24h: number
  volume_24h: number
  signal: 'neutral' | 'watch' | 'active'
  position_side: 'flat' | 'long' | 'short'
  risk_level: 'low' | 'medium' | 'high'
}

export interface CandlePoint {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OrderBookLevel {
  price: number
  size: number
  total: number
}

export interface MarketDetail {
  symbol: string
  market: 'spot' | 'perp'
  timeframe: string
  candles: CandlePoint[]
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  headline: string
  stats: Record<string, string>
  source?: 'mock' | 'bybit_rest'
  updated_at?: string | null
}

export interface StrategyParameter {
  key: string
  label: string
  value: string | number | boolean
  unit?: string | null
}

export interface StrategySummary {
  id: string
  name: string
  category: 'template' | 'python'
  status: 'running' | 'paused' | 'paper_only' | 'shadow'
  symbols: string[]
  mode: Mode
  version: string
  pnl_7d: string
  max_drawdown: string
  risk_budget: string
  description: string
  parameters: StrategyParameter[]
}

export interface BacktestMetrics {
  annual_return: string
  max_drawdown: string
  sharpe: string
  win_rate: string
  pnl: string
  trades: number
}

export interface BacktestRun {
  id: string
  strategy_id: string
  strategy_name: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  started_at: string
  finished_at?: string | null
  symbol_scope: string[]
  timeframe: string
  data_range: string
  data_granularity: string
  fee_model: string
  slippage_model: string
  parameter_snapshot: Record<string, unknown>
  metrics: BacktestMetrics
  notes: string
}

export interface ChangeRequest {
  id: string
  type: string
  payload: Record<string, unknown>
  requested_by: string
  target_mode: Mode
  priority: 'low' | 'normal' | 'high' | 'critical'
  status: ChangeRequestStatus
  correlation_id: string
  created_at: string
  updated_at: string
  summary: string
}

export interface AgentJob {
  id: string
  job_type: string
  context: Record<string, unknown>
  allowed_actions: string[]
  timeout: number
  idempotency_key: string
  writeback_target: string
  status: 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  updated_at: string
  result_summary?: string | null
}

export interface AlertRecord {
  id: string
  severity: 'P0' | 'P1' | 'P2'
  symbol: string
  title: string
  description: string
  triggered_at: string
  related_news_id?: string | null
  suggested_action: string
  acknowledged: boolean
}

export interface NewsEvent {
  id: string
  source: string
  title: string
  summary: string
  symbols: string[]
  impact_score: number
  published_at: string
  category: 'announcement' | 'macro' | 'market' | 'ai_summary'
  related_alert_ids: string[]
}

export interface TradeRecord {
  id: string
  symbol: string
  market: 'spot' | 'perp'
  mode: Mode
  origin: 'manual' | 'strategy'
  side: 'buy' | 'sell'
  quantity: number
  price: number
  pnl: string
  strategy_id?: string | null
  created_at: string
  status: 'filled' | 'partially_filled' | 'cancelled'
}

export interface AccountAsset {
  coin: string
  wallet_balance: string
  usd_value: string
  available_balance: string
}

export interface AccountOverview {
  source: 'mock' | 'bybit_private'
  mode: Mode
  account_type: string
  total_equity: string
  total_wallet_balance: string
  total_available_balance: string
  unrealised_pnl: string
  positions_count: number
  open_orders_count: number
  top_holdings: AccountAsset[]
  updated_at: string
}

export interface PositionRecord {
  source: 'mock' | 'bybit_private'
  symbol: string
  market: 'spot' | 'perp'
  side: 'long' | 'short'
  size: string
  avg_price: string
  mark_price: string
  value: string
  leverage: string
  unrealised_pnl: string
  updated_at: string
}

export interface OrderRecord {
  source: 'mock' | 'bybit_private'
  order_id: string
  symbol: string
  market: 'spot' | 'perp'
  side: 'buy' | 'sell'
  order_type: string
  qty: string
  price: string
  status: string
  created_at: string
}

export interface StrategyProposal {
  id: string
  proposal_type:
    | 'param_update'
    | 'pause_resume'
    | 'risk_update'
    | 'backtest_request'
    | 'script_patch_proposal'
    | 'publish_recommendation'
  strategy_id: string
  title: string
  description: string
  created_at: string
  status: 'pending' | 'accepted' | 'rejected' | 'testing'
  expected_impact: string
}

export interface ReviewDocument {
  id: string
  period: string
  title: string
  summary: string
  highlights: string[]
  risks: string[]
  proposals: StrategyProposal[]
  created_at: string
}

export interface ExecutionEvent {
  id: string
  event_type: string
  severity: Severity
  source: string
  symbol?: string | null
  strategy_id?: string | null
  payload: Record<string, unknown>
  trace_id: string
  occurred_at: string
}

export interface SettingsPayload {
  bybit_web_entry: string
  api_base_url: string
  openclaw_gateway_url: string
  openclaw_agent: string
  default_mode: Mode
  notification_channels: string[]
  product_language: string
}

export interface WorkspacePreferences {
  active_section: SectionKey
  layout_preset: LayoutPreset
  selected_mode: Mode
  selected_symbol: string
  selected_strategy_id?: string | null
  overview_card_order: string[]
  overview_visible_cards: string[]
  updated_at: string
}

export interface OpenClawStatus {
  configured: boolean
  gateway_url?: string | null
  auth_mode?: string | null
  default_agent?: string | null
  heartbeat?: string | null
  health_output?: string | null
  status_output?: string | null
  reachable: boolean
}

export interface BybitPrivateStatus {
  configured: boolean
  can_query_private: boolean
  source: 'env' | 'file' | 'none'
  api_base_url: string
  account_type: string
  mode: Mode
  key_hint?: string | null
  last_error?: string | null
  updated_at: string
}

export interface BybitTradeProbeResult {
  configured: boolean
  authenticated: boolean
  trade_permission?: boolean | null
  outcome:
    | 'not_configured'
    | 'validation_rejected'
    | 'permission_denied'
    | 'request_rejected'
    | 'accepted_unexpectedly'
    | 'network_error'
  detail: string
  ret_code?: number | null
  order_link_id?: string | null
  tested_at: string
}

export interface SchedulerPayload {
  scheduler: SchedulerState
  jobs: AgentJob[]
  change_requests: ChangeRequest[]
}

export interface ServiceHealth {
  ok: boolean
  service: string
  watchlist_count: number
  strategy_count: number
  openclaw_connected: boolean
}
