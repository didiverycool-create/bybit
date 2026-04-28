import type { AgentJob, ReviewDocument } from '../types'

export type StrategyActivityReviewAndJobsCommonProps = {
  strategyId: string
  selectedStrategyId: string | null
  replayFocusReview: ReviewDocument | null
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
}

export type StrategyActivityTrackingReviewsSectionProps = StrategyActivityReviewAndJobsCommonProps & {
  recentTrackingReviewIds: string[]
  strategyActivityLatestTrackingReviewSupplemented: boolean
  strategyActivityTrackingReviews: ReviewDocument[]
  activityLatestTrackingReview: ReviewDocument | null
}

export type StrategyActivityPrimaryReviewsSectionProps = StrategyActivityReviewAndJobsCommonProps & {
  recentPrimaryReviewIds: string[]
  strategyActivityLatestPrimaryReviewSupplemented: boolean
  strategyActivityLatestActionablePrimaryReviewSupplemented: boolean
  strategyActivityLatestActionableBacktestReviewSupplemented: boolean
  strategyActivityPrimaryReviews: ReviewDocument[]
  activityLatestPrimaryReview: ReviewDocument | null
  activityLatestActionablePrimaryReview: ReviewDocument | null
  activityLatestActionableBacktestReview: ReviewDocument | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void | Promise<void>
}

export type StrategyActivityAgentJobsSectionProps = StrategyActivityReviewAndJobsCommonProps & {
  recentAgentJobIds: string[]
  strategyActivityLatestTrackingJobSupplemented: boolean
  strategyActivityLatestRetryableTrackingJobSupplemented: boolean
  strategyActivityLatestActionableBacktestJobSupplemented: boolean
  strategyActivityAgentJobs: AgentJob[]
  activityLatestTrackingJob: AgentJob | null
  activityLatestRetryableTrackingJob: AgentJob | null
  activityLatestActionableBacktestJob: AgentJob | null
  aiSchedulerFocusedJobId: string | null
  serviceAvailable: boolean
  retryAgentJobMutationPending: boolean
  onOpenStrategyReplay: (strategyId: string) => void
  onRetryAgentJob: (jobId: string) => void
}
