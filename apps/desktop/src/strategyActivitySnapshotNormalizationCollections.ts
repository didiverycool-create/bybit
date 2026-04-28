import type { StrategyActivitySnapshot } from './types'

type RecentCollectionsKey =
  | 'recent_proposals'
  | 'recent_change_requests'
  | 'recent_backtests'
  | 'recent_reviews'
  | 'active_orders'
  | 'recent_orders'
  | 'recent_trades'
  | 'recent_alerts'
  | 'recent_audit_events'
  | 'recent_agent_jobs'

export function normalizeStrategyActivityRecentCollections(
  activity: StrategyActivitySnapshot,
): Pick<StrategyActivitySnapshot, RecentCollectionsKey> {
  return {
    recent_proposals: Array.isArray(activity.recent_proposals) ? activity.recent_proposals : [],
    recent_change_requests: Array.isArray(activity.recent_change_requests)
      ? activity.recent_change_requests
      : [],
    recent_backtests: Array.isArray(activity.recent_backtests) ? activity.recent_backtests : [],
    recent_reviews: Array.isArray(activity.recent_reviews) ? activity.recent_reviews : [],
    active_orders: Array.isArray(activity.active_orders) ? activity.active_orders : [],
    recent_orders: Array.isArray(activity.recent_orders) ? activity.recent_orders : [],
    recent_trades: Array.isArray(activity.recent_trades) ? activity.recent_trades : [],
    recent_alerts: Array.isArray(activity.recent_alerts) ? activity.recent_alerts : [],
    recent_audit_events: Array.isArray(activity.recent_audit_events) ? activity.recent_audit_events : [],
    recent_agent_jobs: Array.isArray(activity.recent_agent_jobs) ? activity.recent_agent_jobs : [],
  }
}
