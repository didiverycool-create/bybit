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

export interface SchedulerCommandResult {
  status: string
  command: SchedulerCommandType
  freeze_publish?: boolean
  summary?: string
  scheduler_status?: SchedulerStatus
  job_id?: string | null
  strategy_id?: string | null
  review_id?: string | null
  review_title?: string | null
  review_period?: string | null
  linked_review_id?: string | null
  linked_review_title?: string | null
  linked_review_period?: string | null
  backtest_id?: string | null
  source_change_request_id?: string | null
  source_backtest_id?: string | null
  source_review_id?: string | null
  source_proposal_id?: string | null
  trigger_reason?: string | null
  decision_readiness?: string | null
  decision_readiness_detail?: string | null
  decision_recommended_data_range?: string | null
  decision_recommended_timeframe?: string | null
  decision_readiness_action?: string | null
  cancelled_job_ids?: string[]
  cancelled_job_count?: number
  cancelled_job_types?: string[]
  cancelled_strategy_ids?: string[]
  cancelled_backtest_ids?: string[]
  cancelled_source_change_request_ids?: string[]
  cancelled_source_backtest_ids?: string[]
  cancelled_source_review_ids?: string[]
  cancelled_source_proposal_ids?: string[]
  cancelled_trigger_reasons?: string[]
  cancelled_decision_readiness_values?: string[]
}

export interface LatestSchedulerCommand {
  command?: SchedulerCommandType | null
  summary: string
  impact_detail?: string | null
  job_id?: string | null
  strategy_id?: string | null
  linked_review_id?: string | null
  backtest_id?: string | null
  source_change_request_id?: string | null
  source_backtest_id?: string | null
  source_review_id?: string | null
  source_proposal_id?: string | null
  occurred_at: string
  severity: Severity
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
  latest_scheduler_command?: LatestSchedulerCommand | null
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
  source?: 'mock' | 'fallback' | 'bybit_rest' | 'bybit_ws'
  updated_at?: string | null
}

export interface MarketLiveSnapshot {
  selected_symbol: string
  watchlist: WatchlistInstrument[]
  detail: MarketDetail
  watchlist_details?: MarketDetail[]
  diagnostics: MarketLiveDiagnostics
  generated_at: string
}

export interface MarketLiveDiagnostics {
  requested_symbol: string
  effective_symbol: string
  timeframe: string
  selection_corrected: boolean
  detail_source: 'mock' | 'fallback' | 'bybit_rest' | 'bybit_ws'
  detail_candle_count: number
  watchlist_symbol_count: number
  watchlist_real_detail_count: number
  watchlist_fallback_detail_count: number
  watchlist_source_breakdown: Record<string, number>
  generated_in_ms: number
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
  latest_scheduler_command?: LatestSchedulerCommand | null
  generated_at: string
}

export interface StrategyParameter {
  key: string
  label: string
  value: string | number | boolean
  unit?: string | null
}

export interface PartialTakeProfit {
  trigger_pct: number
  exit_ratio: number
}

export interface VolatilityRegimeThresholds {
  low_pct: number
  high_pct: number
}

export interface RegimeExposureMultipliers {
  low: number
  normal: number
  high: number
}

export interface ConfidenceRegimeAdjustments {
  low: number
  normal: number
  high: number
}

export type StrategyKernel =
  | 'trend'
  | 'mean_revert'
  | 'breakout'
  | 'momentum'
  | 'bollinger_squeeze'
  | 'rsi_reversal'

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
  trailing_stop_pct?: number | null
  break_even_trigger_pct?: number | null
  partial_take_profits?: PartialTakeProfit[] | null
  volatility_sizing_enabled?: boolean
  volatility_lookback?: number | null
  volatility_target_pct?: number | null
  volatility_regime_thresholds?: VolatilityRegimeThresholds | null
  regime_exposure_multipliers?: RegimeExposureMultipliers | null
  confidence_calibration_enabled?: boolean
  confidence_regime_adjustments?: ConfidenceRegimeAdjustments | null
  confidence_parameter_drift_penalty?: number | null
  confidence_multi_timeframe_alignment?: boolean | null
  kernel?: StrategyKernel | null
  roc_window?: number | null
  ema_trend_window?: number | null
  momentum_threshold_pct?: number | null
  bollinger_window?: number | null
  bollinger_std?: number | null
  squeeze_bandwidth_pct?: number | null
  rsi_window?: number | null
  rsi_overbought?: number | null
  rsi_oversold?: number | null
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

