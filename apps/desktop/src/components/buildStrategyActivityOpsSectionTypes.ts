import type {
  AgentJob,
  AlertRecord,
  OrderRecord,
  ReviewDocument,
  StrategyActivityBacktestSummary,
} from '../types'
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
