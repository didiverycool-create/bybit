import type { AlertRecord, ExecutionEvent, OrderRecord, TradeRecord } from '../types'
import {
  getAuditBacktestId,
  getAuditChangeRequestId,
  getAuditJobId,
  getAuditLinkedReviewId,
  getAuditSourceBacktestId,
  getAuditSourceProposalId,
  getAuditSourceReviewId,
  getAuditStrategyId,
  pickLatestKeyAuditEvent,
} from '../utils/app-helpers'
import type { StrategyActivityCollections } from './strategyActivitySelectorCollections'
import type { StrategyActivityOpsSources } from './strategyActivitySelectorOps'

type ResolveStrategyActivityLatestOpsStateArgs = {
  strategyId: string | null
  collections: Pick<
    StrategyActivityCollections,
    'recentAlerts' | 'recentAuditEvents' | 'recentOrders' | 'recentTrades'
  >
  opsSources: Pick<
    StrategyActivityOpsSources,
    | 'latestAlertRecord'
    | 'latestPendingAlertRecord'
    | 'latestAuditEventRecord'
    | 'latestHistoricalOrderRecord'
    | 'latestOrderRecord'
    | 'latestTradeRecord'
  >
}

export function resolveStrategyActivityLatestOpsState({
  strategyId,
  collections,
  opsSources,
}: ResolveStrategyActivityLatestOpsStateArgs) {
  const strategyActivityAlerts = collections.recentAlerts as AlertRecord[]
  const strategyActivityAuditEvents = collections.recentAuditEvents as ExecutionEvent[]
  const strategyActivityOrders = collections.recentOrders as OrderRecord[]
  const strategyActivityTrades = collections.recentTrades as TradeRecord[]
  const {
    latestAlertRecord,
    latestPendingAlertRecord,
    latestAuditEventRecord,
    latestHistoricalOrderRecord,
    latestOrderRecord,
    latestTradeRecord,
  } = opsSources
  const activityLatestAuditEvent =
    latestAuditEventRecord ??
    pickLatestKeyAuditEvent(strategyActivityAuditEvents) ??
    strategyActivityAuditEvents[0] ??
    null
  const activityLatestAlert = strategyActivityAlerts[0] ?? latestAlertRecord ?? null
  const activityLatestPendingAlert =
    latestPendingAlertRecord ??
    strategyActivityAlerts.find((alert) => !alert.acknowledged) ??
    null
  const activityLatestHistoricalOrder =
    strategyActivityOrders[0] ?? latestHistoricalOrderRecord ?? null
  const activityLatestOrder = latestOrderRecord ?? activityLatestHistoricalOrder ?? null
  const activityLatestTrade = strategyActivityTrades[0] ?? latestTradeRecord ?? null
  const activityLatestAuditStrategyId =
    (activityLatestAuditEvent ? getAuditStrategyId(activityLatestAuditEvent.payload) : null) ??
    strategyId ??
    null

  return {
    activityLatestAuditEvent,
    activityLatestAlert,
    activityLatestPendingAlert,
    activityLatestHistoricalOrder,
    activityLatestOrder,
    activityLatestTrade,
    activityLatestAuditStrategyId,
    activityLatestAuditJobId: activityLatestAuditEvent ? getAuditJobId(activityLatestAuditEvent.payload) : null,
    activityLatestAuditLinkedReviewId: activityLatestAuditEvent
      ? getAuditLinkedReviewId(activityLatestAuditEvent.payload)
      : null,
    activityLatestAuditChangeRequestId: activityLatestAuditEvent
      ? getAuditChangeRequestId(activityLatestAuditEvent.payload)
      : null,
    activityLatestAuditBacktestId: activityLatestAuditEvent
      ? getAuditBacktestId(activityLatestAuditEvent.payload)
      : null,
    activityLatestAuditSourceBacktestId: activityLatestAuditEvent
      ? getAuditSourceBacktestId(activityLatestAuditEvent.payload)
      : null,
    activityLatestAuditSourceReviewId: activityLatestAuditEvent
      ? getAuditSourceReviewId(activityLatestAuditEvent.payload)
      : null,
    activityLatestAuditSourceProposalId: activityLatestAuditEvent
      ? getAuditSourceProposalId(activityLatestAuditEvent.payload)
      : null,
  }
}