export interface StrategyActivityLatestOpsSnapshot {
  latest_active_order?: string | null
  latest_historical_order?: string | null
  latest_order?: string | null
  latest_pending_alert?: string | null
  latest_trade?: string | null
  latest_alert?: string | null
  latest_audit_event?: string | null
  latest_active_order_record?: OrderRecord | null
  latest_historical_order_record?: OrderRecord | null
  latest_order_record?: OrderRecord | null
  latest_pending_alert_record?: AlertRecord | null
  latest_trade_record?: TradeRecord | null
  latest_alert_record?: AlertRecord | null
  latest_audit_event_record?: ExecutionEvent | null
}

export interface StrategyActivityLatestRuntimeSnapshot {
  runtime?: StrategyRuntimeSnapshot | null
  latest_ops?: StrategyActivityLatestOpsSnapshot | null
}

export interface StrategyActivityProposalDecisionContext {
  latest_backtest_record?: BacktestRun | null
  latest_review_record?: ReviewDocument | null
  latest_job_record?: AgentJob | null
  actionable_backtest_record?: BacktestRun | null
  actionable_review_record?: ReviewDocument | null
  actionable_job_record?: AgentJob | null
}

export interface StrategyActivityChangeRequestDecisionContext {
  latest_backtest_record?: BacktestRun | null
  latest_review_record?: ReviewDocument | null
  latest_job_record?: AgentJob | null
  latest_source_backtest_record?: BacktestRun | null
  latest_source_review_record?: ReviewDocument | null
  latest_source_proposal_record?: StrategyProposal | null
  actionable_backtest_record?: BacktestRun | null
  actionable_review_record?: ReviewDocument | null
  actionable_job_record?: AgentJob | null
  actionable_source_backtest_record?: BacktestRun | null
  actionable_source_review_record?: ReviewDocument | null
  actionable_source_proposal_record?: StrategyProposal | null
}

export interface StrategyActivityBacktestDecisionContext {
  latest_record?: BacktestRun | null
  actionable_record?: BacktestRun | null
  latest_review_record?: ReviewDocument | null
  latest_job_record?: AgentJob | null
  actionable_review_record?: ReviewDocument | null
  actionable_job_record?: AgentJob | null
}

export interface StrategyActivityReviewDecisionContext {
  latest_primary_record?: ReviewDocument | null
  latest_actionable_primary_record?: ReviewDocument | null
}

export interface StrategyActivityTrackingDecisionContext {
  latest_review_record?: ReviewDocument | null
  latest_job_record?: AgentJob | null
  latest_retryable_job_record?: AgentJob | null
}

export interface StrategyActivityDecisionContext {
  proposal?: StrategyActivityProposalDecisionContext | null
  change_request?: StrategyActivityChangeRequestDecisionContext | null
  backtest?: StrategyActivityBacktestDecisionContext | null
  review?: StrategyActivityReviewDecisionContext | null
  tracking?: StrategyActivityTrackingDecisionContext | null
}

export interface StrategyActivityProposalSection {
  latest?: StrategyProposal | null
  latest_actionable?: StrategyProposal | null
  latest_change_request?: ChangeRequest | null
  latest_backtest?: StrategyActivityBacktestSummary | null
  latest_review?: StrategyActivityReviewSummary | null
  latest_job?: StrategyActivityJobSummary | null
  latest_backtest_record?: BacktestRun | null
  latest_review_record?: ReviewDocument | null
  latest_job_record?: AgentJob | null
  latest_actionable_change_request?: ChangeRequest | null
  latest_actionable_backtest?: StrategyActivityBacktestSummary | null
  latest_actionable_review?: StrategyActivityReviewSummary | null
  latest_actionable_job?: StrategyActivityJobSummary | null
  latest_actionable_backtest_record?: BacktestRun | null
  latest_actionable_review_record?: ReviewDocument | null
  latest_actionable_job_record?: AgentJob | null
}

