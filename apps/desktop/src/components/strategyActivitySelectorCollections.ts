import type {
  AlertRecord,
  ChangeRequest,
  ExecutionEvent,
  OrderRecord,
  StrategyActivityBacktestSummary,
  StrategyActivityJobSummary,
  StrategyActivityReviewSummary,
  StrategyActivitySnapshot,
  TradeRecord,
  StrategyProposal,
} from '../types'

export type StrategyActivityCollections = {
  recentProposals: StrategyProposal[]
  recentChangeRequests: ChangeRequest[]
  recentBacktests: StrategyActivityBacktestSummary[]
  recentReviews: StrategyActivityReviewSummary[]
  recentAgentJobs: StrategyActivityJobSummary[]
  recentAlerts: AlertRecord[]
  recentAuditEvents: ExecutionEvent[]
  recentOrders: OrderRecord[]
  recentTrades: TradeRecord[]
  activeOrders: OrderRecord[]
}

export function resolveStrategyActivityCollections(
  activity?: StrategyActivitySnapshot | null,
): StrategyActivityCollections {
  return {
    recentProposals: activity?.recent_proposals ?? [],
    recentChangeRequests: activity?.recent_change_requests ?? [],
    recentBacktests: activity?.recent_backtests ?? [],
    recentReviews: activity?.recent_reviews ?? [],
    recentAgentJobs: activity?.recent_agent_jobs ?? [],
    recentAlerts: activity?.recent_alerts ?? [],
    recentAuditEvents: activity?.recent_audit_events ?? [],
    recentOrders: activity?.recent_orders ?? [],
    recentTrades: activity?.recent_trades ?? [],
    activeOrders: activity?.active_orders ?? [],
  }
}
