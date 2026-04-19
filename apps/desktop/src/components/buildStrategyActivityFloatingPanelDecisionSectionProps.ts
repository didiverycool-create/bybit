import { buildStrategyActivityDecisionSectionProps } from './buildStrategyActivityDecisionSectionProps'
import type { BuildStrategyActivityFloatingPanelSectionPropsArgs } from './buildStrategyActivityFloatingPanelSectionProps'

export function buildStrategyActivityFloatingPanelDecisionSectionProps({
  strategyActivitySnapshotModel,
  derivedState,
  collectionState,
  serviceState,
  actions,
  selectors,
}: BuildStrategyActivityFloatingPanelSectionPropsArgs) {
  return buildStrategyActivityDecisionSectionProps({
    strategyActivitySnapshotModel,
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
}
