import { proposalTypeLabel } from '../utils/app-helpers'
import type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection'
import type {
  StrategyActivityDecisionActions,
  StrategyActivityDecisionServiceState,
  StrategyActivityDecisionSummaryState,
  StrategyActivityDecisionTopState,
} from './buildStrategyActivityDecisionSectionProps'

type BuildStrategyActivityTopDecisionActionsPropsArgs = {
  strategyId: string
  summaryState: StrategyActivityDecisionSummaryState
  topDecisionState: StrategyActivityDecisionTopState
  serviceState: StrategyActivityDecisionServiceState
  actions: StrategyActivityDecisionActions
}

export function buildStrategyActivityTopDecisionActionsProps({
  strategyId,
  summaryState,
  topDecisionState,
  serviceState,
  actions,
}: BuildStrategyActivityTopDecisionActionsPropsArgs): StrategyActivityTopDecisionActionsSectionProps {
  return {
    strategyId,
    latestProposalChangeSummaryText:
      summaryState.activityLatestProposalSummary || summaryState.activityLatestChangeRequestSummary
        ? `${summaryState.activityLatestProposalSummary ? `最近提案: ${summaryState.activityLatestProposalSummary}` : '最近提案: 暂无'}${
            summaryState.activityLatestChangeRequestSummary ? ` · 最近变更: ${summaryState.activityLatestChangeRequestSummary}` : ''
          }`
        : null,
    activityLatestProposal: topDecisionState.activityLatestProposal,
    activityLatestChangeRequest: topDecisionState.activityLatestChangeRequest,
    activityLatestChangeRequestStrategyId: topDecisionState.activityLatestChangeRequestStrategyId,
    activityLatestBacktest: topDecisionState.activityLatestBacktest,
    activityLatestPrimaryReview: topDecisionState.activityLatestPrimaryReview,
    activityLatestPrimaryReviewRecord: topDecisionState.activityLatestPrimaryReviewRecord,
    activityLatestPrimaryReviewStrategyId: topDecisionState.activityLatestPrimaryReviewStrategyId,
    activityLatestTrackingReview: topDecisionState.activityLatestTrackingReview,
    activityLatestTrackingReviewRecord: topDecisionState.activityLatestTrackingReviewRecord,
    activityLatestTrackingReviewStrategyId: topDecisionState.activityLatestTrackingReviewStrategyId,
    activityLatestTrackingJob: topDecisionState.activityLatestTrackingJob,
    activityLatestTrackingJobRecord: topDecisionState.activityLatestTrackingJobRecord,
    activityLatestBacktestReview: topDecisionState.activityLatestBacktestReview,
    activityLatestBacktestReviewRecord: topDecisionState.activityLatestBacktestReviewRecord,
    activityLatestBacktestJob: topDecisionState.activityLatestBacktestJob,
    activityLatestBacktestJobRecord: topDecisionState.activityLatestBacktestJobRecord,
    activityLatestActionableBacktestRecord: topDecisionState.activityLatestActionableBacktestRecord,
    activityLatestActionableBacktestHasRecommendation: Boolean(
      topDecisionState.activityLatestActionableBacktestDecisionMeta?.recommendedRange &&
        topDecisionState.activityLatestActionableBacktestDecisionMeta?.recommendedTimeframe,
    ),
    activityLatestActionableBacktestDiffersFromLatest:
      topDecisionState.activityLatestActionableBacktestDiffersFromLatest,
    activityLatestActionableBacktestJob: topDecisionState.activityLatestActionableBacktestJob,
    activityLatestActionableBacktestJobRecord: topDecisionState.activityLatestActionableBacktestJobRecord,
    activityLatestActionableBacktestJobCanRetry: Boolean(
      topDecisionState.activityLatestActionableBacktestJobMeta?.canRetry,
    ),
    activityLatestBacktestStrategyId: topDecisionState.activityLatestBacktestStrategyId,
    activityLatestBacktestSourceChangeRequestId:
      topDecisionState.activityLatestBacktestSourceChangeRequestId,
    activityLatestBacktestSourceBacktestId: topDecisionState.activityLatestBacktestSourceBacktestId,
    activityLatestBacktestSourceReviewId: topDecisionState.activityLatestBacktestSourceReviewId,
    activityLatestBacktestSourceProposalId: topDecisionState.activityLatestBacktestSourceProposalId,
    activityLatestActionablePrimaryReview: topDecisionState.activityLatestActionablePrimaryReview,
    activityLatestActionablePrimaryReviewRecord:
      topDecisionState.activityLatestActionablePrimaryReviewRecord,
    activityLatestActionablePrimaryReviewStrategyId:
      topDecisionState.activityLatestActionablePrimaryReviewStrategyId,
    activityLatestActionablePrimaryReviewHasRecommendation: Boolean(
      topDecisionState.activityLatestActionablePrimaryReviewDecisionMeta?.recommendedRange &&
        topDecisionState.activityLatestActionablePrimaryReviewDecisionMeta?.recommendedTimeframe,
    ),
    activityLatestActionablePrimaryReviewDiffersFromLatest:
      topDecisionState.activityLatestActionablePrimaryReviewDiffersFromLatest,
    activityLatestTrackingJobLinkedReviewId: topDecisionState.activityLatestTrackingJobLinkedReviewId,
    activityLatestTrackingJobChangeRequestId:
      topDecisionState.activityLatestTrackingJobChangeRequestId,
    activityLatestTrackingJobBacktestId: topDecisionState.activityLatestTrackingJobBacktestId,
    activityLatestTrackingJobSourceChangeRequestId:
      topDecisionState.activityLatestTrackingJobSourceChangeRequestId,
    activityLatestTrackingJobSourceBacktestId:
      topDecisionState.activityLatestTrackingJobSourceBacktestId,
    activityLatestTrackingJobSourceReviewId:
      topDecisionState.activityLatestTrackingJobSourceReviewId,
    activityLatestTrackingJobSourceProposalId:
      topDecisionState.activityLatestTrackingJobSourceProposalId,
    activityLatestTrackingJobStrategyId: topDecisionState.activityLatestTrackingJobStrategyId,
    activityLatestProposalLinkedChangeRequest:
      topDecisionState.activityLatestProposalLinkedChangeRequest,
    activityLatestProposalLinkedBacktest: topDecisionState.activityLatestProposalLinkedBacktest,
    activityLatestProposalLinkedReview: topDecisionState.activityLatestProposalLinkedReview,
    activityLatestProposalLinkedJob: topDecisionState.activityLatestProposalLinkedJob,
    activityLatestChangeRequestLinkedBacktestId:
      topDecisionState.activityLatestChangeRequestLinkedBacktestId,
    activityLatestChangeRequestLinkedReviewId:
      topDecisionState.activityLatestChangeRequestLinkedReviewId,
    activityLatestChangeRequestLinkedJob: topDecisionState.activityLatestChangeRequestLinkedJob,
    activityLatestChangeRequestSourceBacktestId:
      topDecisionState.activityLatestChangeRequestSourceBacktestId,
    activityLatestChangeRequestSourceBacktestStrategyId:
      topDecisionState.activityLatestChangeRequestSourceBacktestStrategyId,
    activityLatestChangeRequestSourceReviewId:
      topDecisionState.activityLatestChangeRequestSourceReviewId,
    activityLatestChangeRequestSourceReviewStrategyId:
      topDecisionState.activityLatestChangeRequestSourceReviewStrategyId,
    activityLatestChangeRequestSourceProposalId:
      topDecisionState.activityLatestChangeRequestSourceProposalId,
    activityLatestChangeRequestSourceProposalStrategyId:
      topDecisionState.activityLatestChangeRequestSourceProposalStrategyId,
    activityLatestActionableProposal: topDecisionState.activityLatestActionableProposal,
    activityLatestActionableProposalDiffersFromLatest:
      topDecisionState.activityLatestActionableProposalDiffersFromLatest,
    activityLatestActionableProposalAcceptTitle:
      topDecisionState.activityLatestActionableProposalBlockedReason ??
      topDecisionState.activityLatestActionableProposalManualFollowupMeta?.detail ??
      (topDecisionState.activityLatestActionableProposal
        ? `接受 ${proposalTypeLabel(topDecisionState.activityLatestActionableProposal.proposal_type)}`
        : null),
    activityLatestActionableProposalAcceptDisabled:
      !serviceState.serviceAvailable ||
      serviceState.proposalMutationPending ||
      Boolean(topDecisionState.activityLatestActionableProposalBlockedReason),
    activityLatestActionableChangeRequest: topDecisionState.activityLatestActionableChangeRequest,
    activityLatestActionableChangeRequestDiffersFromLatest:
      topDecisionState.activityLatestActionableChangeRequestDiffersFromLatest,
    activityLatestActionableChangeRequestLinkedJobId:
      topDecisionState.activityLatestActionableChangeRequestLinkedState.linkedJob?.id ?? null,
    activityLatestActionableChangeRequestHasRerunRecommendation: Boolean(
      topDecisionState.activityLatestActionableChangeRequestRerunRecommendation?.recommendedRange &&
        topDecisionState.activityLatestActionableChangeRequestRerunRecommendation?.recommendedTimeframe,
    ),
    activityLatestRetryableTrackingJob: topDecisionState.activityLatestRetryableTrackingJob,
    activityLatestRetryableTrackingJobRecord:
      topDecisionState.activityLatestRetryableTrackingJobRecord,
    activityLatestRetryableTrackingJobDiffersFromLatest:
      topDecisionState.activityLatestRetryableTrackingJobDiffersFromLatest,
    serviceAvailable: serviceState.serviceAvailable,
    proposalMutationPending: serviceState.proposalMutationPending,
    backtestMutationPending: serviceState.backtestMutationPending,
    retryAgentJobMutationPending: serviceState.retryAgentJobMutationPending,
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
  }
}
