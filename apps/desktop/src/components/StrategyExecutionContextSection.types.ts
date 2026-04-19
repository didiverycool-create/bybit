import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
  StrategyRuntimeSnapshot,
  StrategySummary,
} from '../types'

export type BacktestDecisionMeta = {
  label: string
  description: string
  recommendedRange?: string | null
  recommendedTimeframe?: string | null
  nextAction?: string | null
  chipClass?: string
} | null

export type BacktestSampleMeta = {
  label: string
  description: string
  chipClass: string
} | null

export type BacktestWindowMeta = {
  attention: boolean
  truncated?: boolean
  label: string
  description: string
  detail: string
  nextAction?: string | null
  chipClass: string
} | null

export type BacktestLineageMeta = {
  label: string
  detail: string
} | null

export type BacktestReviewJobMeta = {
  label: string
  detail: string
  canRetry: boolean
} | null

export type StrategyExecutionContextSectionProps = {
  selectedStrategy: StrategySummary
  latestStrategyBacktest: BacktestRun | null
  latestStrategyBacktestDecisionMeta: BacktestDecisionMeta
  latestStrategyBacktestSampleMeta: BacktestSampleMeta
  latestStrategyBacktestWindowMeta: BacktestWindowMeta
  latestStrategyBacktestLineageMeta: BacktestLineageMeta
  latestStrategyBacktestReview: ReviewDocument | null
  latestStrategyBacktestReviewJob: AgentJob | null
  latestStrategyBacktestReviewJobMeta: BacktestReviewJobMeta
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  selectedStrategyChangeRequest: ChangeRequest | null
  allStrategyChangeRequests: ChangeRequest[]
  strategyChangeRequests: ChangeRequest[]
  strategyProposals: StrategyProposal[]
  backtests: BacktestRun[]
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  reviewInspectorReviewId: string | null
  replayFocusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  gatedPublishProposalCount: number
  schedulerState?: { status?: string; freeze_publish?: boolean } | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  proposalMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string, options?: { focusJob?: boolean }) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
  onRerunBacktestFromRecommendation: (backtest: BacktestRun) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

export type StrategyExecutionContextSectionViewProps = StrategyExecutionContextSectionProps & {
  proposalFocusLabels: (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
}
