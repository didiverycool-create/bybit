import type {
  AgentJob,
  AlertRecord,
  OrderRecord,
  ReviewDocument,
  StrategyActivityBacktestSummary,
} from '../types'
import { backtestLineageMeta, strategyAgentJobSummary } from '../utils/app-helpers'
import type { StrategyActivityOpsSectionProps } from './StrategyActivityOpsSection'
import type { StrategyActivityTopOpsSectionProps } from './StrategyActivityTopOpsSection'

export type StrategyActivityOpsSummaryState = {
  activityLatestPrimaryReview: ReviewDocument | null
  activityLatestBacktest: StrategyActivityBacktestSummary | null
  activityLatestTrackingReview: ReviewDocument | null
  activityLatestTrackingJob: AgentJob | null
  activityLatestBacktestDecisionMeta: { label: string } | null
  activityLatestBacktestWindowMeta: { attention?: boolean; label: string } | null
  activityLatestBacktestReview: ReviewDocument | null
  activityLatestBacktestJobMeta: { label: string } | null
  activityLatestBacktestLineageMeta: { detail: string } | null
  activityLatestAuditSummary: string | null
  activityLatestAlertSummary: string | null
  activityLatestOrderSummary: string | null
  activityLatestTradeSummary: string | null
}

export type StrategyActivityTopOpsState = Pick<
  StrategyActivityTopOpsSectionProps,
  | 'activityLatestAlert'
  | 'activityLatestOrder'
  | 'activityLatestTrade'
  | 'activityLatestActiveOrderEditable'
  | 'activityLatestActiveOrderCancellable'
  | 'activityLatestOrderActionLabelPrefix'
  | 'activityLatestAuditJobId'
  | 'activityLatestAuditLinkedReviewId'
  | 'activityLatestAuditChangeRequestId'
  | 'activityLatestAuditBacktestId'
  | 'activityLatestAuditSourceBacktestId'
  | 'activityLatestAuditSourceReviewId'
  | 'activityLatestAuditSourceProposalId'
  | 'activityLatestAuditStrategyId'
> & {
  activityLatestPendingAlert: AlertRecord | null
  activityLatestHistoricalOrder: OrderRecord | null
  activityLatestActiveOrder: OrderRecord | null
  activityLatestActiveOrderDiffersFromLatest: boolean
  activityLatestActiveOrderSummary: string | null
  activityLatestPendingAlertDiffersFromLatest: boolean
  activityLatestPendingAlertSummary: string | null
  activityLatestActionableProposalDiffersFromLatest: boolean
  activityLatestActionableProposalSummary: string | null
  activityLatestActionableChangeRequestDiffersFromLatest: boolean
  activityLatestActionableChangeRequestSummary: string | null
  activityLatestRetryableTrackingJobDiffersFromLatest: boolean
  activityLatestRetryableTrackingJobSummary: string | null
  activityLatestHistoricalOrderDiffersFromLatest: boolean
  activityLatestHistoricalOrderSummary: string | null
  activityLatestActionableBacktestDiffersFromLatest: boolean
  activityLatestActionableBacktestSummary: string | null
  activityLatestActionablePrimaryReviewDiffersFromLatest: boolean
  activityLatestActionablePrimaryReviewSummary: string | null
}

export type StrategyActivityOpsState = Pick<
  StrategyActivityOpsSectionProps,
  | 'strategyId'
  | 'strategyActivityLatestPendingAlertSupplemented'
  | 'strategyActivityLatestAlertSupplemented'
  | 'strategyActivityAlerts'
  | 'activityLatestAlert'
  | 'activityLatestPendingAlert'
  | 'strategyActivityLatestAuditSupplemented'
  | 'strategyActivityAuditEvents'
  | 'activityLatestAuditEvent'
  | 'strategyActivityLatestActiveOrderSupplemented'
  | 'strategyActivityActiveOrders'
  | 'activityLatestActiveOrder'
  | 'activityLatestOrder'
  | 'strategyActivityLatestHistoricalOrderSupplemented'
  | 'strategyActivityOrders'
  | 'activityLatestHistoricalOrder'
  | 'strategyActivityLatestTradeSupplemented'
  | 'strategyActivityTrades'
  | 'activityLatestTrade'
>

export type StrategyActivityOpsServiceState = Pick<
  StrategyActivityTopOpsSectionProps,
  | 'serviceAvailable'
  | 'selectedMode'
  | 'alertMutationPending'
  | 'cancelPaperOrderPending'
  | 'cancelExchangeOrderPending'
> &
  Pick<
    StrategyActivityOpsSectionProps,
    | 'replacePaperOrderPending'
    | 'cancelPaperOrderPending'
    | 'replaceExchangeOrderPending'
    | 'cancelExchangeOrderPending'
  >