export interface StrategyActivityChangeRequestSection {
  latest?: ChangeRequest | null
  latest_actionable?: ChangeRequest | null
  latest_backtest_record?: BacktestRun | null
  latest_review_record?: ReviewDocument | null
  latest_job_record?: AgentJob | null
  latest_source_backtest_record?: BacktestRun | null
  latest_source_review_record?: ReviewDocument | null
  latest_source_proposal_record?: StrategyProposal | null
  latest_actionable_backtest_record?: BacktestRun | null
  latest_actionable_review_record?: ReviewDocument | null
  latest_actionable_job_record?: AgentJob | null
  latest_actionable_source_backtest_record?: BacktestRun | null
  latest_actionable_source_review_record?: ReviewDocument | null
  latest_actionable_source_proposal_record?: StrategyProposal | null
}

export interface StrategyActivityBacktestSection {
  latest?: StrategyActivityBacktestSummary | null
  latest_actionable?: StrategyActivityBacktestSummary | null
  latest_record?: BacktestRun | null
  latest_actionable_record?: BacktestRun | null
  latest_review?: StrategyActivityReviewSummary | null
  latest_job?: StrategyActivityJobSummary | null
  latest_actionable_review?: StrategyActivityReviewSummary | null
  latest_actionable_job?: StrategyActivityJobSummary | null
  latest_review_record?: ReviewDocument | null
  latest_job_record?: AgentJob | null
  latest_actionable_review_record?: ReviewDocument | null
  latest_actionable_job_record?: AgentJob | null
}

export interface StrategyActivityReviewSection {
  latest_primary?: StrategyActivityReviewSummary | null
  latest_actionable_primary?: StrategyActivityReviewSummary | null
  latest_tracking?: StrategyActivityReviewSummary | null
  latest_primary_record?: ReviewDocument | null
  latest_actionable_primary_record?: ReviewDocument | null
  latest_tracking_record?: ReviewDocument | null
}

export interface StrategyActivityTrackingSection {
  latest_review?: StrategyActivityReviewSummary | null
  latest_job?: StrategyActivityJobSummary | null
  latest_retryable_job?: StrategyActivityJobSummary | null
  latest_review_record?: ReviewDocument | null
  latest_job_record?: AgentJob | null
  latest_retryable_job_record?: AgentJob | null
}

export interface StrategyActivitySections {
  proposal?: StrategyActivityProposalSection | null
  change_request?: StrategyActivityChangeRequestSection | null
  backtest?: StrategyActivityBacktestSection | null
  review?: StrategyActivityReviewSection | null
  tracking?: StrategyActivityTrackingSection | null
}

export interface StrategyActivitySnapshotCore {
  strategy_id: string
  strategy_name: string
  symbol: string
  market: 'spot' | 'perp'
  mode: Mode
  runtime?: StrategyRuntimeSnapshot | null
  latest_runtime?: StrategyActivityLatestRuntimeSnapshot | null
  latest_ops?: StrategyActivityLatestOpsSnapshot | null
  decision_context?: StrategyActivityDecisionContext | null
  activity_sections?: StrategyActivitySections | null
}

