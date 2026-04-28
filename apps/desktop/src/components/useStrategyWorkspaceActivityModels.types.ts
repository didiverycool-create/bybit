import type {
  AgentJob,
  BacktestRun,
  Mode,
  SchedulerState,
  StrategyActivitySnapshot,
  StrategySummary,
} from '../types'
import type { useStrategyBacktestSelectionModel } from './useStrategyBacktestSelectionModel'
import type { useStrategyReviewCatalogModel } from './useStrategyReviewCatalogModel'

type StrategyReviewCatalogModel = ReturnType<typeof useStrategyReviewCatalogModel>
type StrategyBacktestSelectionModel = ReturnType<typeof useStrategyBacktestSelectionModel>

export type UseStrategyWorkspaceActivityModelsArgs = {
  selectedStrategy: StrategySummary | null
  selectedStrategyActivity?: StrategyActivitySnapshot | null
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  reviewInspectorReviewId: string | null
  replayFocusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  backtests: BacktestRun[]
  schedulerJobs: AgentJob[]
  schedulerState?: SchedulerState | null
  selectedMode: Mode
  reviewCatalogModel: StrategyReviewCatalogModel
  strategyBacktestSelectionModel: StrategyBacktestSelectionModel
}
