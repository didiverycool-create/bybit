import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
} from '../../types'

export type ActivityProposalLinkedState = {
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedChangeRequest: ChangeRequest | null
  linkedJob: AgentJob | null
}

export type ActivityProposalListProps = {
  focusedProposalSupplemented: boolean
  strategyActivityLatestProposalSupplemented: boolean
  strategyActivityLatestActionableProposalSupplemented: boolean
  strategyActivityProposals: StrategyProposal[]
  activityLatestProposal: StrategyProposal | null
  activityLatestActionableProposal: StrategyProposal | null
  selectedProposalId: string | null
  serviceAvailable: boolean
  proposalMutationPending: boolean
  retryAgentJobMutationPending: boolean
  getStrategyActivityProposalLinkedState: (proposal?: StrategyProposal | null) => ActivityProposalLinkedState
  proposalFocusLabels: (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
  getProposalBlockedReason: (proposal: StrategyProposal) => string | null
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onRetryAgentJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}

export type ActivityProposalListItemProps = {
  proposal: StrategyProposal
  linkedState: ActivityProposalLinkedState
  activityLatestProposal: StrategyProposal | null
  activityLatestActionableProposal: StrategyProposal | null
  selectedProposalId: string | null
  serviceAvailable: boolean
  proposalMutationPending: boolean
  retryAgentJobMutationPending: boolean
  proposalFocusLabels: (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
  getProposalBlockedReason: (proposal: StrategyProposal) => string | null
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onRetryAgentJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}
