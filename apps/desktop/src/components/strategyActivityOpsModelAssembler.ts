import type { AlertRecord, ExecutionEvent, Mode, OrderRecord, TradeRecord } from '../types'
import {
  buildStrategyActivityOpsCollections,
  buildStrategyActivityOpsSupplementedFlags,
  resolveStrategyActivityActiveOrderState,
  resolveStrategyActivityLatestOpsState,
} from './strategyActivityOpsModelHelpers'
import type { StrategyActivityCollections } from './strategyActivitySelectorCollections'
import type {
  StrategyActivityOpsSources,
  StrategyActivityOpsSummaries,
} from './strategyActivitySelectorOps'

type BuildStrategyActivityOpsModelStateArgs = {
  strategyId: string | null
  selectedMode: Mode
  collections: Pick<
    StrategyActivityCollections,
    'recentAlerts' | 'recentAuditEvents' | 'recentOrders' | 'recentTrades' | 'activeOrders'
  >
  opsSources: StrategyActivityOpsSources
  opsSummaries: StrategyActivityOpsSummaries
}

type StrategyActivityOpsModelState = {
  strategyActivityAlerts: AlertRecord[]
  strategyActivityAuditEvents: ExecutionEvent[]
  strategyActivityOrders: OrderRecord[]
  strategyActivityTrades: TradeRecord[]
  strategyActivityActiveOrders: OrderRecord[]
  strategyActivityLatestAlertSupplemented: boolean
  strategyActivityLatestPendingAlertSupplemented: boolean
  strategyActivityLatestAuditSupplemented: boolean
  strategyActivityLatestHistoricalOrderSupplemented: boolean
  strategyActivityLatestTradeSupplemented: boolean
  strategyActivityLatestActiveOrderSupplemented: boolean
  activityLatestAuditEvent: ExecutionEvent | null
  activityLatestAlert: AlertRecord | null
  activityLatestPendingAlert: AlertRecord | null
  activityLatestHistoricalOrder: OrderRecord | null
  activityLatestOrder: OrderRecord | null
  activityLatestTrade: TradeRecord | null
  activityLatestAuditSummary: string | null
  activityLatestAlertSummary: string | null
  activityLatestPendingAlertSummary: string | null
  activityLatestOrderSummary: string | null
  activityLatestHistoricalOrderSummary: string | null
  activityLatestTradeSummary: string | null
  activityLatestAuditStrategyId: string | null
  activityLatestAuditJobId: string | null
  activityLatestAuditLinkedReviewId: string | null
  activityLatestAuditChangeRequestId: string | null
  activityLatestAuditBacktestId: string | null
  activityLatestAuditSourceBacktestId: string | null
  activityLatestAuditSourceReviewId: string | null
  activityLatestAuditSourceProposalId: string | null
  activityLatestActiveOrderRecord: OrderRecord | null
  activityLatestActiveOrder: OrderRecord | null
  activityLatestActiveOrderSummary: string | null
  activityLatestActiveOrderEditable: boolean
  activityLatestActiveOrderCancellable: boolean
  activityLatestActiveOrderDiffersFromLatest: boolean
  activityLatestPendingAlertDiffersFromLatest: boolean
  activityLatestHistoricalOrderDiffersFromLatest: boolean
  activityLatestOrderActionLabelPrefix: string
}

