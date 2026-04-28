import type { StrategyActivityOpsSectionProps } from './StrategyActivityOpsSection'
import type { StrategyActivityOpsActions, StrategyActivityOpsServiceState, StrategyActivityOpsState } from './buildStrategyActivityOpsSectionTypes'

type BuildStrategyActivityOpsSectionOpsPropsArgs = {
  opsState: StrategyActivityOpsState
  serviceState: StrategyActivityOpsServiceState
  actions: StrategyActivityOpsActions
}

export function buildStrategyActivityOpsSectionOpsProps({
  opsState,
  serviceState,
  actions,
}: BuildStrategyActivityOpsSectionOpsPropsArgs): StrategyActivityOpsSectionProps {
  return {
    strategyId: opsState.strategyId,
    serviceAvailable: serviceState.serviceAvailable,
    selectedMode: serviceState.selectedMode,
    strategyActivityLatestPendingAlertSupplemented: opsState.strategyActivityLatestPendingAlertSupplemented,
    strategyActivityLatestAlertSupplemented: opsState.strategyActivityLatestAlertSupplemented,
    strategyActivityAlerts: opsState.strategyActivityAlerts,
    activityLatestAlert: opsState.activityLatestAlert,
    activityLatestPendingAlert: opsState.activityLatestPendingAlert,
    alertMutationPending: serviceState.alertMutationPending,
    onOpenAlertsSection: actions.onOpenAlertsSection,
    onOpenMarketSymbol: actions.onOpenMarketSymbol,
    onOpenTradesSection: actions.onOpenTradesSection,
    onOpenWatchlistManager: actions.onOpenWatchlistManager,
    onToggleAlertAcknowledged: actions.onToggleAlertAcknowledged,
    strategyActivityLatestAuditSupplemented: opsState.strategyActivityLatestAuditSupplemented,
    strategyActivityAuditEvents: opsState.strategyActivityAuditEvents,
    activityLatestAuditEvent: opsState.activityLatestAuditEvent,
    onOpenAuditSection: actions.onOpenAuditSection,
    onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
    onOpenReviewInspector: actions.onOpenReviewInspector,
    onOpenChangeRequest: actions.onOpenChangeRequest,
    onOpenBacktestDetail: actions.onOpenBacktestDetail,
    onOpenSourceReview: actions.onOpenSourceReview,
    onOpenStrategyProposal: actions.onOpenStrategyProposal,
    strategyActivityLatestActiveOrderSupplemented: opsState.strategyActivityLatestActiveOrderSupplemented,
    strategyActivityActiveOrders: opsState.strategyActivityActiveOrders,
    activityLatestActiveOrder: opsState.activityLatestActiveOrder,
    activityLatestOrder: opsState.activityLatestOrder,
    replacePaperOrderPending: serviceState.replacePaperOrderPending,
    cancelPaperOrderPending: serviceState.cancelPaperOrderPending,
    replaceExchangeOrderPending: serviceState.replaceExchangeOrderPending,
    cancelExchangeOrderPending: serviceState.cancelExchangeOrderPending,
    onOpenOrderEditor: actions.onOpenOrderEditor,
    onCancelPaperOrder: actions.onCancelPaperOrder,
    onCancelExchangeOrder: actions.onCancelExchangeOrder,
    strategyActivityLatestHistoricalOrderSupplemented: opsState.strategyActivityLatestHistoricalOrderSupplemented,
    strategyActivityOrders: opsState.strategyActivityOrders,
    activityLatestHistoricalOrder: opsState.activityLatestHistoricalOrder,
    strategyActivityLatestTradeSupplemented: opsState.strategyActivityLatestTradeSupplemented,
    strategyActivityTrades: opsState.strategyActivityTrades,
    activityLatestTrade: opsState.activityLatestTrade,
  }
}
