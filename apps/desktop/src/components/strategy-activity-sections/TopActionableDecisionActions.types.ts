import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
} from '../../types'

export type TopActionableDecisionActionsProps = {
  showProposalChangeActions: boolean
  showActionableActions: boolean
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestChangeRequestStrategyId: string | null
  activityLatestChangeRequestLinkedBacktestId: string | null
  activityLatestChangeRequestLinkedReviewId: string | null
  activityLatestChangeRequestSourceBacktestId: string | null
  activityLatestChangeRequestSourceBacktestStrategyId: string | null
  activityLatestChangeRequestSourceReviewId: string | null
  activityLatestChangeRequestSourceReviewStrategyId: string | null
  activityLatestChangeRequestSourceProposalId: string | null
  activityLatestChangeRequestSourceProposalStrategyId: string | null
  activityLatestProposalLinkedChangeRequest: ChangeRequest | null
  activityLatestProposalLinkedBacktest: BacktestRun | null
  activityLatestProposalLinkedReview: ReviewDocument | null
  activityLatestActionableProposal: StrategyProposal | null
  activityLatestActionableProposalDiffersFromLatest: boolean
  activityLatestActionableProposalAcceptTitle: string | null
  activityLatestActionableProposalAcceptDisabled: boolean
  activityLatestActionableChangeRequest: ChangeRequest | null
  activityLatestActionableChangeRequestDiffersFromLatest: boolean
  activityLatestActionableChangeRequestHasRerunRecommendation: boolean
  activityLatestRetryableTrackingJob: AgentJob | null
  activityLatestRetryableTrackingJobDiffersFromLatest: boolean
  latestProposalChangeRequestStrategyId: string | null
  latestProposalReviewStrategyId: string
  latestProposalJobId: string | null
  latestChangeRequestJobId: string | null
  actionableChangeRequestRetryJobId: string | null
  actionableChangeRequestCanRetry: boolean
  retryableTrackingJobOpenId: string | null
  serviceAvailable: boolean
  proposalMutationPending: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
  onRetryAgentJobWithFocus: (jobId: string) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

export type TopActionableDecisionActionsProposalChangeSectionProps = Pick<
  TopActionableDecisionActionsProps,
  | 'showProposalChangeActions'
  | 'activityLatestChangeRequest'
  | 'activityLatestChangeRequestStrategyId'
  | 'activityLatestChangeRequestLinkedBacktestId'
  | 'activityLatestChangeRequestLinkedReviewId'
  | 'activityLatestChangeRequestSourceBacktestId'
  | 'activityLatestChangeRequestSourceBacktestStrategyId'
  | 'activityLatestChangeRequestSourceReviewId'
  | 'activityLatestChangeRequestSourceReviewStrategyId'
  | 'activityLatestChangeRequestSourceProposalId'
  | 'activityLatestChangeRequestSourceProposalStrategyId'
  | 'activityLatestProposalLinkedChangeRequest'
  | 'activityLatestProposalLinkedBacktest'
  | 'activityLatestProposalLinkedReview'
  | 'latestProposalChangeRequestStrategyId'
  | 'latestProposalReviewStrategyId'
  | 'latestProposalJobId'
  | 'latestChangeRequestJobId'
  | 'onOpenStrategyProposal'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenReplayReview'
  | 'onOpenReviewInspector'
  | 'onOpenSourceReview'
  | 'onOpenAiSchedulerJob'
>

export type TopActionableDecisionActionsActionableSectionProps = Pick<
  TopActionableDecisionActionsProps,
  | 'showActionableActions'
  | 'activityLatestActionableProposal'
  | 'activityLatestActionableProposalDiffersFromLatest'
  | 'activityLatestActionableProposalAcceptTitle'
  | 'activityLatestActionableProposalAcceptDisabled'
  | 'activityLatestActionableChangeRequest'
  | 'activityLatestActionableChangeRequestDiffersFromLatest'
  | 'activityLatestActionableChangeRequestHasRerunRecommendation'
  | 'activityLatestRetryableTrackingJob'
  | 'activityLatestRetryableTrackingJobDiffersFromLatest'
  | 'actionableChangeRequestRetryJobId'
  | 'actionableChangeRequestCanRetry'
  | 'retryableTrackingJobOpenId'
  | 'serviceAvailable'
  | 'proposalMutationPending'
  | 'backtestMutationPending'
  | 'retryAgentJobMutationPending'
  | 'onHandleProposalAction'
  | 'onRetryAgentJobWithFocus'
  | 'onRerunBacktestFromChangeRequest'
>