export function buildStrategyActivityOpsModelState({
  strategyId,
  selectedMode,
  collections: activityCollections,
  opsSources,
  opsSummaries,
}: BuildStrategyActivityOpsModelStateArgs): StrategyActivityOpsModelState {
  const {
    recentAlerts: activityAlerts,
    recentAuditEvents: activityEvents,
    recentOrders: activityOrders,
    recentTrades: activityTrades,
    activeOrders: activityActiveOrders,
  } = activityCollections
  const {
    latestAlertRecord,
    latestPendingAlertRecord,
    latestAuditEventRecord,
    latestHistoricalOrderRecord,
    latestOrderRecord,
    latestTradeRecord,
    latestActiveOrderRecord,
  } = opsSources
  const collections = buildStrategyActivityOpsCollections({
    activityAlerts,
    activityEvents,
    activityOrders,
    activityTrades,
    activityActiveOrders,
    latestAlertRecord,
    latestPendingAlertRecord,
    latestAuditEventRecord,
    latestHistoricalOrderRecord,
    latestTradeRecord,
    latestActiveOrderRecord,
  })
  const supplementedFlags = buildStrategyActivityOpsSupplementedFlags({
    activityAlerts,
    activityEvents,
    activityOrders,
    activityTrades,
    activityActiveOrders,
    latestAlertRecord,
    latestPendingAlertRecord,
    latestAuditEventRecord,
    latestHistoricalOrderRecord,
    latestTradeRecord,
    latestActiveOrderRecord,
  })
  const latestOpsState = resolveStrategyActivityLatestOpsState({
    strategyId,
    collections: {
      recentAlerts: collections.strategyActivityAlerts,
      recentAuditEvents: collections.strategyActivityAuditEvents,
      recentOrders: collections.strategyActivityOrders,
      recentTrades: collections.strategyActivityTrades,
    },
    opsSources: {
      latestAlertRecord,
      latestPendingAlertRecord,
      latestAuditEventRecord,
      latestHistoricalOrderRecord,
      latestOrderRecord,
      latestTradeRecord,
    },
  })
  const activeOrderState = resolveStrategyActivityActiveOrderState({
    selectedMode,
    strategyActivityActiveOrders: collections.strategyActivityActiveOrders,
    latestActiveOrderRecord,
    activityLatestOrder: latestOpsState.activityLatestOrder,
    activityLatestAlert: latestOpsState.activityLatestAlert,
    activityLatestPendingAlert: latestOpsState.activityLatestPendingAlert,
    activityLatestHistoricalOrder: latestOpsState.activityLatestHistoricalOrder,
  })

  return {
    ...collections,
    ...supplementedFlags,
    activityLatestAuditEvent: latestOpsState.activityLatestAuditEvent,
    activityLatestAlert: latestOpsState.activityLatestAlert,
    activityLatestPendingAlert: latestOpsState.activityLatestPendingAlert,
    activityLatestHistoricalOrder: latestOpsState.activityLatestHistoricalOrder,
    activityLatestOrder: latestOpsState.activityLatestOrder,
    activityLatestTrade: latestOpsState.activityLatestTrade,
    activityLatestAuditSummary: opsSummaries.latestAuditSummary,
    activityLatestAlertSummary: opsSummaries.latestAlertSummary,
    activityLatestPendingAlertSummary: opsSummaries.latestPendingAlertSummary,
    activityLatestOrderSummary: opsSummaries.latestOrderSummary,
    activityLatestHistoricalOrderSummary: opsSummaries.latestHistoricalOrderSummary,
    activityLatestTradeSummary: opsSummaries.latestTradeSummary,
    activityLatestAuditStrategyId: latestOpsState.activityLatestAuditStrategyId,
    activityLatestAuditJobId: latestOpsState.activityLatestAuditJobId,
    activityLatestAuditLinkedReviewId: latestOpsState.activityLatestAuditLinkedReviewId,
    activityLatestAuditChangeRequestId: latestOpsState.activityLatestAuditChangeRequestId,
    activityLatestAuditBacktestId: latestOpsState.activityLatestAuditBacktestId,
    activityLatestAuditSourceBacktestId: latestOpsState.activityLatestAuditSourceBacktestId,
    activityLatestAuditSourceReviewId: latestOpsState.activityLatestAuditSourceReviewId,
    activityLatestAuditSourceProposalId: latestOpsState.activityLatestAuditSourceProposalId,
    activityLatestActiveOrderRecord: opsSources.latestActiveOrderRecord,
    activityLatestActiveOrder: activeOrderState.activityLatestActiveOrder,
    activityLatestActiveOrderSummary: activeOrderState.activityLatestActiveOrderSummary,
    activityLatestActiveOrderEditable: activeOrderState.activityLatestActiveOrderEditable,
    activityLatestActiveOrderCancellable: activeOrderState.activityLatestActiveOrderCancellable,
    activityLatestActiveOrderDiffersFromLatest: activeOrderState.activityLatestActiveOrderDiffersFromLatest,
    activityLatestPendingAlertDiffersFromLatest: activeOrderState.activityLatestPendingAlertDiffersFromLatest,
    activityLatestHistoricalOrderDiffersFromLatest: activeOrderState.activityLatestHistoricalOrderDiffersFromLatest,
    activityLatestOrderActionLabelPrefix: activeOrderState.activityLatestOrderActionLabelPrefix,
  }
}