export type StrategyActivityOpsActions = Pick<
  StrategyActivityTopOpsSectionProps,
  | 'onOpenAlertsSection'
  | 'onOpenMarketSymbol'
  | 'onOpenTradesSection'
  | 'onOpenWatchlistManager'
  | 'onToggleAlertAcknowledged'
  | 'onOpenOrderEditor'
  | 'onCancelPaperOrder'
  | 'onCancelExchangeOrder'
  | 'onOpenAiSchedulerJob'
  | 'onOpenReviewInspector'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenSourceReview'
  | 'onOpenStrategyProposal'
> &
  Pick<StrategyActivityOpsSectionProps, 'onOpenAuditSection'>

export function buildStrategyActivityOpsSectionProps({
  summaryState,
  topOpsState,
  opsState,
  serviceState,
  actions,
}: {
  summaryState: StrategyActivityOpsSummaryState
  topOpsState: StrategyActivityTopOpsState
  opsState: StrategyActivityOpsState
  serviceState: StrategyActivityOpsServiceState
  actions: StrategyActivityOpsActions
}): {
  topOpsProps: StrategyActivityTopOpsSectionProps
  opsSectionProps: StrategyActivityOpsSectionProps
} {
  const latestActivitySummaryText =
    summaryState.activityLatestPrimaryReview ||
    summaryState.activityLatestBacktest ||
    summaryState.activityLatestTrackingReview ||
    summaryState.activityLatestTrackingJob
      ? `${summaryState.activityLatestBacktest
          ? `最近回测: ${summaryState.activityLatestBacktest.id} · ${summaryState.activityLatestBacktest.timeframe} · ${summaryState.activityLatestBacktest.data_range} · ${summaryState.activityLatestBacktest.status}`
          : '最近回测: 暂无'}${
          summaryState.activityLatestBacktestDecisionMeta
            ? ` · 结论 ${summaryState.activityLatestBacktestDecisionMeta.label}`
            : summaryState.activityLatestBacktestWindowMeta?.attention
              ? ` · ${summaryState.activityLatestBacktestWindowMeta.label}`
              : ''
        }${
          summaryState.activityLatestBacktestReview
            ? ` · 最新结果: ${summaryState.activityLatestBacktestReview.title}`
            : summaryState.activityLatestBacktestJobMeta
              ? ` · AI复盘任务: ${summaryState.activityLatestBacktestJobMeta.label}`
              : ''
        }${summaryState.activityLatestBacktestLineageMeta ? ` · ${summaryState.activityLatestBacktestLineageMeta.detail}` : ''}${
          summaryState.activityLatestPrimaryReview || summaryState.activityLatestTrackingReview || summaryState.activityLatestTrackingJob
            ? ' · '
            : ''
        }${
          summaryState.activityLatestPrimaryReview
            ? `最近复盘: ${summaryState.activityLatestPrimaryReview.summary}`
            : '最近复盘: 暂无'
        }${
          summaryState.activityLatestPrimaryReview && backtestLineageMeta(summaryState.activityLatestPrimaryReview)
            ? ` · ${backtestLineageMeta(summaryState.activityLatestPrimaryReview)?.detail}`
            : ''
        }${summaryState.activityLatestTrackingReview ? ` · 最近跟踪: ${summaryState.activityLatestTrackingReview.summary}` : ''}${
          summaryState.activityLatestTrackingJob
            ? ` · 最近任务: ${strategyAgentJobSummary(summaryState.activityLatestTrackingJob)}`
            : ''
        }`
      : null

  const latestOpsSummaryText =
    summaryState.activityLatestAuditSummary ||
    summaryState.activityLatestAlertSummary ||
    summaryState.activityLatestOrderSummary ||
    summaryState.activityLatestTradeSummary
      ? `${summaryState.activityLatestAuditSummary ? `最新审计: ${summaryState.activityLatestAuditSummary}` : '最新审计: 暂无'}${
          summaryState.activityLatestAlertSummary ? ` · 最新提醒: ${summaryState.activityLatestAlertSummary}` : ''
        }${summaryState.activityLatestOrderSummary ? ` · 最新委托: ${summaryState.activityLatestOrderSummary}` : ''}${
          summaryState.activityLatestTradeSummary ? ` · 最新成交: ${summaryState.activityLatestTradeSummary}` : ''
        }`
      : null

  return {
    topOpsProps: {
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
    },
    opsSectionProps: {
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
      onOpenTradesSection: actions.onOpenTradesSection,
      onOpenOrderEditor: actions.onOpenOrderEditor,
      onCancelPaperOrder: actions.onCancelPaperOrder,
      onCancelExchangeOrder: actions.onCancelExchangeOrder,
      strategyActivityLatestHistoricalOrderSupplemented: opsState.strategyActivityLatestHistoricalOrderSupplemented,
      strategyActivityOrders: opsState.strategyActivityOrders,
      activityLatestHistoricalOrder: opsState.activityLatestHistoricalOrder,
      strategyActivityLatestTradeSupplemented: opsState.strategyActivityLatestTradeSupplemented,
      strategyActivityTrades: opsState.strategyActivityTrades,
      activityLatestTrade: opsState.activityLatestTrade,
    },
  }
}
