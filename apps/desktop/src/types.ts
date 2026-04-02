export type SectionKey =
  | 'overview'
  | 'settings'
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

export interface ExecutionHealthSummary {
  runtime_worker_running: boolean
  runtime_worker_issue: boolean
  runtime_worker_stale: boolean
  runtime_worker_stopped: boolean
  runtime_stale_seconds: number
  runtime_last_refresh_at?: string | null
  runtime_last_error?: string | null
  public_execution_channel_issue: boolean
  public_execution_stale: boolean
  public_execution_stale_seconds: number
  active_stop_loss_guards: number
  cooldowns: number
  auto_dispatch_blocked: number
  rejection_guards: number
  stale_order_guards: number
  drifts: number
  top_issue?: string | null
  top_issue_strategy_id?: string | null
  top_issue_strategy_name?: string | null
  top_issue_symbol?: string | null
  top_issue_detail?: string | null
  top_issue_recommended_action?: string | null
}

export interface RuntimeWorkerActionResult {
  running: boolean
  restarted_at: string
  last_error?: string | null
  last_refresh_at?: string | null
  message: string
}

export interface RuntimeWorkerStatus {
  running: boolean
  started_once: boolean
  issue: boolean
  stale: boolean
  stopped: boolean
  stale_seconds: number
  last_refresh_at?: string | null
  last_error?: string | null
  top_issue?: string | null
  recommended_action?: string | null
  generated_at: string
}

export interface ControlSnapshot {
  account_metrics: MetricCard[]
  risk_metrics: MetricCard[]
  strategy_metrics: MetricCard[]
  scheduler: SchedulerState
  alerts_summary: Record<string, number>
  pending_tasks: TaskSummary[]
  today_performance: Record<string, string>
  execution_health: ExecutionHealthSummary
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
  alert_enabled: boolean
  alert_threshold_pct: number
}