export interface StrategyActivitySnapshotBacktestReviewFlatFields {
  latest_backtest?: StrategyActivityBacktestSummary | null
  latest_actionable_backtest?: StrategyActivityBacktestSummary | null
  latest_backtest_record?: BacktestRun | null
  latest_actionable_backtest_record?: BacktestRun | null
  latest_backtest_review?: StrategyActivityReviewSummary | null
  latest_backtest_job?: StrategyActivityJobSummary | null
  latest_actionable_backtest_review?: StrategyActivityReviewSummary | null
  latest_actionable_backtest_job?: StrategyActivityJobSummary | null
  latest_backtest_review_record?: ReviewDocument | null
  latest_backtest_job_record?: AgentJob | null
  latest_actionable_backtest_review_record?: ReviewDocument | null
  latest_actionable_backtest_job_record?: AgentJob | null
  latest_primary_review?: StrategyActivityReviewSummary | null
  latest_actionable_primary_review?: StrategyActivityReviewSummary | null
  latest_primary_review_record?: ReviewDocument | null
  latest_actionable_primary_review_record?: ReviewDocument | null
  latest_tracking_review?: StrategyActivityReviewSummary | null
  latest_tracking_job?: StrategyActivityJobSummary | null
  latest_tracking_review_record?: ReviewDocument | null
  latest_tracking_job_record?: AgentJob | null
  latest_retryable_tracking_job?: StrategyActivityJobSummary | null
  latest_retryable_tracking_job_record?: AgentJob | null
}

export interface StrategyActivitySnapshotProposalFlatFields {
  latest_proposal?: StrategyProposal | null
  latest_actionable_proposal?: StrategyProposal | null
  latest_proposal_change_request?: ChangeRequest | null
  latest_proposal_backtest?: StrategyActivityBacktestSummary | null
  latest_proposal_review?: StrategyActivityReviewSummary | null
  latest_proposal_job?: StrategyActivityJobSummary | null
  latest_proposal_backtest_record?: BacktestRun | null
  latest_proposal_review_record?: ReviewDocument | null
  latest_proposal_job_record?: AgentJob | null
  latest_actionable_proposal_change_request?: ChangeRequest | null
  latest_actionable_proposal_backtest?: StrategyActivityBacktestSummary | null
  latest_actionable_proposal_review?: StrategyActivityReviewSummary | null
  latest_actionable_proposal_job?: StrategyActivityJobSummary | null
  latest_actionable_proposal_backtest_record?: BacktestRun | null
  latest_actionable_proposal_review_record?: ReviewDocument | null
  latest_actionable_proposal_job_record?: AgentJob | null
}

export interface StrategyActivitySnapshotChangeRequestFlatFields {
  latest_change_request?: ChangeRequest | null
  latest_actionable_change_request?: ChangeRequest | null
  latest_change_request_backtest_record?: BacktestRun | null
  latest_change_request_review_record?: ReviewDocument | null
  latest_change_request_job_record?: AgentJob | null
  latest_change_request_source_backtest_record?: BacktestRun | null
  latest_change_request_source_review_record?: ReviewDocument | null
  latest_change_request_source_proposal_record?: StrategyProposal | null
  latest_actionable_change_request_backtest_record?: BacktestRun | null
  latest_actionable_change_request_review_record?: ReviewDocument | null
  latest_actionable_change_request_job_record?: AgentJob | null
  latest_actionable_change_request_source_backtest_record?: BacktestRun | null
  latest_actionable_change_request_source_review_record?: ReviewDocument | null
  latest_actionable_change_request_source_proposal_record?: StrategyProposal | null
}

export interface StrategyActivitySnapshotLineageFields
  extends StrategyActivitySnapshotBacktestReviewFlatFields,
    StrategyActivitySnapshotProposalFlatFields,
    StrategyActivitySnapshotChangeRequestFlatFields {}

export interface StrategyActivitySnapshotRecentCollections {
  recent_proposals: StrategyProposal[]
  recent_change_requests: ChangeRequest[]
  recent_backtests: StrategyActivityBacktestSummary[]
  recent_reviews: StrategyActivityReviewSummary[]
  active_orders: OrderRecord[]
  recent_orders: OrderRecord[]
  recent_trades: TradeRecord[]
  recent_alerts: AlertRecord[]
  recent_audit_events: ExecutionEvent[]
  recent_agent_jobs: StrategyActivityJobSummary[]
}

