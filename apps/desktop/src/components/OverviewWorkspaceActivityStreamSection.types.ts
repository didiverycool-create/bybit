import type { AgentJob, ChangeRequest, ExecutionEvent } from '../types'

export type OverviewWorkspaceActivityStreamSectionProps = {
  schedulerJobs: AgentJob[]
  overviewAiEvents: ExecutionEvent[]
  overviewQueuedRequests: ChangeRequest[]
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId: string) => void
  onOpenAiSchedulerJob: (jobId: string) => void
}

export type OverviewWorkspaceActivityStreamSchedulerJobRowProps = {
  job: AgentJob
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId: string) => void
}

export type OverviewWorkspaceActivityStreamEventRowProps = {
  event: ExecutionEvent
  index: number
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId: string) => void
  onOpenAiSchedulerJob: (jobId: string) => void
}

export type OverviewWorkspaceActivityStreamQueuedRequestRowProps = {
  item: ChangeRequest
  index: number
}
