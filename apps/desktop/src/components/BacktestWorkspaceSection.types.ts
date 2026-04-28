import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument, StrategySummary, StrategyProposal } from '../types'

export type BacktestOption = {
  value: string
  label: string
}

export type BacktestSampleMeta = {
  label: string
  description: string
  chipClass: string
} | null

export type BacktestDecisionMeta = {
  label: string
  description: string
  recommendedRange?: string | null
  recommendedTimeframe?: string | null
  nextAction?: string | null
  chipClass?: string
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

export type BacktestParameterComparisonItem = {
  key: string
  label: string
  backtestValue: string
  currentValue: string
  changed: boolean
}

export type BacktestWorkspaceSectionProps = {
  selectedStrategy: StrategySummary | null
  strategies: StrategySummary[]
  backtestFilter: 'selected' | 'all'
  onSelectBacktestFilter: (value: 'selected' | 'all') => void
  backtestsForWorkspace: BacktestRun[]
  latestWorkspaceBacktest: BacktestRun | null
  latestWorkspaceBacktestDecisionMeta: BacktestDecisionMeta
  latestWorkspaceBacktestWindowMeta: BacktestWindowMeta
  latestWorkspaceBacktestSampleMeta: BacktestSampleMeta
  openStrategyProposalsCount: number
  backtestTimeframeDraft: string
  onSelectBacktestTimeframeDraft: (value: string) => void
  backtestTimeframeOptions: BacktestOption[]
  backtestRangeDraft: string
  onSelectBacktestRangeDraft: (value: string) => void
  backtestRangeOptions: BacktestOption[]
  onSelectStrategyId: (strategyId: string) => void
  serviceAvailable: boolean
  backtestMutationPending: boolean
  onSubmitBacktest: () => void
  onOpenStrategySection: () => void
  selectedBacktest: BacktestRun | null
  onSelectBacktestId: (backtestId: string) => void
  selectedBacktestSampleMeta: BacktestSampleMeta
  selectedBacktestWindowMeta: BacktestWindowMeta
  selectedBacktestDecisionMeta: BacktestDecisionMeta
  selectedBacktestLineageMeta: BacktestLineageMeta
  selectedBacktestReview: ReviewDocument | null
  selectedBacktestReviewJob: AgentJob | null
  selectedBacktestReviewJobMeta: BacktestReviewJobMeta
  selectedBacktestProposals: StrategyProposal[]
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  schedulerState?: { status?: string; freeze_publish?: boolean } | null
  selectedProposalId: string | null
  proposalMutationPending: boolean
  retryAgentJobMutationPending: boolean
  backtestParameterComparison: BacktestParameterComparisonItem[]
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
  onRerunBacktestFromRecommendation: (backtest: BacktestRun) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void
}
