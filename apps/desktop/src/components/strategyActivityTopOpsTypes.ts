import type { AlertRecord, Mode, OrderRecord, TradeRecord } from '../types'

export type StrategyActivityTopOpsSectionProps = {
  latestActivitySummaryText: string | null
  latestOpsSummaryText: string | null
  latestActiveOrderHintText: string | null
  pendingAlertHintText: string | null
  actionableProposalHintText: string | null
  actionableChangeRequestHintText: string | null
  retryableTrackingJobHintText: string | null
  latestHistoricalOrderHintText: string | null
  actionableBacktestHintText: string | null
  actionablePrimaryReviewHintText: string | null
  activityLatestAlert: AlertRecord | null
  activityLatestPendingAlert: AlertRecord | null
  activityLatestOrder: OrderRecord | null
  activityLatestHistoricalOrder: OrderRecord | null
  activityLatestActiveOrder: OrderRecord | null
  activityLatestTrade: TradeRecord | null
  activityLatestActiveOrderEditable: boolean
  activityLatestActiveOrderCancellable: boolean
  activityLatestOrderActionLabelPrefix: string
  activityLatestAuditJobId: string | null
  activityLatestAuditLinkedReviewId: string | null
  activityLatestAuditChangeRequestId: string | null
  activityLatestAuditBacktestId: string | null
  activityLatestAuditSourceBacktestId: string | null
  activityLatestAuditSourceReviewId: string | null
  activityLatestAuditSourceProposalId: string | null
  activityLatestAuditStrategyId: string | null
  serviceAvailable: boolean
  selectedMode: Mode
  alertMutationPending: boolean
  cancelPaperOrderPending: boolean
  cancelExchangeOrderPending: boolean
  onOpenAlertsSection: (symbol?: string | null) => void
  onOpenMarketSymbol: (symbol: string) => void
  onOpenTradesSection: (symbol?: string | null) => void
  onOpenWatchlistManager: () => void
  onToggleAlertAcknowledged: (alertId: string, nextAcknowledged: boolean) => void
  onOpenOrderEditor: (order: OrderRecord) => void
  onCancelPaperOrder: (orderId: string) => void
  onCancelExchangeOrder: (orderId: string) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
}

export type StrategyActivityTopOpsNotesProps = Pick<
  StrategyActivityTopOpsSectionProps,
  | 'latestActivitySummaryText'
  | 'latestOpsSummaryText'
  | 'latestActiveOrderHintText'
  | 'pendingAlertHintText'
  | 'actionableProposalHintText'
  | 'actionableChangeRequestHintText'
  | 'retryableTrackingJobHintText'
  | 'latestHistoricalOrderHintText'
  | 'actionableBacktestHintText'
  | 'actionablePrimaryReviewHintText'
>

export type StrategyActivityTopOpsRecentActionsProps = Pick<
  StrategyActivityTopOpsSectionProps,
  | 'activityLatestAlert'
  | 'activityLatestPendingAlert'
  | 'activityLatestOrder'
  | 'activityLatestHistoricalOrder'
  | 'activityLatestActiveOrder'
  | 'activityLatestTrade'
  | 'activityLatestActiveOrderEditable'
  | 'activityLatestActiveOrderCancellable'
  | 'activityLatestOrderActionLabelPrefix'
  | 'serviceAvailable'
  | 'selectedMode'
  | 'alertMutationPending'
  | 'cancelPaperOrderPending'
  | 'cancelExchangeOrderPending'
  | 'onOpenAlertsSection'
  | 'onOpenMarketSymbol'
  | 'onOpenTradesSection'
  | 'onOpenWatchlistManager'
  | 'onToggleAlertAcknowledged'
  | 'onOpenOrderEditor'
  | 'onCancelPaperOrder'
  | 'onCancelExchangeOrder'
>

export type StrategyActivityTopOpsAuditActionsProps = Pick<
  StrategyActivityTopOpsSectionProps,
  | 'activityLatestAuditJobId'
  | 'activityLatestAuditLinkedReviewId'
  | 'activityLatestAuditChangeRequestId'
  | 'activityLatestAuditBacktestId'
  | 'activityLatestAuditSourceBacktestId'
  | 'activityLatestAuditSourceReviewId'
  | 'activityLatestAuditSourceProposalId'
  | 'activityLatestAuditStrategyId'
  | 'onOpenAiSchedulerJob'
  | 'onOpenReviewInspector'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenSourceReview'
  | 'onOpenStrategyProposal'
>

export type StrategyActivityTopOpsNoteItem = {
  key: string
  renderAs: 'div' | 'p'
  text: string | null
}
