import type { useStrategyActivityDecisionModel } from './useStrategyActivityDecisionModel'
import type { useStrategyBacktestSelectionModel } from './useStrategyBacktestSelectionModel'
import type { useStrategyReviewCatalogModel } from './useStrategyReviewCatalogModel'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  backtestSampleQualityMeta,
  backtestWindowMeta,
} from '../utils/app-helpers'

type StrategyReviewCatalogModel = ReturnType<typeof useStrategyReviewCatalogModel>
type StrategyBacktestSelectionModel = ReturnType<typeof useStrategyBacktestSelectionModel>
type StrategyActivityDecisionModel = ReturnType<typeof useStrategyActivityDecisionModel>

export type BuildStrategyWorkspaceCompositeDerivedStateArgs = {
  reviewCatalogModel: StrategyReviewCatalogModel
  strategyBacktestSelectionModel: StrategyBacktestSelectionModel
  strategyActivityDecisionModel: StrategyActivityDecisionModel
}

export function buildStrategyWorkspaceCompositeDerivedState({
  reviewCatalogModel,
  strategyBacktestSelectionModel,
  strategyActivityDecisionModel,
}: BuildStrategyWorkspaceCompositeDerivedStateArgs) {
  const latestWorkspaceBacktest = strategyBacktestSelectionModel.backtestsForWorkspace[0]
  const latestWorkspaceBacktestDecisionMeta = backtestDecisionReadinessMeta(latestWorkspaceBacktest)
  const latestWorkspaceBacktestSampleMeta = backtestSampleQualityMeta(latestWorkspaceBacktest)
  const latestWorkspaceBacktestWindowMeta = backtestWindowMeta(latestWorkspaceBacktest)
  const latestStrategyBacktestLineageMeta = backtestLineageMeta(reviewCatalogModel.latestStrategyBacktest)
  const selectedStrategyReview = strategyBacktestSelectionModel.selectedStrategyReview
  const selectedStrategyReviewLineageMeta =
    selectedStrategyReview?.period === 'backtest' ? backtestLineageMeta(selectedStrategyReview) : null
  const selectedStrategyReviewDecisionMeta =
    selectedStrategyReview?.period === 'backtest' &&
    (
      selectedStrategyReview.decision_readiness ||
      selectedStrategyReview.decision_readiness_detail ||
      selectedStrategyReview.decision_readiness_action ||
      selectedStrategyReview.decision_recommended_data_range ||
      selectedStrategyReview.decision_recommended_timeframe
    )
      ? backtestDecisionReadinessMeta(selectedStrategyReview)
      : null

  return {
    focusedTrackingReviewId: strategyActivityDecisionModel.focusedTrackingReviewId,
    focusedPrimaryReviewId: strategyActivityDecisionModel.focusedPrimaryReviewId,
    strategyActivityReviewRecords: strategyActivityDecisionModel.strategyActivityReviewRecords,
    strategyActivityJobRecords: strategyActivityDecisionModel.strategyActivityJobRecords,
    selectedStrategyProposal: strategyActivityDecisionModel.selectedStrategyProposal,
    activityLatestActionableProposal: strategyActivityDecisionModel.activityLatestActionableProposal,
    latestWorkspaceBacktest,
    latestWorkspaceBacktestDecisionMeta,
    latestWorkspaceBacktestSampleMeta,
    latestWorkspaceBacktestWindowMeta,
    latestStrategyBacktestLineageMeta,
    selectedStrategyReviewLineageMeta,
    selectedStrategyReviewDecisionMeta,
  }
}
