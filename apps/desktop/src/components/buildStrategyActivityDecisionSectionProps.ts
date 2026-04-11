import type {
  ChangeRequest,
  StrategyActivitySnapshot,
} from '../types'
import { isStrategyTrackingReview, proposalTypeLabel } from '../utils/app-helpers'
import type { StrategyActivityDecisionSectionsProps } from './StrategyActivityDecisionSections'
import type { StrategyActivityReviewAndJobsSectionProps } from './StrategyActivityReviewAndJobsSection'
import type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection'

type ChangeRequestLinkedState = Parameters<
  StrategyActivityDecisionSectionsProps['getStrategyActivityChangeRequestLinkedState']
>[0] extends ChangeRequest | null | undefined
  ? ReturnType<StrategyActivityDecisionSectionsProps['getStrategyActivityChangeRequestLinkedState']>
  : never

export type StrategyActivityDecisionSummaryState = {
  activityLatestProposalSummary: string | null
  activityLatestChangeRequestSummary: string | null
}

export type StrategyActivityDecisionTopState = Pick<
  StrategyActivityTopDecisionActionsSectionProps,
  | 'activityLatestProposal'
  | 'activityLatestChangeRequest'
  | 'activityLatestChangeRequestStrategyId'
  | 'activityLatestBacktest'
  | 'activityLatestPrimaryReview'
  | 'activityLatestPrimaryReviewRecord'
  | 'activityLatestPrimaryReviewStrategyId'
  | 'activityLatestTrackingReview'
  | 'activityLatestTrackingReviewRecord'
  | 'activityLatestTrackingReviewStrategyId'
  | 'activityLatestTrackingJob'
  | 'activityLatestTrackingJobRecord'
  | 'activityLatestBacktestReview'
  | 'activityLatestBacktestReviewRecord'
  | 'activityLatestBacktestJob'
  | 'activityLatestBacktestJobRecord'
  | 'activityLatestActionableBacktestRecord'
  | 'activityLatestActionableBacktestDiffersFromLatest'
  | 'activityLatestActionableBacktestJob'
  | 'activityLatestActionableBacktestJobRecord'
  | 'activityLatestBacktestStrategyId'
  | 'activityLatestBacktestSourceChangeRequestId'
  | 'activityLatestBacktestSourceBacktestId'
  | 'activityLatestBacktestSourceReviewId'
  | 'activityLatestBacktestSourceProposalId'
  | 'activityLatestActionablePrimaryReview'
  | 'activityLatestActionablePrimaryReviewRecord'
  | 'activityLatestActionablePrimaryReviewStrategyId'
  | 'activityLatestActionablePrimaryReviewDiffersFromLatest'
  | 'activityLatestTrackingJobLinkedReviewId'
  | 'activityLatestTrackingJobChangeRequestId'
  | 'activityLatestTrackingJobBacktestId'
  | 'activityLatestTrackingJobSourceChangeRequestId'
  | 'activityLatestTrackingJobSourceBacktestId'
  | 'activityLatestTrackingJobSourceReviewId'
  | 'activityLatestTrackingJobSourceProposalId'
  | 'activityLatestTrackingJobStrategyId'
  | 'activityLatestProposalLinkedChangeRequest'
  | 'activityLatestProposalLinkedBacktest'
  | 'activityLatestProposalLinkedReview'
  | 'activityLatestProposalLinkedJob'
  | 'activityLatestChangeRequestLinkedBacktestId'
  | 'activityLatestChangeRequestLinkedReviewId'
  | 'activityLatestChangeRequestLinkedJob'
  | 'activityLatestChangeRequestSourceBacktestId'
  | 'activityLatestChangeRequestSourceBacktestStrategyId'
  | 'activityLatestChangeRequestSourceReviewId'
  | 'activityLatestChangeRequestSourceReviewStrategyId'
  | 'activityLatestChangeRequestSourceProposalId'
  | 'activityLatestChangeRequestSourceProposalStrategyId'
  | 'activityLatestActionableProposal'
  | 'activityLatestActionableProposalDiffersFromLatest'
  | 'activityLatestActionableChangeRequest'
  | 'activityLatestActionableChangeRequestDiffersFromLatest'
  | 'activityLatestRetryableTrackingJob'
  | 'activityLatestRetryableTrackingJobRecord'
  | 'activityLatestRetryableTrackingJobDiffersFromLatest'
