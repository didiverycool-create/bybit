import type { BuildStrategyWorkspaceCompositeDerivedStateArgs } from './buildStrategyWorkspaceCompositeDerivedState'
import type { useStrategyBacktestSelectionModel } from './useStrategyBacktestSelectionModel'
import type { useStrategyReviewCatalogModel } from './useStrategyReviewCatalogModel'

export type StrategyReviewCatalogModelArgs = Parameters<typeof useStrategyReviewCatalogModel>[0]
export type StrategyReviewCatalogModel = ReturnType<typeof useStrategyReviewCatalogModel>
export type StrategyBacktestSelectionModelArgs = Parameters<typeof useStrategyBacktestSelectionModel>[0]
export type StrategyBacktestSelectionModel = ReturnType<typeof useStrategyBacktestSelectionModel>

export type StrategyWorkspaceActivityModelsForDerived = {
  strategyActivityDecisionModel: BuildStrategyWorkspaceCompositeDerivedStateArgs['strategyActivityDecisionModel']
}
