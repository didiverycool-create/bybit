import type { ChangeRequest } from '../types'
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