> & {
  activityLatestActionableBacktestDecisionMeta: {
    recommendedRange?: string | null
    recommendedTimeframe?: string | null
  } | null
  activityLatestActionableBacktestJobMeta: { canRetry?: boolean | null } | null
  activityLatestActionablePrimaryReviewDecisionMeta: {
    recommendedRange?: string | null
    recommendedTimeframe?: string | null
  } | null
  activityLatestActionableProposalBlockedReason: string | null
  activityLatestActionableProposalManualFollowupMeta: { detail: string } | null
  activityLatestActionableChangeRequestLinkedState: ChangeRequestLinkedState
  activityLatestActionableChangeRequestRerunRecommendation: {
    recommendedRange?: string | null
    recommendedTimeframe?: string | null
  } | null
}

export type StrategyActivityDecisionState = Pick<
  StrategyActivityDecisionSectionsProps,
  | 'selectedStrategyProposal'
  | 'selectedStrategyChangeRequest'
  | 'selectedProposalId'
  | 'selectedChangeRequestId'
  | 'selectedBacktest'
  | 'strategyActivityLatestProposalSupplemented'
  | 'strategyActivityLatestActionableProposalSupplemented'
  | 'strategyActivityLatestChangeRequestSupplemented'
  | 'strategyActivityLatestActionableChangeRequestSupplemented'
  | 'strategyActivityLatestBacktestSupplemented'
  | 'strategyActivityLatestActionableBacktestSupplemented'
  | 'strategyActivityProposals'
  | 'strategyActivityChangeRequests'
  | 'strategyActivityBacktests'
  | 'activityLatestProposal'
  | 'activityLatestActionableProposal'
  | 'activityLatestChangeRequest'
  | 'activityLatestActionableChangeRequest'
  | 'activityLatestBacktest'
  | 'activityLatestActionableBacktest'
  | 'activityLatestActionableBacktestReview'
  | 'activityLatestBacktestReview'
  | 'activityLatestActionableBacktestJob'
  | 'activityLatestBacktestJob'
  | 'backtests'
  | 'reviewCatalog'
  | 'backtestReviewJobs'
>

export type StrategyActivityReviewAndJobsState = Pick<
  StrategyActivityReviewAndJobsSectionProps,
  | 'selectedStrategyId'
  | 'replayFocusReview'
  | 'strategyActivityLatestTrackingReviewSupplemented'
  | 'strategyActivityTrackingReviews'
  | 'activityLatestTrackingReview'
  | 'strategyActivityLatestPrimaryReviewSupplemented'
  | 'strategyActivityLatestActionablePrimaryReviewSupplemented'
  | 'strategyActivityLatestActionableBacktestReviewSupplemented'
  | 'strategyActivityPrimaryReviews'
  | 'activityLatestPrimaryReview'
  | 'activityLatestActionablePrimaryReview'
  | 'activityLatestActionableBacktestReview'
  | 'aiSchedulerFocusedJobId'
  | 'strategyActivityLatestTrackingJobSupplemented'
  | 'strategyActivityLatestRetryableTrackingJobSupplemented'
  | 'strategyActivityLatestActionableBacktestJobSupplemented'
  | 'strategyActivityAgentJobs'
  | 'activityLatestTrackingJob'
  | 'activityLatestRetryableTrackingJob'
  | 'activityLatestActionableBacktestJob'
>

export type StrategyActivityDecisionServiceState = {
  serviceAvailable: boolean
  proposalMutationPending: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
}

export type StrategyActivityDecisionActions = Pick<
  StrategyActivityTopDecisionActionsSectionProps,
  | 'onOpenStrategyProposal'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenReviewInspector'
  | 'onOpenReplayReview'
  | 'onOpenSourceReview'
  | 'onOpenAiSchedulerJob'
  | 'onHandleProposalAction'
  | 'onRetryAgentJobWithFocus'
  | 'onRerunBacktestFromChangeRequest'
  | 'onRerunBacktestFromRecommendation'
  | 'onRerunBacktestFromReview'
> &
  Pick<
    StrategyActivityReviewAndJobsSectionProps,
    'onOpenStrategyReplay' | 'onRetryAgentJob'
  >

export type StrategyActivityDecisionSelectors = Pick<
  StrategyActivityDecisionSectionsProps,
  | 'getStrategyActivityProposalLinkedState'
  | 'getStrategyActivityChangeRequestLinkedState'
  | 'proposalFocusLabels'
  | 'backtestFocusLabels'
  | 'getProposalBlockedReason'
>

