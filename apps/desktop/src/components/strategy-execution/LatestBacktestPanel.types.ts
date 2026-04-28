import type { AgentJob, BacktestRun, StrategyRuntimeSnapshot, StrategySummary } from '../../types'

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

export type LatestBacktestPanelProps = {
  selectedStrategy: StrategySummary
  latestStrategyBacktest: BacktestRun | null
  latestStrategyBacktestDecisionMeta: BacktestDecisionMeta
  latestStrategyBacktestSampleMeta: BacktestSampleMeta
  latestStrategyBacktestWindowMeta: BacktestWindowMeta
  latestStrategyBacktestLineageMeta: BacktestLineageMeta
  latestStrategyBacktestReview: { id: string } | null
  latestStrategyBacktestReviewJob: AgentJob | null
  latestStrategyBacktestReviewJobMeta: BacktestReviewJobMeta
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onRetryAgentJob: (jobId: string, options?: { focusJob?: boolean }) => void
  onRerunBacktestFromRecommendation: (backtest: BacktestRun) => void
}

export type LatestBacktestPanelViewProps = LatestBacktestPanelProps & {
  selectedStrategySymbolsLabel: string
}
