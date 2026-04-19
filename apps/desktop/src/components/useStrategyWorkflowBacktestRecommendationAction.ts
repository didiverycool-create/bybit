import { backtestDecisionReadinessMeta, resolveErrorMessage } from '../utils/app-helpers'

import type { BacktestRun } from '../types'

import { findLatestBacktestReview, resolveStrategyName } from './useStrategyWorkflowBacktestActionsShared'
import type { StrategyWorkflowBacktestRecommendationActionContext } from './useStrategyWorkflowBacktestActions.types'

export function buildStrategyWorkflowBacktestRecommendationAction({
  backtestMutation,
  strategies,
  reviewCatalog,
  setSelectedStrategyId,
  setBacktestRangeDraft,
  setBacktestTimeframeDraft,
  setSelectedBacktestId,
  showFeedback,
}: StrategyWorkflowBacktestRecommendationActionContext) {
  return async function rerunBacktestFromRecommendation(backtest?: BacktestRun | null) {
    if (!backtest) {
      return
    }
    const decisionMeta = backtestDecisionReadinessMeta(backtest)
    const recommendedRange = decisionMeta?.recommendedRange
    const recommendedTimeframe = decisionMeta?.recommendedTimeframe
    if (!recommendedRange || !recommendedTimeframe) {
      showFeedback('warning', '当前没有可执行建议', '这条回测结果目前没有结构化的建议重跑参数。')
      return
    }

    const linkedReview = findLatestBacktestReview(reviewCatalog, backtest.id)
    const strategyName = resolveStrategyName(strategies, backtest.strategy_id, backtest.strategy_name)
    setSelectedStrategyId(backtest.strategy_id)
    setBacktestRangeDraft(recommendedRange)
    setBacktestTimeframeDraft(recommendedTimeframe)

    try {
      const rerunBacktest = await backtestMutation.mutateAsync({
        strategy_id: backtest.strategy_id,
        data_range: recommendedRange,
        timeframe: recommendedTimeframe,
        source_change_request_id: backtest.source_change_request_id ?? null,
        source_backtest_id: backtest.id,
        source_review_id: linkedReview?.id ?? null,
        trigger_reason: 'decision_rerun',
      })
      setSelectedBacktestId(rerunBacktest.id)
      showFeedback(
        'success',
        '已按建议重跑回测',
        `${strategyName} 已按 ${recommendedTimeframe} / ${recommendedRange} 重新生成回测结果。`,
      )
    } catch (error) {
      showFeedback('error', '按建议重跑失败', resolveErrorMessage(error))
    }
  }
}
