import type { UseStrategyWorkspaceCompositeModelArgs } from './useStrategyWorkspaceCompositeModel.types'
import type { StrategyReviewCatalogModelArgs } from './buildStrategyWorkspaceCompositeModelGroups.types'

export function buildStrategyWorkspaceCompositeReviewCatalogArgs({
  selectedStrategy,
  backtests,
  reviews,
  selectedStrategyReviewsData,
  selectedBacktestReviewsData,
  replayTrackingReviewsData,
  changeRequests,
  schedulerJobs,
}: UseStrategyWorkspaceCompositeModelArgs): StrategyReviewCatalogModelArgs {
  return {
    selectedStrategy,
    backtests,
    reviews,
    selectedStrategyReviewsData,
    selectedBacktestReviewsData,
    replayTrackingReviewsData,
    changeRequests,
    schedulerJobs,
  }
}
