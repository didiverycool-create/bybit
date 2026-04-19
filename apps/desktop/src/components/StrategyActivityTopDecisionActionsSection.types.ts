import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyActivityBacktestSummary,
  StrategyProposal,
} from '../types'

export type StrategyActivityTopDecisionActionsSectionProps = {
  strategyId: string
  latestProposalChangeSummaryText: string | null
  activityLatestProposal: StrategyProposal | null
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestChangeRequestStrategyId: string | null
  activityLatestBacktest: StrategyActivityBacktestSummary | null
  activityLatestPrimaryReview: ReviewDocument | null
  activityLatestPrimaryReviewRecord: ReviewDocument | null
  activityLatestPrimaryReviewStrategyId: string | null
  activityLatestTrackingReview: ReviewDocument | null
  activityLatestTrackingReviewRecord: ReviewDocument | null
  activityLatestTrackingReviewStrategyId: string | null
  activityLatestTrackingJob: AgentJob | null
  activityLatestTrackingJobRecord: AgentJob | null
  activityLatestBacktestReview: ReviewDocument | null
  activityLatestBacktestReviewRecord: ReviewDocument | null
  activityLatestBacktestJob: AgentJob | null
  activityLatestBacktestJobRecord: AgentJob | null
  activityLatestActionableBacktestRecord: BacktestRun | null
  activityLatestActionableBacktestHasRecommendation: boolean
  activityLatestActionableBacktestDiffersFromLatest: boolean
  activityLatestActionableBacktestJob: AgentJob | null
  activityLatestActionableBacktestJobRecord: AgentJob | null
  activityLatestActionableBacktestJobCanRetry: boolean
  activityLatestBacktestStrategyId: string | null
  activityLatestBacktestSourceChangeRequestId: string | null
  activityLatestBacktestSourceBacktestId: string | null
  activityLatestBacktestSourceReviewId: string | null
  activityLatestBacktestSourceProposalId: string | null
  activityLatestActionablePrimaryReview: ReviewDocument | null
  activityLatestActionablePrimaryReviewRecord: ReviewDocument | null
  activityLatestActionablePrimaryReviewStrategyId: string | null
  activityLatestActionablePrimaryReviewHasRecommendation: boolean
  activityLatestActionablePrimaryReviewDiffersFromLatest: boolean
  activityLatestTrackingJobLinkedReviewId: string | null
  activityLatestTrackingJobChangeRequestId: string | null
  activityLatestTrackingJobBacktestId: string | null
  activityLatestTrackingJobSourceChangeRequestId: string | null
  activityLatestTrackingJobSourceBacktestId: string | null
  activityLatestTrackingJobSourceReviewId: string | null
  activityLatestTrackingJobSourceProposalId: string | null
  activityLatestTrackingJobStrategyId: string | null
  activityLatestProposalLinkedChangeRequest: ChangeRequest | null
  activityLatestProposalLinkedBacktest: BacktestRun | null
  activityLatestProposalLinkedReview: ReviewDocument | null
  activityLatestProposalLinkedJob: AgentJob | null
  activityLatestChangeRequestLinkedBacktestId: string | null
  activityLatestChangeRequestLinkedReviewId: string | null
  activityLatestChangeRequestLinkedJob: AgentJob | null
  activityLatestChangeRequestSourceBacktestId: string | null
  activityLatestChangeRequestSourceBacktestStrategyId: string | null
  activityLatestChangeRequestSourceReviewId: string | null
  activityLatestChangeRequestSourceReviewStrategyId: string | null
  activityLatestChangeRequestSourceProposalId: string | null
  activityLatestChangeRequestSourceProposalStrategyId: string | null
  activityLatestActionableProposal: StrategyProposal | null
  activityLatestActionableProposalDiffersFromLatest: boolean
  activityLatestActionableProposalAcceptTitle: string | null
  activityLatestActionableProposalAcceptDisabled: boolean
  activityLatestActionableChangeRequest: ChangeRequest | null
  activityLatestActionableChangeRequestDiffersFromLatest: boolean
  activityLatestActionableChangeRequestLinkedJobId: string | null
  activityLatestActionableChangeRequestHasRerunRecommendation: boolean
  activityLatestRetryableTrackingJob: AgentJob | null
  activityLatestRetryableTrackingJobRecord: AgentJob | null
  activityLatestRetryableTrackingJobDiffersFromLatest: boolean
  serviceAvailable: boolean
  proposalMutationPending: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
  onRetryAgentJobWithFocus: (jobId: string) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
  onRerunBacktestFromRecommendation: (backtest: BacktestRun) => void
  onRerunBacktestFromReview: (review: ReviewDocument | null) => void
}

