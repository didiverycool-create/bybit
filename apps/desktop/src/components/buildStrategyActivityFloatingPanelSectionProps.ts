import type { StrategyActivitySnapshot } from '../types'
import type { StrategyActivityFloatingPanelProps as StrategyActivityFloatingPanelComponentProps } from './StrategyActivityFloatingPanel'
import {
  buildStrategyActivityDecisionSectionProps,
  type StrategyActivityDecisionActions,
  type StrategyActivityDecisionSelectors,
  type StrategyActivityDecisionServiceState,
  type StrategyActivityDecisionState,
  type StrategyActivityDecisionSummaryState,
  type StrategyActivityDecisionTopState,
  type StrategyActivityReviewAndJobsState,
} from './buildStrategyActivityDecisionSectionProps'
import {
  buildStrategyActivityOpsSectionProps,
  type StrategyActivityOpsActions,
  type StrategyActivityOpsServiceState,
  type StrategyActivityOpsState,
  type StrategyActivityOpsSummaryState,
  type StrategyActivityTopOpsState,
} from './buildStrategyActivityOpsSectionProps'

export type StrategyActivityFloatingPanelSectionProps = {
  topOpsProps?: StrategyActivityFloatingPanelComponentProps['topOpsProps']
  topDecisionActionsProps?: StrategyActivityFloatingPanelComponentProps['topDecisionActionsProps']
  decisionSectionsProps?: StrategyActivityFloatingPanelComponentProps['decisionSectionsProps']
  reviewAndJobsProps?: StrategyActivityFloatingPanelComponentProps['reviewAndJobsProps']
  opsSectionProps?: StrategyActivityFloatingPanelComponentProps['opsSectionProps']
}

export type StrategyActivityFloatingPanelDerivedState = StrategyActivityOpsSummaryState &
  StrategyActivityTopOpsState &
  StrategyActivityDecisionSummaryState &
  StrategyActivityDecisionTopState

export type StrategyActivityFloatingPanelCollectionState = StrategyActivityOpsState &
  StrategyActivityDecisionState &
  StrategyActivityReviewAndJobsState

export type StrategyActivityFloatingPanelServiceState = StrategyActivityOpsServiceState &
  StrategyActivityDecisionServiceState

export type StrategyActivityFloatingPanelActions = StrategyActivityOpsActions &
  StrategyActivityDecisionActions