export interface StrategyActivitySnapshot
  extends StrategyActivitySnapshotCore,
    StrategyActivitySnapshotLineageFields,
    StrategyActivitySnapshotRecentCollections {
  generated_at: string
}

export interface StrategyActivityReviewSummary {
  id: string
  period: string
  backtest_id?: string | null
  source_job_id?: string | null
  source_job_type?: string | null
  source_job_status?: string | null
  source_change_request_id?: string | null
  source_backtest_id?: string | null
  source_review_id?: string | null
  source_proposal_id?: string | null
  trigger_reason?: string | null
  title: string
  summary: string
  proposal_count: number
  created_at: string
}

export interface StrategyActivityBacktestSummary
  extends Pick<
    BacktestRun,
    | 'id'
    | 'status'
    | 'timeframe'
    | 'data_range'
    | 'sample_quality'
    | 'history_source'
    | 'decision_readiness'
    | 'source_change_request_id'
    | 'source_backtest_id'
    | 'source_review_id'
    | 'source_proposal_id'
    | 'trigger_reason'
  > {
  created_at: string
  finished_at?: string | null
}

export interface StrategyActivityJobSummary {
  id: string
  job_type: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting'
  strategy_id?: string | null
  backtest_id?: string | null
  source_change_request_id?: string | null
  source_backtest_id?: string | null
  source_review_id?: string | null
  source_proposal_id?: string | null
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

export interface BacktestVolatilityStats {
  return_volatility_pct: number
  annualized_volatility_pct: number
  max_drawdown_duration_bars: number
  max_run_up_pct: number
  positive_bar_ratio_pct: number
}

export interface BacktestRiskRatios {
  sortino_ratio: number
  calmar_ratio: number
  profit_factor: number
  expectancy_pct: number
  worst_bar_return_pct: number
  best_bar_return_pct: number
}

export interface BacktestTradeRhythmStats {
  total_bars: number
  positive_bars: number
  negative_bars: number
  flat_bars: number
  win_loss_bar_ratio: number
  longest_winning_streak_bars: number
  longest_losing_streak_bars: number
  avg_positive_bar_return_pct: number
  avg_negative_bar_return_pct: number
  median_bar_return_pct: number
}

export interface BacktestBenchmarkStats {
  buy_hold_return_pct: number
  buy_hold_max_drawdown_pct: number
  strategy_over_buy_hold_pct: number
  alpha_pct: number
  correlation: number
  tracking_error_pct: number
}

export interface BacktestExposureStats {
  return_skew: number
  return_kurtosis: number
  ulcer_index_pct: number
  recovery_factor: number
  downside_deviation_pct: number
}

export interface BacktestTailRiskStats {
  var_95_pct: number
  cvar_95_pct: number
  tail_ratio: number
  gain_to_pain_ratio: number
}

export interface BacktestOrderFlowStats {
  avg_holding_bars: number
  trade_frequency_per_day: number
  turnover_rate_pct: number
  active_bar_ratio_pct: number
  avg_trade_notional: number
}

export interface BacktestTrade {
  side?: 'long' | 'short'
  entry_time?: string | null
  exit_time?: string | null
  entry_price?: number
  exit_price?: number
  pnl_pct?: number
  volatility_regime?: 'low' | 'normal' | 'high' | null
  applied_risk_per_trade?: number | null
}

export interface BacktestRun {
  id: string
  strategy_id: string
  strategy_name: string
  source_change_request_id?: string | null
  source_backtest_id?: string | null
  source_review_id?: string | null
  source_proposal_id?: string | null
  trigger_reason?: string | null
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
  reference_only: boolean
  sample_quality: 'reference_only' | 'low_sample' | 'sufficient'
  history_source?: 'exchange_history' | 'market_detail_fallback'
  history_source_reason?: 'none' | 'exchange_fetch_failed' | 'insufficient_exchange_samples'
  history_source_detail?: string | null
  history_source_recommended_data_range?: string | null
  history_source_recommended_timeframe?: string | null
  history_source_recommended_action?: string | null
  decision_readiness?: 'ready' | 'sample_incomplete' | 'research_only'
  decision_readiness_detail?: string
  decision_recommended_data_range?: string | null
  decision_recommended_timeframe?: string | null
  decision_readiness_action?: string | null
  requested_candle_estimate: number
  requested_candle_limit: number
  requested_range_start?: string | null
  requested_range_end?: string | null
  retrieved_window_completion_pct?: number
  used_window_completion_pct?: number
  retrieved_candle_count: number
  used_candle_count: number
  retrieved_range_start?: string | null
  retrieved_range_end?: string | null
  used_range_start?: string | null
  used_range_end?: string | null
  history_truncated: boolean
  history_gap_reason?: 'none' | 'sample_cap' | 'insufficient_history'
  full_window_recommended_data_range?: string | null
  full_window_recommended_timeframe?: string | null
  full_window_recommended_action?: string | null
  volatility_stats?: BacktestVolatilityStats | null
  risk_ratios?: BacktestRiskRatios | null
  trade_rhythm_stats?: BacktestTradeRhythmStats | null
  benchmark_stats?: BacktestBenchmarkStats | null
  exposure_stats?: BacktestExposureStats | null
  tail_risk_stats?: BacktestTailRiskStats | null
  order_flow_stats?: BacktestOrderFlowStats | null
  trades?: BacktestTrade[] | null
  notes: string
}

export interface ChangeRequest {
  id: string
  type: string
  payload: Record<string, unknown>
  requested_by: string
  source_backtest_id?: string | null
  source_review_id?: string | null
  source_proposal_id?: string | null
  trigger_reason?: string | null
  manual_followup_required?: boolean
  manual_followup_detail?: string | null
  target_mode: Mode
  priority: 'low' | 'normal' | 'high' | 'critical'
  status: ChangeRequestStatus
  correlation_id: string
  linked_backtest_id?: string | null
  linked_backtest_timeframe?: string | null
  linked_backtest_data_range?: string | null
  linked_backtest_sample_quality?: 'reference_only' | 'low_sample' | 'sufficient' | null
  linked_backtest_decision_readiness?: 'ready' | 'sample_incomplete' | 'research_only' | null
  linked_backtest_decision_readiness_detail?: string | null
  linked_backtest_decision_recommended_data_range?: string | null
  linked_backtest_decision_recommended_timeframe?: string | null
  linked_backtest_decision_readiness_action?: string | null
  linked_backtest_history_source?: 'exchange_history' | 'market_detail_fallback' | null
  linked_backtest_history_source_reason?: 'none' | 'exchange_fetch_failed' | 'insufficient_exchange_samples' | null
  linked_backtest_history_source_detail?: string | null
  linked_backtest_history_source_recommended_data_range?: string | null
  linked_backtest_history_source_recommended_timeframe?: string | null
  linked_backtest_history_source_recommended_action?: string | null
  linked_backtest_requested_candle_estimate?: number
  linked_backtest_requested_candle_limit?: number
  linked_backtest_requested_range_start?: string | null
  linked_backtest_requested_range_end?: string | null
  linked_backtest_retrieved_window_completion_pct?: number
  linked_backtest_used_window_completion_pct?: number
  linked_backtest_retrieved_candle_count?: number
  linked_backtest_used_candle_count?: number
  linked_backtest_retrieved_range_start?: string | null
  linked_backtest_retrieved_range_end?: string | null
  linked_backtest_used_range_start?: string | null
  linked_backtest_used_range_end?: string | null
  linked_backtest_history_truncated?: boolean | null
  linked_backtest_history_gap_reason?: 'none' | 'sample_cap' | 'insufficient_history' | null
  linked_backtest_full_window_recommended_data_range?: string | null
  linked_backtest_full_window_recommended_timeframe?: string | null
  linked_backtest_full_window_recommended_action?: string | null
  follow_up_job_id?: string | null
  follow_up_job_type?: string | null
  follow_up_job_status?: AgentJob['status'] | null
  follow_up_result_summary?: string | null
  linked_review_id?: string | null
  linked_review_title?: string | null
  linked_review_period?: string | null
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
  backtest_id?: string | null
  source_change_request_id?: string | null
  source_backtest_id?: string | null
  source_review_id?: string | null
  source_proposal_id?: string | null
  trigger_reason?: string | null
  source_job_id?: string | null
  source_job_type?: string | null
  source_job_status?: string | null
  decision_readiness?: 'ready' | 'sample_incomplete' | 'research_only' | null
  decision_readiness_detail?: string | null
  decision_recommended_data_range?: string | null
  decision_recommended_timeframe?: string | null
  decision_readiness_action?: string | null
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
  summary?: string | null
  impact_detail?: string | null
  priority?: number | null
  is_key_event?: boolean | null
  trace_id: string
  occurred_at: string
}

export interface ExecutionImpactRecord {
  id: string
  strategy_id: string
  strategy_name: string
  window_start: string
  window_end: string
  summary: string
  impact_level: 'negligible' | 'moderate' | 'significant'
  direction: 'improved' | 'neutral' | 'worsened'
  affected_orders: string[]
  affected_positions: string[]
  metrics_deltas: string[]
  follow_up_checks: string[]
  raw_text: string
  agent_job_id?: string | null
  source: string
  created_at: string
  updated_at: string
}

export interface ExecutionImpactSummarizeRequest {
  strategy_id: string
  strategy_name: string
  window_start: string
  window_end: string
  order_count: number
  fill_count: number
  total_notional: number
  slippage_bps: number
  expected_pnl: number
  realized_pnl: number
  anomalies?: string[]
  requested_by?: string
}

export interface SettingsPayload {
  bybit_web_entry: string
  api_base_url: string
  openclaw_gateway_url: string
  openclaw_agent: string
  default_mode: Mode
  notification_channels: string[]
  notification_quiet_hours_enabled: boolean
  notification_quiet_hours_start: string
  notification_quiet_hours_end: string
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
  selected_backtest_id?: string | null
  selected_scheduler_job_id?: string | null
  selected_strategy_detail_panel?: 'activity' | 'tracking' | 'editor' | null
  selected_strategy_tracking_kind?: 'issue' | 'change' | null
  selected_strategy_tracking_summary?: string
  selected_strategy_tracking_detail?: string
  selected_strategy_editor_strategy_id?: string | null
  selected_strategy_editor_parameter_drafts?: Record<string, string>
  selected_strategy_editor_risk_budget_draft?: string
  selected_review_inspector_id?: string | null
  selected_review_inspector_strategy_id?: string | null
  selected_review_id?: string | null
  selected_proposal_id?: string | null
  selected_change_request_id?: string | null
  backtest_filter: 'selected' | 'all'
  replay_tracking_scope: 'all' | 'selected'
  alert_severity_filter: 'all' | 'P0' | 'P1' | 'P2'
  alert_status_filter: 'all' | 'pending' | 'acknowledged'
  alert_scope_filter: 'all' | 'selected'
  trade_mode_filter: 'all' | Mode
  trade_origin_filter: 'all' | 'manual' | 'strategy' | 'exchange'
  trade_scope_filter: 'all' | 'selected'
  audit_severity_filter: 'all' | 'info' | 'warning' | 'error' | 'critical'
  audit_source_filter: string
  audit_scope_filter: 'all' | 'selected'
  audit_search: string
  overview_card_order: string[]
  overview_visible_cards: string[]
  overview_collapsed_cards: string[]
  updated_at: string
}

export interface OpenClawStatus {
  configured: boolean
  config_path?: string | null
  config_exists?: boolean
  command_available?: boolean
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
  config_path?: string | null
  config_exists?: boolean
  example_config_path?: string | null
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
  latest_scheduler_command?: LatestSchedulerCommand | null
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
