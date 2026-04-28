import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  Mode,
  ReviewDocument,
  SchedulerState,
  StrategyActivitySnapshot,
  StrategySummary,
} from '../types'

export type UseStrategyWorkspaceCompositeModelArgs = {
  selectedStrategy: StrategySummary | null
  selectedStrategyActivity?: StrategyActivitySnapshot | null
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  backtestFilter: 'selected' | 'all'
  reviewInspectorReviewId: string | null
  replayFocusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  backtests: BacktestRun[]
  reviews: ReviewDocument[]
  selectedStrategyReviewsData?: ReviewDocument[]
  selectedBacktestReviewsData?: ReviewDocument[]
  replayTrackingReviewsData?: ReviewDocument[]
  changeRequests: ChangeRequest[]
  schedulerJobs: AgentJob[]
  schedulerState?: SchedulerState | null
  selectedMode: Mode
}
