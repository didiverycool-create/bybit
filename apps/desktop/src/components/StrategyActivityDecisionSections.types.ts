import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyActivityBacktestSummary,
  StrategyProposal,
} from '../types'
import type { ActivityBacktestListProps } from './strategy-activity-sections/ActivityBacktestList'
import type { ActivityChangeRequestListProps } from './strategy-activity-sections/ActivityChangeRequestList.types'
import type { ActivityProposalListProps } from './strategy-activity-sections/ActivityProposalList.types'

export type ProposalLinkedState = {
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedChangeRequest: ChangeRequest | null
  linkedJob: AgentJob | null
}

export type ChangeRequestLinkedState = {
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedJob: AgentJob | null
  sourceBacktest: BacktestRun | null
  sourceReview: ReviewDocument | null
  sourceProposal: StrategyProposal | null
}

export type StrategyActivityDecisionSectionsProps = {
  strategyId: string
  recentProposalIds: string[]
  recentChangeRequestIds: string[]
  recentBacktestIds: string[]
  selectedStrategyProposal: StrategyProposal | null
  selectedStrategyChangeRequest: ChangeRequest | null
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktest: BacktestRun | null
  strategyActivityLatestProposalSupplemented: boolean
  strategyActivityLatestActionableProposalSupplemented: boolean
  strategyActivityLatestChangeRequestSupplemented: boolean
  strategyActivityLatestActionableChangeRequestSupplemented: boolean
  strategyActivityLatestBacktestSupplemented: boolean
  strategyActivityLatestActionableBacktestSupplemented: boolean
  strategyActivityProposals: StrategyProposal[]
  strategyActivityChangeRequests: ChangeRequest[]
  strategyActivityBacktests: StrategyActivityBacktestSummary[]
  activityLatestProposal: StrategyProposal | null
  activityLatestActionableProposal: StrategyProposal | null
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestActionableChangeRequest: ChangeRequest | null
  activityLatestBacktest: StrategyActivityBacktestSummary | null
  activityLatestActionableBacktest: StrategyActivityBacktestSummary | null
  activityLatestActionableBacktestReview: ReviewDocument | null
  activityLatestBacktestReview: ReviewDocument | null
  activityLatestActionableBacktestJob: AgentJob | null
  activityLatestBacktestJob: AgentJob | null
  backtests: BacktestRun[]
  reviewCatalog: ReviewDocument[]
  backtestReviewJobs: AgentJob[]
  serviceAvailable: boolean
  proposalMutationPending: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  getStrategyActivityProposalLinkedState: (proposal?: StrategyProposal | null) => ProposalLinkedState
  getStrategyActivityChangeRequestLinkedState: (request?: ChangeRequest | null) => ChangeRequestLinkedState
  proposalFocusLabels: (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
  getProposalBlockedReason: (proposal: StrategyProposal) => string | null
  backtestFocusLabels: (
    backtest: StrategyActivityBacktestSummary,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

export type StrategyActivityDecisionSectionsViewProps = {
  proposalListProps: ActivityProposalListProps
  changeRequestListProps: ActivityChangeRequestListProps
  backtestListProps: ActivityBacktestListProps
}