export function buildStrategyActivityFloatingPanelSectionProps({
  activity,
  derivedState,
  collectionState,
  serviceState,
  actions,
  selectors,
}: {
  activity: StrategyActivitySnapshot
  derivedState: StrategyActivityFloatingPanelDerivedState
  collectionState: StrategyActivityFloatingPanelCollectionState
  serviceState: StrategyActivityFloatingPanelServiceState
  actions: StrategyActivityFloatingPanelActions
  selectors: StrategyActivityDecisionSelectors
}): StrategyActivityFloatingPanelSectionProps {
  const opsSectionProps = buildStrategyActivityOpsSectionProps({
    summaryState: {
      activityLatestPrimaryReview: derivedState.activityLatestPrimaryReview,
      activityLatestBacktest: derivedState.activityLatestBacktest,
      activityLatestTrackingReview: derivedState.activityLatestTrackingReview,
      activityLatestTrackingJob: derivedState.activityLatestTrackingJob,
      activityLatestBacktestDecisionMeta: derivedState.activityLatestBacktestDecisionMeta,
      activityLatestBacktestWindowMeta: derivedState.activityLatestBacktestWindowMeta,
      activityLatestBacktestReview: derivedState.activityLatestBacktestReview,
      activityLatestBacktestJobMeta: derivedState.activityLatestBacktestJobMeta,
      activityLatestBacktestLineageMeta: derivedState.activityLatestBacktestLineageMeta,
      activityLatestAuditSummary: derivedState.activityLatestAuditSummary,
      activityLatestAlertSummary: derivedState.activityLatestAlertSummary,
      activityLatestOrderSummary: derivedState.activityLatestOrderSummary,
      activityLatestTradeSummary: derivedState.activityLatestTradeSummary,
    },
    topOpsState: {
      activityLatestAlert: derivedState.activityLatestAlert,
      activityLatestPendingAlert: derivedState.activityLatestPendingAlert,
      activityLatestOrder: derivedState.activityLatestOrder,
      activityLatestHistoricalOrder: derivedState.activityLatestHistoricalOrder,
      activityLatestActiveOrder: derivedState.activityLatestActiveOrder,
      activityLatestTrade: derivedState.activityLatestTrade,
      activityLatestActiveOrderEditable: derivedState.activityLatestActiveOrderEditable,
      activityLatestActiveOrderCancellable: derivedState.activityLatestActiveOrderCancellable,
      activityLatestOrderActionLabelPrefix: derivedState.activityLatestOrderActionLabelPrefix,
      activityLatestAuditJobId: derivedState.activityLatestAuditJobId,
      activityLatestAuditLinkedReviewId: derivedState.activityLatestAuditLinkedReviewId,
      activityLatestAuditChangeRequestId: derivedState.activityLatestAuditChangeRequestId,
      activityLatestAuditBacktestId: derivedState.activityLatestAuditBacktestId,
      activityLatestAuditSourceBacktestId: derivedState.activityLatestAuditSourceBacktestId,
      activityLatestAuditSourceReviewId: derivedState.activityLatestAuditSourceReviewId,
      activityLatestAuditSourceProposalId: derivedState.activityLatestAuditSourceProposalId,
      activityLatestAuditStrategyId: derivedState.activityLatestAuditStrategyId,
      activityLatestActiveOrderDiffersFromLatest: derivedState.activityLatestActiveOrderDiffersFromLatest,
      activityLatestActiveOrderSummary: derivedState.activityLatestActiveOrderSummary,
      activityLatestPendingAlertDiffersFromLatest: derivedState.activityLatestPendingAlertDiffersFromLatest,
      activityLatestPendingAlertSummary: derivedState.activityLatestPendingAlertSummary,
      activityLatestActionableProposalDiffersFromLatest: derivedState.activityLatestActionableProposalDiffersFromLatest,
      activityLatestActionableProposalSummary: derivedState.activityLatestActionableProposalSummary,
      activityLatestActionableChangeRequestDiffersFromLatest:
        derivedState.activityLatestActionableChangeRequestDiffersFromLatest,
      activityLatestActionableChangeRequestSummary: derivedState.activityLatestActionableChangeRequestSummary,
      activityLatestRetryableTrackingJobDiffersFromLatest:
        derivedState.activityLatestRetryableTrackingJobDiffersFromLatest,
      activityLatestRetryableTrackingJobSummary: derivedState.activityLatestRetryableTrackingJobSummary,
      activityLatestHistoricalOrderDiffersFromLatest: derivedState.activityLatestHistoricalOrderDiffersFromLatest,
      activityLatestHistoricalOrderSummary: derivedState.activityLatestHistoricalOrderSummary,
      activityLatestActionableBacktestDiffersFromLatest: derivedState.activityLatestActionableBacktestDiffersFromLatest,
      activityLatestActionableBacktestSummary: derivedState.activityLatestActionableBacktestSummary,
      activityLatestActionablePrimaryReviewDiffersFromLatest:
        derivedState.activityLatestActionablePrimaryReviewDiffersFromLatest,
      activityLatestActionablePrimaryReviewSummary: derivedState.activityLatestActionablePrimaryReviewSummary,
    },
    opsState: {
      strategyId: collectionState.strategyId,
      strategyActivityLatestPendingAlertSupplemented: collectionState.strategyActivityLatestPendingAlertSupplemented,
      strategyActivityLatestAlertSupplemented: collectionState.strategyActivityLatestAlertSupplemented,
      strategyActivityAlerts: collectionState.strategyActivityAlerts,
      activityLatestAlert: derivedState.activityLatestAlert,
      activityLatestPendingAlert: derivedState.activityLatestPendingAlert,
      strategyActivityLatestAuditSupplemented: collectionState.strategyActivityLatestAuditSupplemented,
      strategyActivityAuditEvents: collectionState.strategyActivityAuditEvents,
      activityLatestAuditEvent: collectionState.activityLatestAuditEvent,
      strategyActivityLatestActiveOrderSupplemented: collectionState.strategyActivityLatestActiveOrderSupplemented,
      strategyActivityActiveOrders: collectionState.strategyActivityActiveOrders,
      activityLatestActiveOrder: derivedState.activityLatestActiveOrder,
      activityLatestOrder: derivedState.activityLatestOrder,
      strategyActivityLatestHistoricalOrderSupplemented:
        collectionState.strategyActivityLatestHistoricalOrderSupplemented,
      strategyActivityOrders: collectionState.strategyActivityOrders,
      activityLatestHistoricalOrder: derivedState.activityLatestHistoricalOrder,
      strategyActivityLatestTradeSupplemented: collectionState.strategyActivityLatestTradeSupplemented,
      strategyActivityTrades: collectionState.strategyActivityTrades,
      activityLatestTrade: derivedState.activityLatestTrade,
    },
    serviceState: {
      serviceAvailable: serviceState.serviceAvailable,
      selectedMode: serviceState.selectedMode,
      alertMutationPending: serviceState.alertMutationPending,
      cancelPaperOrderPending: serviceState.cancelPaperOrderPending,
      cancelExchangeOrderPending: serviceState.cancelExchangeOrderPending,
      replacePaperOrderPending: serviceState.replacePaperOrderPending,
      replaceExchangeOrderPending: serviceState.replaceExchangeOrderPending,
    },
    actions: {
      onOpenAlertsSection: actions.onOpenAlertsSection,
      onOpenMarketSymbol: actions.onOpenMarketSymbol,
      onOpenTradesSection: actions.onOpenTradesSection,
      onOpenWatchlistManager: actions.onOpenWatchlistManager,
      onToggleAlertAcknowledged: actions.onToggleAlertAcknowledged,
      onOpenOrderEditor: actions.onOpenOrderEditor,
      onCancelPaperOrder: actions.onCancelPaperOrder,
      onCancelExchangeOrder: actions.onCancelExchangeOrder,
      onOpenAuditSection: actions.onOpenAuditSection,
      onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
      onOpenReviewInspector: actions.onOpenReviewInspector,
      onOpenChangeRequest: actions.onOpenChangeRequest,
      onOpenBacktestDetail: actions.onOpenBacktestDetail,
      onOpenSourceReview: actions.onOpenSourceReview,
      onOpenStrategyProposal: actions.onOpenStrategyProposal,
    },
  })

  const decisionSectionProps = buildStrategyActivityDecisionSectionProps({
    activity,
    summaryState: {
      activityLatestProposalSummary: derivedState.activityLatestProposalSummary,
      activityLatestChangeRequestSummary: derivedState.activityLatestChangeRequestSummary,
    },
    topDecisionState: {
      activityLatestProposal: derivedState.activityLatestProposal,
      activityLatestChangeRequest: derivedState.activityLatestChangeRequest,
      activityLatestChangeRequestStrategyId: derivedState.activityLatestChangeRequestStrategyId,
      activityLatestBacktest: derivedState.activityLatestBacktest,
      activityLatestPrimaryReview: derivedState.activityLatestPrimaryReview,
      activityLatestPrimaryReviewRecord: derivedState.activityLatestPrimaryReviewRecord,
      activityLatestPrimaryReviewStrategyId: derivedState.activityLatestPrimaryReviewStrategyId,
      activityLatestTrackingReview: derivedState.activityLatestTrackingReview,
      activityLatestTrackingReviewRecord: derivedState.activityLatestTrackingReviewRecord,
      activityLatestTrackingReviewStrategyId: derivedState.activityLatestTrackingReviewStrategyId,
      activityLatestTrackingJob: derivedState.activityLatestTrackingJob,
      activityLatestTrackingJobRecord: derivedState.activityLatestTrackingJobRecord,
      activityLatestBacktestReview: derivedState.activityLatestBacktestReview,
      activityLatestBacktestReviewRecord: derivedState.activityLatestBacktestReviewRecord,
      activityLatestBacktestJob: derivedState.activityLatestBacktestJob,
      activityLatestBacktestJobRecord: derivedState.activityLatestBacktestJobRecord,
      activityLatestActionableBacktestRecord: derivedState.activityLatestActionableBacktestRecord,
      activityLatestActionableBacktestDiffersFromLatest: derivedState.activityLatestActionableBacktestDiffersFromLatest,
      activityLatestActionableBacktestJob: derivedState.activityLatestActionableBacktestJob,
      activityLatestActionableBacktestJobRecord: derivedState.activityLatestActionableBacktestJobRecord,
      activityLatestBacktestStrategyId: derivedState.activityLatestBacktestStrategyId,
      activityLatestBacktestSourceChangeRequestId: derivedState.activityLatestBacktestSourceChangeRequestId,
      activityLatestBacktestSourceBacktestId: derivedState.activityLatestBacktestSourceBacktestId,
      activityLatestBacktestSourceReviewId: derivedState.activityLatestBacktestSourceReviewId,
      activityLatestBacktestSourceProposalId: derivedState.activityLatestBacktestSourceProposalId,
      activityLatestActionablePrimaryReview: derivedState.activityLatestActionablePrimaryReview,
      activityLatestActionablePrimaryReviewRecord: derivedState.activityLatestActionablePrimaryReviewRecord,
      activityLatestActionablePrimaryReviewStrategyId: derivedState.activityLatestActionablePrimaryReviewStrategyId,
      activityLatestActionablePrimaryReviewDiffersFromLatest:
        derivedState.activityLatestActionablePrimaryReviewDiffersFromLatest,
      activityLatestTrackingJobLinkedReviewId: derivedState.activityLatestTrackingJobLinkedReviewId,
      activityLatestTrackingJobChangeRequestId: derivedState.activityLatestTrackingJobChangeRequestId,
      activityLatestTrackingJobBacktestId: derivedState.activityLatestTrackingJobBacktestId,
      activityLatestTrackingJobSourceChangeRequestId: derivedState.activityLatestTrackingJobSourceChangeRequestId,
      activityLatestTrackingJobSourceBacktestId: derivedState.activityLatestTrackingJobSourceBacktestId,
      activityLatestTrackingJobSourceReviewId: derivedState.activityLatestTrackingJobSourceReviewId,
      activityLatestTrackingJobSourceProposalId: derivedState.activityLatestTrackingJobSourceProposalId,
      activityLatestTrackingJobStrategyId: derivedState.activityLatestTrackingJobStrategyId,
      activityLatestProposalLinkedChangeRequest: derivedState.activityLatestProposalLinkedChangeRequest,
      activityLatestProposalLinkedBacktest: derivedState.activityLatestProposalLinkedBacktest,
      activityLatestProposalLinkedReview: derivedState.activityLatestProposalLinkedReview,
      activityLatestProposalLinkedJob: derivedState.activityLatestProposalLinkedJob,
      activityLatestChangeRequestLinkedBacktestId: derivedState.activityLatestChangeRequestLinkedBacktestId,
      activityLatestChangeRequestLinkedReviewId: derivedState.activityLatestChangeRequestLinkedReviewId,
      activityLatestChangeRequestLinkedJob: derivedState.activityLatestChangeRequestLinkedJob,
      activityLatestChangeRequestSourceBacktestId: derivedState.activityLatestChangeRequestSourceBacktestId,
      activityLatestChangeRequestSourceBacktestStrategyId:
        derivedState.activityLatestChangeRequestSourceBacktestStrategyId,
      activityLatestChangeRequestSourceReviewId: derivedState.activityLatestChangeRequestSourceReviewId,
      activityLatestChangeRequestSourceReviewStrategyId:
        derivedState.activityLatestChangeRequestSourceReviewStrategyId,
      activityLatestChangeRequestSourceProposalId: derivedState.activityLatestChangeRequestSourceProposalId,
      activityLatestChangeRequestSourceProposalStrategyId:
        derivedState.activityLatestChangeRequestSourceProposalStrategyId,
      activityLatestActionableProposal: derivedState.activityLatestActionableProposal,
      activityLatestActionableProposalDiffersFromLatest:
        derivedState.activityLatestActionableProposalDiffersFromLatest,
      activityLatestActionableChangeRequest: derivedState.activityLatestActionableChangeRequest,
      activityLatestActionableChangeRequestDiffersFromLatest:
        derivedState.activityLatestActionableChangeRequestDiffersFromLatest,
      activityLatestRetryableTrackingJob: derivedState.activityLatestRetryableTrackingJob,
      activityLatestRetryableTrackingJobRecord: derivedState.activityLatestRetryableTrackingJobRecord,
      activityLatestRetryableTrackingJobDiffersFromLatest:
        derivedState.activityLatestRetryableTrackingJobDiffersFromLatest,
      activityLatestActionableBacktestDecisionMeta: derivedState.activityLatestActionableBacktestDecisionMeta,
      activityLatestActionableBacktestJobMeta: derivedState.activityLatestActionableBacktestJobMeta,
      activityLatestActionablePrimaryReviewDecisionMeta:
        derivedState.activityLatestActionablePrimaryReviewDecisionMeta,
      activityLatestActionableProposalBlockedReason: derivedState.activityLatestActionableProposalBlockedReason,
      activityLatestActionableProposalManualFollowupMeta:
        derivedState.activityLatestActionableProposalManualFollowupMeta,
      activityLatestActionableChangeRequestLinkedState:
        derivedState.activityLatestActionableChangeRequestLinkedState,
      activityLatestActionableChangeRequestRerunRecommendation:
        derivedState.activityLatestActionableChangeRequestRerunRecommendation,
    },
    decisionState: {
      selectedStrategyProposal: collectionState.selectedStrategyProposal,
      selectedStrategyChangeRequest: collectionState.selectedStrategyChangeRequest,
      selectedProposalId: collectionState.selectedProposalId,
      selectedChangeRequestId: collectionState.selectedChangeRequestId,
      selectedBacktest: collectionState.selectedBacktest,
      strategyActivityLatestProposalSupplemented: collectionState.strategyActivityLatestProposalSupplemented,
      strategyActivityLatestActionableProposalSupplemented:
        collectionState.strategyActivityLatestActionableProposalSupplemented,
      strategyActivityLatestChangeRequestSupplemented:
        collectionState.strategyActivityLatestChangeRequestSupplemented,
      strategyActivityLatestActionableChangeRequestSupplemented:
        collectionState.strategyActivityLatestActionableChangeRequestSupplemented,
      strategyActivityLatestBacktestSupplemented: collectionState.strategyActivityLatestBacktestSupplemented,
      strategyActivityLatestActionableBacktestSupplemented:
        collectionState.strategyActivityLatestActionableBacktestSupplemented,
      strategyActivityProposals: collectionState.strategyActivityProposals,
      strategyActivityChangeRequests: collectionState.strategyActivityChangeRequests,
      strategyActivityBacktests: collectionState.strategyActivityBacktests,
      activityLatestProposal: derivedState.activityLatestProposal,
      activityLatestActionableProposal: derivedState.activityLatestActionableProposal,
      activityLatestChangeRequest: derivedState.activityLatestChangeRequest,
      activityLatestActionableChangeRequest: derivedState.activityLatestActionableChangeRequest,
      activityLatestBacktest: derivedState.activityLatestBacktest,
      activityLatestActionableBacktest: collectionState.activityLatestActionableBacktest,
      activityLatestActionableBacktestReview: collectionState.activityLatestActionableBacktestReview,
      activityLatestBacktestReview: derivedState.activityLatestBacktestReview,
      activityLatestActionableBacktestJob: collectionState.activityLatestActionableBacktestJob,
      activityLatestBacktestJob: derivedState.activityLatestBacktestJob,
      backtests: collectionState.backtests,
      reviewCatalog: collectionState.reviewCatalog,
      backtestReviewJobs: collectionState.backtestReviewJobs,
    },
    reviewAndJobsState: {
      selectedStrategyId: collectionState.selectedStrategyId,
      replayFocusReview: collectionState.replayFocusReview,
      strategyActivityLatestTrackingReviewSupplemented:
        collectionState.strategyActivityLatestTrackingReviewSupplemented,
      strategyActivityTrackingReviews: collectionState.strategyActivityTrackingReviews,
      activityLatestTrackingReview: derivedState.activityLatestTrackingReview,
      strategyActivityLatestPrimaryReviewSupplemented:
        collectionState.strategyActivityLatestPrimaryReviewSupplemented,
      strategyActivityLatestActionablePrimaryReviewSupplemented:
        collectionState.strategyActivityLatestActionablePrimaryReviewSupplemented,
      strategyActivityLatestActionableBacktestReviewSupplemented:
        collectionState.strategyActivityLatestActionableBacktestReviewSupplemented,
      strategyActivityPrimaryReviews: collectionState.strategyActivityPrimaryReviews,
      activityLatestPrimaryReview: derivedState.activityLatestPrimaryReview,
      activityLatestActionablePrimaryReview: derivedState.activityLatestActionablePrimaryReview,
      activityLatestActionableBacktestReview: collectionState.activityLatestActionableBacktestReview,
      aiSchedulerFocusedJobId: collectionState.aiSchedulerFocusedJobId,
      strategyActivityLatestTrackingJobSupplemented:
        collectionState.strategyActivityLatestTrackingJobSupplemented,
      strategyActivityLatestRetryableTrackingJobSupplemented:
        collectionState.strategyActivityLatestRetryableTrackingJobSupplemented,
      strategyActivityLatestActionableBacktestJobSupplemented:
        collectionState.strategyActivityLatestActionableBacktestJobSupplemented,
      strategyActivityAgentJobs: collectionState.strategyActivityAgentJobs,
      activityLatestTrackingJob: derivedState.activityLatestTrackingJob,
      activityLatestRetryableTrackingJob: derivedState.activityLatestRetryableTrackingJob,
      activityLatestActionableBacktestJob: collectionState.activityLatestActionableBacktestJob,
    },
    serviceState: {
      serviceAvailable: serviceState.serviceAvailable,
      proposalMutationPending: serviceState.proposalMutationPending,
      backtestMutationPending: serviceState.backtestMutationPending,
      retryAgentJobMutationPending: serviceState.retryAgentJobMutationPending,
    },
    actions: {
      onOpenStrategyProposal: actions.onOpenStrategyProposal,
      onOpenChangeRequest: actions.onOpenChangeRequest,
      onOpenBacktestDetail: actions.onOpenBacktestDetail,
      onOpenReviewInspector: actions.onOpenReviewInspector,
      onOpenReplayReview: actions.onOpenReplayReview,
      onOpenSourceReview: actions.onOpenSourceReview,
      onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
      onHandleProposalAction: actions.onHandleProposalAction,
      onRetryAgentJobWithFocus: actions.onRetryAgentJobWithFocus,
      onRerunBacktestFromChangeRequest: actions.onRerunBacktestFromChangeRequest,
      onRerunBacktestFromRecommendation: actions.onRerunBacktestFromRecommendation,
      onRerunBacktestFromReview: actions.onRerunBacktestFromReview,
      onOpenStrategyReplay: actions.onOpenStrategyReplay,
      onRetryAgentJob: actions.onRetryAgentJob,
    },
    selectors,
  })

  return {
    topOpsProps: opsSectionProps.topOpsProps,
    topDecisionActionsProps: decisionSectionProps.topDecisionActionsProps,
    decisionSectionsProps: decisionSectionProps.decisionSectionsProps,
    reviewAndJobsProps: decisionSectionProps.reviewAndJobsProps,
    opsSectionProps: opsSectionProps.opsSectionProps,
  }
}
