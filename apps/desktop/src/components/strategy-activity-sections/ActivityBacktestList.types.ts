import type {
  AgentJob,
  BacktestRun,
  ReviewDocument,
  StrategyActivityBacktestSummary,
} from '../../types'

export type BacktestFocusLabels = (
  backtest: StrategyActivityBacktestSummary,
  linkedReview?: ReviewDocument | null,
  linkedJob?: AgentJob | null,
) => string[]

export type ActivityBacktestListProps = {
  strategyId: string
  focusedBacktestSupplemented: boolean
  strategyActivityLatestBacktestSupplemented: boolean
  strategyActivityLatestActionableBacktestSupplemented: boolean
  strategyActivityBacktests: StrategyActivityBacktestSummary[]
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
  retryAgentJobMutationPending: boolean
  backtestFocusLabels: BacktestFocusLabels
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
}

export type ActivityBacktestListItemProps = {
  strategyId: string
  backtest: StrategyActivityBacktestSummary
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
  retryAgentJobMutationPending: boolean
  backtestFocusLabels: BacktestFocusLabels
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
}
