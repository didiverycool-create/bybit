import { buildStrategyWorkspaceCompositeDerivedState } from './buildStrategyWorkspaceCompositeDerivedState'
import {
  buildStrategyWorkspaceCompositeActivityModelsArgs,
  buildStrategyWorkspaceCompositeBacktestSelectionArgs,
  buildStrategyWorkspaceCompositeDerivedStateArgs,
  buildStrategyWorkspaceCompositeReviewCatalogArgs,
} from './buildStrategyWorkspaceCompositeModelGroups'
import { useStrategyBacktestSelectionModel } from './useStrategyBacktestSelectionModel'
import { useStrategyReviewCatalogModel } from './useStrategyReviewCatalogModel'
import { useStrategyWorkspaceActivityModels } from './useStrategyWorkspaceActivityModels'
import type { UseStrategyWorkspaceCompositeModelArgs } from './useStrategyWorkspaceCompositeModel.types'

export function useStrategyWorkspaceCompositeModel({
  ...args
}: UseStrategyWorkspaceCompositeModelArgs) {
  const reviewCatalogSource = buildStrategyWorkspaceCompositeReviewCatalogArgs(args)
  const reviewCatalogModel = useStrategyReviewCatalogModel(
    reviewCatalogSource,
  )
  const strategyBacktestSelectionSource = buildStrategyWorkspaceCompositeBacktestSelectionArgs(
    args,
    reviewCatalogModel,
  )
  const strategyBacktestSelectionModel = useStrategyBacktestSelectionModel(
    strategyBacktestSelectionSource,
  )
  const strategyWorkspaceActivitySource = buildStrategyWorkspaceCompositeActivityModelsArgs(
    args,
    reviewCatalogModel,
    strategyBacktestSelectionModel,
  )
  const strategyWorkspaceActivityModels = useStrategyWorkspaceActivityModels(
    strategyWorkspaceActivitySource,
  )

  const strategyWorkspaceCompositeDerivedStateSource =
    buildStrategyWorkspaceCompositeDerivedStateArgs(
      reviewCatalogModel,
      strategyBacktestSelectionModel,
      strategyWorkspaceActivityModels,
    )
  const strategyWorkspaceCompositeDerivedState = buildStrategyWorkspaceCompositeDerivedState(
    strategyWorkspaceCompositeDerivedStateSource,
  )

  return {
    ...reviewCatalogModel,
    ...strategyBacktestSelectionModel,
    ...strategyWorkspaceActivityModels,
    ...strategyWorkspaceCompositeDerivedState,
  }
}
