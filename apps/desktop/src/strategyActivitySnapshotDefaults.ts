import type {
  AlertRecord,
  ExecutionEvent,
  OrderRecord,
  StrategyActivityLatestOpsSnapshot,
  StrategyActivitySnapshotLineageFields,
  StrategyActivitySnapshotRecentCollections,
  TradeRecord,
} from './types'

export function buildEmptyStrategyActivityLineageFields(): StrategyActivitySnapshotLineageFields {
  return {
    latest_backtest: null,
    latest_actionable_backtest: null,
    latest_backtest_record: null,
    latest_actionable_backtest_record: null,
    latest_backtest_review: null,
    latest_backtest_job: null,
    latest_actionable_backtest_review: null,
    latest_actionable_backtest_job: null,
    latest_backtest_review_record: null,
    latest_backtest_job_record: null,
    latest_actionable_backtest_review_record: null,
    latest_actionable_backtest_job_record: null,
    latest_primary_review: null,
    latest_actionable_primary_review: null,
    latest_primary_review_record: null,
    latest_actionable_primary_review_record: null,
    latest_tracking_review: null,
    latest_tracking_job: null,
    latest_tracking_review_record: null,
    latest_tracking_job_record: null,
    latest_retryable_tracking_job: null,
    latest_retryable_tracking_job_record: null,
    latest_proposal: null,
    latest_actionable_proposal: null,
    latest_proposal_change_request: null,
    latest_proposal_backtest: null,
    latest_proposal_review: null,
    latest_proposal_job: null,
    latest_proposal_backtest_record: null,
    latest_proposal_review_record: null,
    latest_proposal_job_record: null,
    latest_actionable_proposal_change_request: null,
    latest_actionable_proposal_backtest: null,
    latest_actionable_proposal_review: null,
    latest_actionable_proposal_job: null,
    latest_actionable_proposal_backtest_record: null,
    latest_actionable_proposal_review_record: null,
    latest_actionable_proposal_job_record: null,
    latest_change_request: null,
    latest_actionable_change_request: null,
    latest_change_request_backtest_record: null,
    latest_change_request_review_record: null,
    latest_change_request_job_record: null,
    latest_change_request_source_backtest_record: null,
    latest_change_request_source_review_record: null,
    latest_change_request_source_proposal_record: null,
    latest_actionable_change_request_backtest_record: null,
    latest_actionable_change_request_review_record: null,
    latest_actionable_change_request_job_record: null,
    latest_actionable_change_request_source_backtest_record: null,
    latest_actionable_change_request_source_review_record: null,
    latest_actionable_change_request_source_proposal_record: null,
  }
}

export function buildEmptyStrategyActivityLatestOpsSnapshot(): StrategyActivityLatestOpsSnapshot {
  return {
    latest_active_order: null,
    latest_historical_order: null,
    latest_order: null,
    latest_pending_alert: null,
    latest_trade: null,
    latest_alert: null,
    latest_active_order_record: null,
    latest_historical_order_record: null,
    latest_order_record: null,
    latest_pending_alert_record: null,
    latest_trade_record: null,
    latest_alert_record: null,
    latest_audit_event: null,
    latest_audit_event_record: null,
  }
}

type BuildFallbackStrategyActivityRecentCollectionsArgs = {
  strategyId: string
  orders: OrderRecord[]
  trades: TradeRecord[]
  alerts: AlertRecord[]
  audit: ExecutionEvent[]
}

export function buildFallbackStrategyActivityRecentCollections({
  strategyId,
  orders,
  trades,
  alerts,
  audit,
}: BuildFallbackStrategyActivityRecentCollectionsArgs): StrategyActivitySnapshotRecentCollections {
  return {
    recent_proposals: [],
    recent_change_requests: [],
    recent_backtests: [],
    recent_reviews: [],
    active_orders: orders.filter((item) => item.origin === 'strategy').slice(0, 6),
    recent_orders: orders.filter((item) => item.origin === 'strategy').slice(0, 8),
    recent_trades: trades.filter((item) => item.origin === 'strategy').slice(0, 8),
    recent_alerts: alerts.filter((item) => item.source_type === 'system').slice(0, 6),
    recent_audit_events: audit
      .filter((item) => item.strategy_id === strategyId || item.event_type.startsWith('strategy.'))
      .slice(0, 12),
    recent_agent_jobs: [],
  }
}