export function buildStrategyActivityDecisionSectionProps({
  activity,
  summaryState,
  topDecisionState,
  decisionState,
  reviewAndJobsState,
  serviceState,
  actions,
  selectors,
}: {
  activity: StrategyActivitySnapshot
  summaryState: StrategyActivityDecisionSummaryState
  topDecisionState: StrategyActivityDecisionTopState
  decisionState: StrategyActivityDecisionState
  reviewAndJobsState: StrategyActivityReviewAndJobsState
  serviceState: StrategyActivityDecisionServiceState
  actions: StrategyActivityDecisionActions
  selectors: StrategyActivityDecisionSelectors
}): {
  topDecisionActionsProps: StrategyActivityTopDecisionActionsSectionProps
  decisionSectionsProps: StrategyActivityDecisionSectionsProps
  reviewAndJobsProps: StrategyActivityReviewAndJobsSectionProps
} {
  return {
    topDecisionActionsProps: {
      strategyId: activity.strategy_id,
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
      activityLatestActionableBacktestDiffersFromLatest: topDecisionState.activityLatestActionableBacktestDiffersFromLatest,
      activityLatestActionableBacktestJob: topDecisionState.activityLatestActionableBacktestJob,
      activityLatestActionableBacktestJobRecord: topDecisionState.activityLatestActionableBacktestJobRecord,
      activityLatestActionableBacktestJobCanRetry: Boolean(
        topDecisionState.activityLatestActionableBacktestJobMeta?.canRetry,
      ),
      activityLatestBacktestStrategyId: topDecisionState.activityLatestBacktestStrategyId,
      activityLatestBacktestSourceChangeRequestId: topDecisionState.activityLatestBacktestSourceChangeRequestId,
      activityLatestBacktestSourceBacktestId: topDecisionState.activityLatestBacktestSourceBacktestId,
      activityLatestBacktestSourceReviewId: topDecisionState.activityLatestBacktestSourceReviewId,
      activityLatestBacktestSourceProposalId: topDecisionState.activityLatestBacktestSourceProposalId,
      activityLatestActionablePrimaryReview: topDecisionState.activityLatestActionablePrimaryReview,
      activityLatestActionablePrimaryReviewRecord: topDecisionState.activityLatestActionablePrimaryReviewRecord,
      activityLatestActionablePrimaryReviewStrategyId: topDecisionState.activityLatestActionablePrimaryReviewStrategyId,
      activityLatestActionablePrimaryReviewHasRecommendation: Boolean(
        topDecisionState.activityLatestActionablePrimaryReviewDecisionMeta?.recommendedRange &&
          topDecisionState.activityLatestActionablePrimaryReviewDecisionMeta?.recommendedTimeframe,
      ),
      activityLatestActionablePrimaryReviewDiffersFromLatest: topDecisionState.activityLatestActionablePrimaryReviewDiffersFromLatest,
      activityLatestTrackingJobLinkedReviewId: topDecisionState.activityLatestTrackingJobLinkedReviewId,
      activityLatestTrackingJobChangeRequestId: topDecisionState.activityLatestTrackingJobChangeRequestId,
      activityLatestTrackingJobBacktestId: topDecisionState.activityLatestTrackingJobBacktestId,
      activityLatestTrackingJobSourceChangeRequestId: topDecisionState.activityLatestTrackingJobSourceChangeRequestId,
      activityLatestTrackingJobSourceBacktestId: topDecisionState.activityLatestTrackingJobSourceBacktestId,
      activityLatestTrackingJobSourceReviewId: topDecisionState.activityLatestTrackingJobSourceReviewId,
      activityLatestTrackingJobSourceProposalId: topDecisionState.activityLatestTrackingJobSourceProposalId,
      activityLatestTrackingJobStrategyId: topDecisionState.activityLatestTrackingJobStrategyId,
      activityLatestProposalLinkedChangeRequest: topDecisionState.activityLatestProposalLinkedChangeRequest,
      activityLatestProposalLinkedBacktest: topDecisionState.activityLatestProposalLinkedBacktest,
      activityLatestProposalLinkedReview: topDecisionState.activityLatestProposalLinkedReview,
      activityLatestProposalLinkedJob: topDecisionState.activityLatestProposalLinkedJob,
      activityLatestChangeRequestLinkedBacktestId: topDecisionState.activityLatestChangeRequestLinkedBacktestId,
      activityLatestChangeRequestLinkedReviewId: topDecisionState.activityLatestChangeRequestLinkedReviewId,
      activityLatestChangeRequestLinkedJob: topDecisionState.activityLatestChangeRequestLinkedJob,
      activityLatestChangeRequestSourceBacktestId: topDecisionState.activityLatestChangeRequestSourceBacktestId,
      activityLatestChangeRequestSourceBacktestStrategyId: topDecisionState.activityLatestChangeRequestSourceBacktestStrategyId,
      activityLatestChangeRequestSourceReviewId: topDecisionState.activityLatestChangeRequestSourceReviewId,
      activityLatestChangeRequestSourceReviewStrategyId: topDecisionState.activityLatestChangeRequestSourceReviewStrategyId,
      activityLatestChangeRequestSourceProposalId: topDecisionState.activityLatestChangeRequestSourceProposalId,
      activityLatestChangeRequestSourceProposalStrategyId: topDecisionState.activityLatestChangeRequestSourceProposalStrategyId,
      activityLatestActionableProposal: topDecisionState.activityLatestActionableProposal,
      activityLatestActionableProposalDiffersFromLatest: topDecisionState.activityLatestActionableProposalDiffersFromLatest,
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
      activityLatestRetryableTrackingJobRecord: topDecisionState.activityLatestRetryableTrackingJobRecord,
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
    },
    decisionSectionsProps: {
      strategyId: activity.strategy_id,
      recentProposalIds: activity.recent_proposals.map((proposal) => proposal.id),
      recentChangeRequestIds: activity.recent_change_requests.map((request) => request.id),
      recentBacktestIds: activity.recent_backtests.map((backtest) => backtest.id),
      selectedStrategyProposal: decisionState.selectedStrategyProposal,
      selectedStrategyChangeRequest: decisionState.selectedStrategyChangeRequest,
      selectedProposalId: decisionState.selectedProposalId,
      selectedChangeRequestId: decisionState.selectedChangeRequestId,
      selectedBacktest: decisionState.selectedBacktest,
      strategyActivityLatestProposalSupplemented: decisionState.strategyActivityLatestProposalSupplemented,
      strategyActivityLatestActionableProposalSupplemented:
        decisionState.strategyActivityLatestActionableProposalSupplemented,
      strategyActivityLatestChangeRequestSupplemented:
        decisionState.strategyActivityLatestChangeRequestSupplemented,
      strategyActivityLatestActionableChangeRequestSupplemented:
        decisionState.strategyActivityLatestActionableChangeRequestSupplemented,
      strategyActivityLatestBacktestSupplemented: decisionState.strategyActivityLatestBacktestSupplemented,
      strategyActivityLatestActionableBacktestSupplemented:
        decisionState.strategyActivityLatestActionableBacktestSupplemented,
      strategyActivityProposals: decisionState.strategyActivityProposals,
      strategyActivityChangeRequests: decisionState.strategyActivityChangeRequests,
      strategyActivityBacktests: decisionState.strategyActivityBacktests,
      activityLatestProposal: decisionState.activityLatestProposal,
      activityLatestActionableProposal: decisionState.activityLatestActionableProposal,
      activityLatestChangeRequest: decisionState.activityLatestChangeRequest,
      activityLatestActionableChangeRequest: decisionState.activityLatestActionableChangeRequest,
      activityLatestBacktest: decisionState.activityLatestBacktest,
      activityLatestActionableBacktest: decisionState.activityLatestActionableBacktest,
      activityLatestActionableBacktestReview: decisionState.activityLatestActionableBacktestReview,
      activityLatestBacktestReview: decisionState.activityLatestBacktestReview,
      activityLatestActionableBacktestJob: decisionState.activityLatestActionableBacktestJob,
      activityLatestBacktestJob: decisionState.activityLatestBacktestJob,
      backtests: decisionState.backtests,
      reviewCatalog: decisionState.reviewCatalog,
      backtestReviewJobs: decisionState.backtestReviewJobs,
      serviceAvailable: serviceState.serviceAvailable,
      proposalMutationPending: serviceState.proposalMutationPending,
      backtestMutationPending: serviceState.backtestMutationPending,
      retryAgentJobMutationPending: serviceState.retryAgentJobMutationPending,
      getStrategyActivityProposalLinkedState: selectors.getStrategyActivityProposalLinkedState,
      getStrategyActivityChangeRequestLinkedState: selectors.getStrategyActivityChangeRequestLinkedState,
      proposalFocusLabels: selectors.proposalFocusLabels,
      getProposalBlockedReason: selectors.getProposalBlockedReason,
      backtestFocusLabels: selectors.backtestFocusLabels,
      onOpenStrategyProposal: actions.onOpenStrategyProposal,
      onOpenChangeRequest: actions.onOpenChangeRequest,
      onOpenBacktestDetail: actions.onOpenBacktestDetail,
      onOpenReviewInspector: actions.onOpenReviewInspector,
      onOpenReplayReview: actions.onOpenReplayReview,
      onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
      onOpenSourceReview: actions.onOpenSourceReview,
      onRetryAgentJob: actions.onRetryAgentJobWithFocus,
      onHandleProposalAction: actions.onHandleProposalAction,
      onRerunBacktestFromChangeRequest: actions.onRerunBacktestFromChangeRequest,
    },
    reviewAndJobsProps: {
      strategyId: activity.strategy_id,
      selectedStrategyId: reviewAndJobsState.selectedStrategyId,
      replayFocusReview: reviewAndJobsState.replayFocusReview,
      recentTrackingReviewIds: activity.recent_reviews
        .filter((review) => isStrategyTrackingReview(review.period))
        .map((review) => review.id),
      recentPrimaryReviewIds: activity.recent_reviews
        .filter((review) => !isStrategyTrackingReview(review.period))
        .map((review) => review.id),
      recentAgentJobIds: activity.recent_agent_jobs.map((job) => job.id),
      strategyActivityLatestTrackingReviewSupplemented:
        reviewAndJobsState.strategyActivityLatestTrackingReviewSupplemented,
      strategyActivityTrackingReviews: reviewAndJobsState.strategyActivityTrackingReviews,
      activityLatestTrackingReview: reviewAndJobsState.activityLatestTrackingReview,
      strategyActivityLatestPrimaryReviewSupplemented:
        reviewAndJobsState.strategyActivityLatestPrimaryReviewSupplemented,
      strategyActivityLatestActionablePrimaryReviewSupplemented:
        reviewAndJobsState.strategyActivityLatestActionablePrimaryReviewSupplemented,
      strategyActivityLatestActionableBacktestReviewSupplemented:
        reviewAndJobsState.strategyActivityLatestActionableBacktestReviewSupplemented,
      strategyActivityPrimaryReviews: reviewAndJobsState.strategyActivityPrimaryReviews,
      activityLatestPrimaryReview: reviewAndJobsState.activityLatestPrimaryReview,
      activityLatestActionablePrimaryReview: reviewAndJobsState.activityLatestActionablePrimaryReview,
      activityLatestActionableBacktestReview: reviewAndJobsState.activityLatestActionableBacktestReview,
      aiSchedulerFocusedJobId: reviewAndJobsState.aiSchedulerFocusedJobId,
      strategyActivityLatestTrackingJobSupplemented:
        reviewAndJobsState.strategyActivityLatestTrackingJobSupplemented,
      strategyActivityLatestRetryableTrackingJobSupplemented:
        reviewAndJobsState.strategyActivityLatestRetryableTrackingJobSupplemented,
      strategyActivityLatestActionableBacktestJobSupplemented:
        reviewAndJobsState.strategyActivityLatestActionableBacktestJobSupplemented,
      strategyActivityAgentJobs: reviewAndJobsState.strategyActivityAgentJobs,
      activityLatestTrackingJob: reviewAndJobsState.activityLatestTrackingJob,
      activityLatestRetryableTrackingJob: reviewAndJobsState.activityLatestRetryableTrackingJob,
      activityLatestActionableBacktestJob: reviewAndJobsState.activityLatestActionableBacktestJob,
      serviceAvailable: serviceState.serviceAvailable,
      backtestMutationPending: serviceState.backtestMutationPending,
      retryAgentJobMutationPending: serviceState.retryAgentJobMutationPending,
      onOpenChangeRequest: actions.onOpenChangeRequest,
      onOpenBacktestDetail: actions.onOpenBacktestDetail,
      onOpenSourceReview: actions.onOpenSourceReview,
      onOpenStrategyProposal: actions.onOpenStrategyProposal,
      onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
      onOpenReviewInspector: actions.onOpenReviewInspector,
      onOpenReplayReview: actions.onOpenReplayReview,
      onOpenStrategyReplay: actions.onOpenStrategyReplay,
      onRerunBacktestFromReview: actions.onRerunBacktestFromReview,
      onRetryAgentJob: actions.onRetryAgentJob,
    },
  }
}
