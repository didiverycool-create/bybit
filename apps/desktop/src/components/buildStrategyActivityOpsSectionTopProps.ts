import type { StrategyActivityTopOpsSectionProps } from './StrategyActivityTopOpsSection'
import type { StrategyActivityOpsSummaryState, StrategyActivityTopOpsState, StrategyActivityOpsServiceState, StrategyActivityOpsActions } from './buildStrategyActivityOpsSectionTypes'
import { buildStrategyActivityOpsSectionSummaryProps } from './buildStrategyActivityOpsSectionSummaryProps'

type BuildStrategyActivityOpsSectionTopPropsArgs = {
  summaryState: StrategyActivityOpsSummaryState
  topOpsState: StrategyActivityTopOpsState
  serviceState: StrategyActivityOpsServiceState
  actions: StrategyActivityOpsActions
}

export function buildStrategyActivityOpsSectionTopProps({
  summaryState,
  topOpsState,
  serviceState,
  actions,
}: BuildStrategyActivityOpsSectionTopPropsArgs): StrategyActivityTopOpsSectionProps {
  const { latestActivitySummaryText, latestOpsSummaryText } =
    buildStrategyActivityOpsSectionSummaryProps({ summaryState })

  return {
    latestActivitySummaryText,
    latestOpsSummaryText,
    latestActiveOrderHintText:
      topOpsState.activityLatestActiveOrderDiffersFromLatest && topOpsState.activityLatestActiveOrderSummary
        ? `当前活跃委托: ${topOpsState.activityLatestActiveOrderSummary} · 顶部改单/撤单会优先作用于这张仍可操作的委托。`
        : null,
    pendingAlertHintText:
      topOpsState.activityLatestPendingAlertDiffersFromLatest && topOpsState.activityLatestPendingAlertSummary
        ? `当前待处理提醒: ${topOpsState.activityLatestPendingAlertSummary} · 顶部“当前待处理提醒 / 当前确认提醒 / 待处理行情”会优先作用于这条仍待处理的提醒。`
        : null,
    actionableProposalHintText:
      topOpsState.activityLatestActionableProposalDiffersFromLatest && topOpsState.activityLatestActionableProposalSummary
        ? `当前可处理提案: ${topOpsState.activityLatestActionableProposalSummary} · 顶部接受/拒绝会优先作用于这条仍可处理的提案。`
        : null,
    actionableChangeRequestHintText:
      topOpsState.activityLatestActionableChangeRequestDiffersFromLatest &&
      topOpsState.activityLatestActionableChangeRequestSummary
        ? `当前可处理变更: ${topOpsState.activityLatestActionableChangeRequestSummary} · 顶部重试/重跑会优先作用于这条仍可继续处理的变更。`
        : null,
    retryableTrackingJobHintText:
      topOpsState.activityLatestRetryableTrackingJobDiffersFromLatest &&
      topOpsState.activityLatestRetryableTrackingJobSummary
        ? `当前可重试任务: ${topOpsState.activityLatestRetryableTrackingJobSummary} · 顶部重试会优先作用于这条仍可重试的任务。`
        : null,
    latestHistoricalOrderHintText:
      topOpsState.activityLatestHistoricalOrderDiffersFromLatest && topOpsState.activityLatestHistoricalOrderSummary
        ? `当前最新历史委托: ${topOpsState.activityLatestHistoricalOrderSummary} · 顶部“最新历史委托 / 历史行情”会优先沿这张历史单继续追单。`
        : null,
    actionableBacktestHintText:
      topOpsState.activityLatestActionableBacktestDiffersFromLatest && topOpsState.activityLatestActionableBacktestSummary
        ? `当前可处理回测: ${topOpsState.activityLatestActionableBacktestSummary} · 顶部回测重跑/重试会优先作用于这轮仍可继续处理的回测。`
        : null,
    actionablePrimaryReviewHintText:
      topOpsState.activityLatestActionablePrimaryReviewDiffersFromLatest &&
      topOpsState.activityLatestActionablePrimaryReviewSummary
        ? `当前可处理复盘: ${topOpsState.activityLatestActionablePrimaryReviewSummary} · 顶部复盘重跑会优先作用于这条仍可继续处理的复盘。`
        : null,
    activityLatestAlert: topOpsState.activityLatestAlert,
    activityLatestPendingAlert: topOpsState.activityLatestPendingAlertDiffersFromLatest
      ? topOpsState.activityLatestPendingAlert
      : null,
    activityLatestOrder: topOpsState.activityLatestOrder,
    activityLatestHistoricalOrder: topOpsState.activityLatestHistoricalOrderDiffersFromLatest
      ? topOpsState.activityLatestHistoricalOrder
      : null,
    activityLatestActiveOrder: topOpsState.activityLatestActiveOrderDiffersFromLatest
      ? topOpsState.activityLatestActiveOrder
      : null,
    activityLatestTrade: topOpsState.activityLatestTrade,
    activityLatestActiveOrderEditable: topOpsState.activityLatestActiveOrderEditable,
    activityLatestActiveOrderCancellable: topOpsState.activityLatestActiveOrderCancellable,
    activityLatestOrderActionLabelPrefix: topOpsState.activityLatestOrderActionLabelPrefix,
    activityLatestAuditJobId: topOpsState.activityLatestAuditJobId,
    activityLatestAuditLinkedReviewId: topOpsState.activityLatestAuditLinkedReviewId,
    activityLatestAuditChangeRequestId: topOpsState.activityLatestAuditChangeRequestId,
    activityLatestAuditBacktestId: topOpsState.activityLatestAuditBacktestId,
    activityLatestAuditSourceBacktestId: topOpsState.activityLatestAuditSourceBacktestId,
    activityLatestAuditSourceReviewId: topOpsState.activityLatestAuditSourceReviewId,
    activityLatestAuditSourceProposalId: topOpsState.activityLatestAuditSourceProposalId,
    activityLatestAuditStrategyId: topOpsState.activityLatestAuditStrategyId,
    serviceAvailable: serviceState.serviceAvailable,
    selectedMode: serviceState.selectedMode,
    alertMutationPending: serviceState.alertMutationPending,
    cancelPaperOrderPending: serviceState.cancelPaperOrderPending,
    cancelExchangeOrderPending: serviceState.cancelExchangeOrderPending,
    onOpenAlertsSection: actions.onOpenAlertsSection,
    onOpenMarketSymbol: actions.onOpenMarketSymbol,
    onOpenTradesSection: actions.onOpenTradesSection,
    onOpenWatchlistManager: actions.onOpenWatchlistManager,
    onToggleAlertAcknowledged: actions.onToggleAlertAcknowledged,
    onOpenOrderEditor: actions.onOpenOrderEditor,
    onCancelPaperOrder: actions.onCancelPaperOrder,
    onCancelExchangeOrder: actions.onCancelExchangeOrder,
    onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
    onOpenReviewInspector: actions.onOpenReviewInspector,
    onOpenChangeRequest: actions.onOpenChangeRequest,
    onOpenBacktestDetail: actions.onOpenBacktestDetail,
    onOpenSourceReview: actions.onOpenSourceReview,
    onOpenStrategyProposal: actions.onOpenStrategyProposal,
  }
}