export interface WatchlistRemoveResult {
  symbol: string
  removed: boolean
  updated_at: string
  next_selected_symbol?: string | null
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

export interface MarketRecentTrade {
  side: 'buy' | 'sell'
  price: number
  size: number
  value: number
  occurred_at: string
  is_block_trade?: boolean
}

export interface MarketDetail {
  symbol: string
  market: 'spot' | 'perp'
  timeframe: string
  candles: CandlePoint[]
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  recent_public_trades: MarketRecentTrade[]
  headline: string
  stats: Record<string, string>
  source?: 'mock' | 'bybit_rest' | 'bybit_ws'
  updated_at?: string | null
}

export interface MarketLiveSnapshot {
  selected_symbol: string
  watchlist: WatchlistInstrument[]
  detail: MarketDetail
  generated_at: string
}

export interface OpsLiveSummary {
  pending_alerts: number
  p0_alerts: number
  recent_trades: number
  manual_trades: number
  strategy_trades: number
  audit_warnings: number
  audit_critical: number
  execution_issue_total: number
  execution_top_issue?: string | null
  execution_top_issue_strategy_id?: string | null
  execution_top_issue_strategy_name?: string | null
  execution_top_issue_symbol?: string | null
  execution_top_issue_detail?: string | null
  latest_event_type?: string | null
}

export interface OpsLiveSnapshot {
  summary: OpsLiveSummary
  alerts: AlertRecord[]
  trades: TradeRecord[]
  audit_events: ExecutionEvent[]
  generated_at: string
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

export interface StrategyRuntimeSnapshot {
  strategy_id: string
  strategy_name: string
  symbol: string
  market: 'spot' | 'perp'
  mode: Mode
  runtime_status: 'running' | 'paused' | 'paper_only' | 'shadow'
  signal: 'long' | 'short' | 'flat' | 'watch'
  confidence: number
  last_price: number
  reference_price: number
  change_24h: number
  note: string
  next_action: string
  guard_state: 'none' | 'live_stop_loss' | 'cooldown' | 'auto_dispatch_blocked'
  guard_detail?: string | null
  active_order_count: number
  active_order?: OrderRecord | null
  current_position_side: 'flat' | 'long' | 'short'
  current_position_size?: string | null
  current_position_avg_price?: string | null
  target_position_side: 'flat' | 'long' | 'short'
  target_position_size?: string | null
  position_alignment: 'aligned' | 'reconciling' | 'drifted' | 'unknown'
  position_alignment_detail?: string | null
  last_execution_event_type?: string | null
  last_execution_at?: string | null
  last_execution_severity?: 'info' | 'warning' | 'error' | 'critical' | null
  last_execution_detail?: string | null
  last_evaluated_at: string
  last_trade_id?: string | null
  last_trade_at?: string | null
  execution_preview?: ExecutionPreview | null
}

export interface StrategyLiveSnapshot {
  items: StrategyRuntimeSnapshot[]
  generated_at: string
}

export interface StrategyActivitySnapshot {
  strategy_id: string
  strategy_name: string
  symbol: string
  market: 'spot' | 'perp'
  mode: Mode
  runtime?: StrategyRuntimeSnapshot | null
  latest_primary_review?: StrategyActivityReviewSummary | null
  latest_tracking_review?: StrategyActivityReviewSummary | null
  latest_tracking_job?: StrategyActivityJobSummary | null
  recent_reviews: StrategyActivityReviewSummary[]
  active_orders: OrderRecord[]
  recent_orders: OrderRecord[]
  recent_trades: TradeRecord[]
  recent_alerts: AlertRecord[]
  recent_audit_events: ExecutionEvent[]
  recent_agent_jobs: StrategyActivityJobSummary[]
  generated_at: string
}

export interface StrategyActivityReviewSummary {
  id: string
  period: string
  title: string
  summary: string
  proposal_count: number
  created_at: string
}

export interface StrategyActivityJobSummary {
  id: string
  job_type: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting'
  strategy_id?: string | null
  requested_by?: string | null
  result_summary?: string | null
  linked_review_id?: string | null
  linked_review_title?: string | null
  linked_review_period?: string | null
  writeback_target: string
  created_at: string
  updated_at: string
  retry_count?: number
  retried_from_job_id?: string | null
}

export interface StrategyExecutionResult {
  kind: 'paper_trade' | 'exchange_order'
  strategy_id: string
  mode: Mode
  preview: ExecutionPreview
  message: string
  trade?: TradeRecord | null
  order?: OrderRecord | null
  generated_at: string
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
  strategy_id?: string | null
  allowed_actions: string[]
  timeout: number
  idempotency_key: string
  writeback_target: string
  status: 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  updated_at: string
  result_summary?: string | null
  linked_review_id?: string | null
  linked_review_title?: string | null
  linked_review_period?: string | null
  retried_from_job_id?: string | null
  retry_count?: number
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
  source_type?: 'rule' | 'news' | 'backtest' | 'system'
  rule_id?: string | null
  rule_key?: string | null
  trigger_value?: number | null
  threshold_value?: number | null
}

export interface AlertRule {
  id: string
  symbol: string
  market: 'spot' | 'perp'
  rule_type: 'price_change_pct'
  threshold_pct: number
  enabled: boolean
  cooldown_minutes: number
  created_at: string
  updated_at: string
  last_triggered_at?: string | null
  last_triggered_change_24h?: number | null
  rule_key?: string | null
}

export interface NewsEvent {
  id: string
  source: string
  title: string
  summary: string
  url?: string | null
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
  origin: 'manual' | 'strategy' | 'exchange'
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
  source: 'mock' | 'paper' | 'bybit_private'
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

export interface AccountLiveSnapshot {
  overview: AccountOverview
  positions: PositionRecord[]
  orders: OrderRecord[]
  order_history: OrderRecord[]
  generated_at: string
}

export interface PositionRecord {
  source: 'mock' | 'paper' | 'bybit_private'
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
  source: 'mock' | 'paper' | 'bybit_private'
  origin: 'manual' | 'strategy'
  strategy_id?: string | null
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

export interface ExchangePositionBulkCloseResult {
  submitted_count: number
  order_ids: string[]
  requested_by: string
  updated_at: string
}

export interface ExecutionPreview {
  symbol: string
  market: 'spot' | 'perp'
  mode: Mode
  side: 'buy' | 'sell'
  origin: 'manual' | 'strategy'
  strategy_id?: string | null
  quantity: number
  price: number
  notional: string
  action: string
  allowed: boolean
  blocked_reason?: string | null
  recommended_action?: string | null
  sizing_risk_budget?: string | null
  sizing_budget_notional?: string | null
  sizing_minimum_required_notional?: string | null
  sizing_available_balance_gap?: string | null
  warnings: string[]
  current_position_side: 'flat' | 'long' | 'short'
  current_position_size: string
  current_avg_price: string
  projected_position_side: 'flat' | 'long' | 'short'
  projected_position_size: string
  projected_avg_price: string
  available_balance_before: string
  available_balance_after: string
  estimated_realized_pnl: string
  generated_at: string
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
  payload: Record<string, unknown>
}

export interface StrategyProposalActionResult {
  proposal: StrategyProposal
  created_change_request?: ChangeRequest | null
  created_backtest?: BacktestRun | null
}

export interface ReviewDocument {
  id: string
  period: string
  strategy_id?: string | null
  source_job_id?: string | null
  source_job_type?: string | null
  source_job_status?: string | null
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
  grafana_base_url?: string | null
  grafana_dashboard_uid?: string | null
  grafana_org_id?: number
  grafana_theme?: 'dark' | 'light'
}

export interface GrafanaIntegrationStatus {
  configured: boolean
  base_url?: string | null
  dashboard_uid?: string | null
  org_id: number
  theme: 'dark' | 'light'
  metrics_path: string
  dashboard_url?: string | null
  recommended_scope: 'ops_monitoring_only'
  note: string
}

export interface WorkspacePreferences {
  active_section: SectionKey
  layout_preset: LayoutPreset
  selected_mode: Mode
  selected_symbol: string
  selected_market_timeframe: '15m' | '1h' | '4h' | '1d'
  selected_strategy_id?: string | null
  overview_card_order: string[]
  overview_visible_cards: string[]
  overview_collapsed_cards: string[]
  updated_at: string
}

export interface OpenClawStatus {
  configured: boolean
  gateway_url?: string | null
  auth_mode?: string | null
  default_agent?: string | null
  resolved_agent?: string | null
  heartbeat?: string | null
  health_output?: string | null
  status_output?: string | null
  reachable: boolean
  worker_running?: boolean
  active_job_id?: string | null
  last_worker_event_at?: string | null
  last_job_id?: string | null
  last_job_status?: string | null
  last_job_summary?: string | null
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
  realtime_enabled?: boolean
  realtime_connected?: boolean
  realtime_authenticated?: boolean
  realtime_last_message_at?: string | null
  realtime_stale?: boolean
  realtime_stale_seconds?: number
  realtime_last_error?: string | null
  realtime_recommended_action?: string | null
  usdt_balance_diagnostics?: BybitBalanceDiagnostic[]
  updated_at: string
}

export interface BybitBalanceDiagnostic {
  account_type: string
  coin: string
  wallet_balance: string
  transfer_balance: string
  available_balance: string
  source: 'coin-balance' | 'wallet-balance' | 'error'
  error?: string | null
}

export interface BybitPublicSymbolDiagnostic {
  symbol: string
  market: 'spot' | 'perp'
  channel: 'spot' | 'linear'
  connected: boolean
  has_symbol_feed: boolean
  stale: boolean
  stale_seconds: number
  last_message_at?: string | null
  issue?: string | null
  recommended_action?: string | null
}

export interface BybitPublicStatus {
  enabled: boolean
  connected_spot?: boolean
  connected_linear?: boolean
  spot_stale?: boolean
  spot_stale_seconds?: number
  linear_stale?: boolean
  linear_stale_seconds?: number
  last_message_at_spot?: string | null
  last_message_at_linear?: string | null
  last_message_at?: string | null
  last_error?: string | null
  rest_reachable?: boolean | null
  rest_last_error?: string | null
  rest_tested_at?: string | null
  recommended_action?: string | null
  watched_symbol_diagnostics?: BybitPublicSymbolDiagnostic[]
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

export interface AiLiveSnapshot extends SchedulerPayload {
  activity_feed: ExecutionEvent[]
  generated_at: string
}

export interface ServiceHealth {
  ok: boolean
  service: string
  watchlist_count: number
  strategy_count: number
  openclaw_connected: boolean
}
