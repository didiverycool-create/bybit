import type { BacktestRun, ChangeRequest, StrategySummary } from '../../types'

export type SelectedChangeRequestPanelSampleMeta = {
  label: string
  description: string
  chipClass: string
} | null

export type SelectedChangeRequestPanelDecisionMeta = {
  label: string
  detail: string
  recommendedRange?: string | null
  recommendedTimeframe?: string | null
  nextAction?: string | null
  chipClass?: string
} | null

export type SelectedChangeRequestPanelWindowMeta = {
  attention: boolean
  truncated?: boolean
  label: string
  description: string
  detail: string
  nextAction?: string | null
  chipClass: string
} | null

export type SelectedChangeRequestPanelRecommendationMeta = {
  recommendedRange: string
  recommendedTimeframe: string
  nextAction?: string | null
} | null

export type SelectedChangeRequestPanelProps = {
  selectedStrategy: StrategySummary
  selectedStrategyChangeRequest: ChangeRequest
  backtests: BacktestRun[]
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string, options?: { focusJob?: boolean }) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

export type SelectedChangeRequestPanelViewProps = Omit<SelectedChangeRequestPanelProps, 'backtests'> & {
  strategyId: string | null
  linkedBacktestId: string | null
  manualFollowupDetail: string | null
  sampleMeta: SelectedChangeRequestPanelSampleMeta
  decisionMeta: SelectedChangeRequestPanelDecisionMeta
  windowMeta: SelectedChangeRequestPanelWindowMeta
  rerunRecommendation: SelectedChangeRequestPanelRecommendationMeta
  sourceBacktestId: string | null
  sourceReviewId: string | null
  sourceProposalId: string | null
}
