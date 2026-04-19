import type { UseStrategyWorkspaceCompositeModelArgs } from './useStrategyWorkspaceCompositeModel.types'
import type {
  StrategyBacktestSelectionModelArgs,
  StrategyReviewCatalogModel,
} from './buildStrategyWorkspaceCompositeModelGroups.types'

export function buildStrategyWorkspaceCompositeBacktestSelectionArgs(
  {
    selectedStrategy,
    selectedChangeRequestId,
    selectedBacktestId,
    selectedBacktestReviewsData,
    backtests,
    backtestFilter,
    changeRequests,
  }: UseStrategyWorkspaceCompositeModelArgs,
  reviewCatalogModel: StrategyReviewCatalogModel,
): StrategyBacktestSelectionModelArgs {
  return {
    latestStrategyBacktest: reviewCatalogModel.latestStrategyBacktest,
    selectedStrategy,
    selectedChangeRequestId,
    selectedBacktestId,
    selectedStrategyReviews: reviewCatalogModel.selectedStrategyReviews,
    selectedBacktestReviewsData,
    reviewCatalog: reviewCatalogModel.reviewCatalog,
    backtests,
    backtestFilter,
    backtestReviewJobs: reviewCatalogModel.backtestReviewJobs,
    strategyProposals: reviewCatalogModel.strategyProposals,
    changeRequests,
  }
}
