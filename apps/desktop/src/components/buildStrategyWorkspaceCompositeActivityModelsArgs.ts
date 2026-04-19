import type { UseStrategyWorkspaceCompositeModelArgs } from './useStrategyWorkspaceCompositeModel.types'
import type { UseStrategyWorkspaceActivityModelsArgs } from './useStrategyWorkspaceActivityModels.types'
import type {
  StrategyBacktestSelectionModel,
  StrategyReviewCatalogModel,
} from './buildStrategyWorkspaceCompositeModelGroups.types'

export function buildStrategyWorkspaceCompositeActivityModelsArgs(
  {
    selectedStrategy,
    selectedStrategyActivity,
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    backtests,
    schedulerJobs,
    schedulerState,
    selectedMode,
  }: UseStrategyWorkspaceCompositeModelArgs,
  reviewCatalogModel: StrategyReviewCatalogModel,
  strategyBacktestSelectionModel: StrategyBacktestSelectionModel,
): UseStrategyWorkspaceActivityModelsArgs {
  return {
    selectedStrategy,
    selectedStrategyActivity,
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    backtests,
    schedulerJobs,
    schedulerState,
    selectedMode,
    reviewCatalogModel,
    strategyBacktestSelectionModel,
  }
}
