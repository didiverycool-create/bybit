import type {
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyActivityBacktestSummary,
  StrategyProposal,
} from '../../types'

export type StrategyActivityTopRecentFocusActionsProps = {
  showLatestFocusActions: boolean
  showLineageActions: boolean
  strategyId: string
  activityLatestProposal: StrategyProposal | null
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestChangeRequestStrategyId: string | null
  activityLatestBacktest: StrategyActivityBacktestSummary | null
  activityLatestPrimaryReviewStrategyId: string | null
  activityLatestTrackingReviewStrategyId: string | null
  activityLatestBacktestStrategyId: string | null
  activityLatestBacktestReview: ReviewDocument | null
  activityLatestActionableBacktestRecord: BacktestRun | null
  activityLatestActionableBacktestHasRecommendation: boolean
  activityLatestActionableBacktestDiffersFromLatest: boolean
  activityLatestActionableBacktestJobCanRetry: boolean
  activityLatestBacktestSourceChangeRequestId: string | null
  activityLatestBacktestSourceBacktestId: string | null
  activityLatestBacktestSourceReviewId: string | null
  activityLatestBacktestSourceProposalId: string | null
  activityLatestActionablePrimaryReviewStrategyId: string | null
  activityLatestActionablePrimaryReviewHasRecommendation: boolean
  activityLatestActionablePrimaryReviewRecord: ReviewDocument | null
  activityLatestActionablePrimaryReviewDiffersFromLatest: boolean
  activityLatestTrackingJobLinkedReviewId: string | null
  activityLatestTrackingJobChangeRequestId: string | null
  activityLatestTrackingJobBacktestId: string | null
  activityLatestTrackingJobSourceChangeRequestId: string | null
  activityLatestTrackingJobSourceBacktestId: string | null
  activityLatestTrackingJobSourceReviewId: string | null
  activityLatestTrackingJobSourceProposalId: string | null
  activityLatestTrackingJobStrategyId: string | null
  latestPrimaryReviewOpenId: string | null
  latestTrackingReviewOpenId: string | null
  latestTrackingJobOpenId: string | null
  latestBacktestReviewOpenId: string | null
  latestBacktestJobOpenId: string | null
  latestActionableBacktestJobOpenId: string | null
  latestActionablePrimaryReviewOpenId: string | null
  latestPrimaryReviewSourceJobId: string | null
  latestPrimaryReviewSourceChangeRequestId: string | null
  latestPrimaryReviewSourceBacktestId: string | null
  latestPrimaryReviewSourceReviewId: string | null
  latestPrimaryReviewSourceProposalId: string | null
  latestTrackingReviewSourceJobId: string | null
  latestTrackingReviewSourceChangeRequestId: string | null
  latestTrackingReviewSourceBacktestId: string | null
  latestTrackingReviewSourceReviewId: string | null
  latestTrackingReviewSourceProposalId: string | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onRetryAgentJobWithFocus: (jobId: string) => void
  onRerunBacktestFromRecommendation: (backtest: BacktestRun) => void
  onRerunBacktestFromReview: (review: ReviewDocument | null) => void
}

export type StrategyActivityTopRecentFocusActionsRecentSectionProps = Pick<
  StrategyActivityTopRecentFocusActionsProps,
  | 'showLatestFocusActions'
  | 'strategyId'
  | 'activityLatestProposal'
  | 'activityLatestChangeRequest'
  | 'activityLatestChangeRequestStrategyId'
  | 'activityLatestBacktest'
  | 'activityLatestPrimaryReviewStrategyId'
  | 'activityLatestTrackingReviewStrategyId'
  | 'latestPrimaryReviewOpenId'
  | 'latestTrackingReviewOpenId'
  | 'latestTrackingJobOpenId'
  | 'onOpenStrategyProposal'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenReplayReview'
  | 'onOpenReviewInspector'
  | 'onOpenAiSchedulerJob'
>

export type StrategyActivityTopRecentFocusActionsLineageSectionProps = Pick<
  StrategyActivityTopRecentFocusActionsProps,
  | 'showLineageActions'
  | 'activityLatestBacktest'
  | 'activityLatestBacktestStrategyId'
  | 'activityLatestBacktestReview'
  | 'activityLatestActionableBacktestRecord'
  | 'activityLatestActionableBacktestHasRecommendation'
  | 'activityLatestActionableBacktestDiffersFromLatest'
  | 'activityLatestActionableBacktestJobCanRetry'
  | 'activityLatestBacktestSourceChangeRequestId'
  | 'activityLatestBacktestSourceBacktestId'
  | 'activityLatestBacktestSourceReviewId'
  | 'activityLatestBacktestSourceProposalId'
  | 'activityLatestActionablePrimaryReviewStrategyId'
  | 'activityLatestActionablePrimaryReviewHasRecommendation'
  | 'activityLatestActionablePrimaryReviewRecord'
  | 'activityLatestActionablePrimaryReviewDiffersFromLatest'
  | 'activityLatestTrackingJobLinkedReviewId'
  | 'activityLatestTrackingJobChangeRequestId'
  | 'activityLatestTrackingJobBacktestId'
  | 'activityLatestTrackingJobSourceChangeRequestId'
  | 'activityLatestTrackingJobSourceBacktestId'
  | 'activityLatestTrackingJobSourceReviewId'
  | 'activityLatestTrackingJobSourceProposalId'
  | 'activityLatestTrackingJobStrategyId'
  | 'latestBacktestReviewOpenId'
  | 'latestBacktestJobOpenId'
  | 'latestActionableBacktestJobOpenId'
  | 'latestActionablePrimaryReviewOpenId'
  | 'latestPrimaryReviewSourceJobId'
  | 'latestPrimaryReviewSourceChangeRequestId'
  | 'latestPrimaryReviewSourceBacktestId'
  | 'latestPrimaryReviewSourceReviewId'
  | 'latestPrimaryReviewSourceProposalId'
  | 'latestTrackingReviewSourceJobId'
  | 'latestTrackingReviewSourceChangeRequestId'
  | 'latestTrackingReviewSourceBacktestId'
  | 'latestTrackingReviewSourceReviewId'
  | 'latestTrackingReviewSourceProposalId'
  | 'serviceAvailable'
  | 'backtestMutationPending'
  | 'retryAgentJobMutationPending'
  | 'onOpenStrategyProposal'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenReplayReview'
  | 'onOpenReviewInspector'
  | 'onOpenSourceReview'
  | 'onOpenAiSchedulerJob'
  | 'onRetryAgentJobWithFocus'
  | 'onRerunBacktestFromRecommendation'
  | 'onRerunBacktestFromReview'
>
