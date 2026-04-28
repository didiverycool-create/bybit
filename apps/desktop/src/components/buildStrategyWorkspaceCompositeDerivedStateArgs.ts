import type { BuildStrategyWorkspaceCompositeDerivedStateArgs } from './buildStrategyWorkspaceCompositeDerivedState'
import type {
  StrategyBacktestSelectionModel,
  StrategyReviewCatalogModel,
  StrategyWorkspaceActivityModelsForDerived,
} from './buildStrategyWorkspaceCompositeModelGroups.types'

export function buildStrategyWorkspaceCompositeDerivedStateArgs(
  reviewCatalogModel: StrategyReviewCatalogModel,
  strategyBacktestSelectionModel: StrategyBacktestSelectionModel,
  strategyWorkspaceActivityModels: StrategyWorkspaceActivityModelsForDerived,
): BuildStrategyWorkspaceCompositeDerivedStateArgs {
  return {
    reviewCatalogModel,
    strategyBacktestSelectionModel,
    strategyActivityDecisionModel: strategyWorkspaceActivityModels.strategyActivityDecisionModel,
  }
}
