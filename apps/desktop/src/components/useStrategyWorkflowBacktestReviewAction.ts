import { resolveErrorMessage } from '../utils/app-helpers'

import type { ReviewDocument } from '../types'

import { resolveStrategyName } from './useStrategyWorkflowBacktestActionsShared'
import type { StrategyWorkflowBacktestReviewActionContext } from './useStrategyWorkflowBacktestActions.types'

export function buildStrategyWorkflowBacktestReviewAction({
  backtestMutation,
  strategies,
  setSelectedStrategyId,
  setBacktestRangeDraft,
  setBacktestTimeframeDraft,
  setSelectedBacktestId,
  showFeedback,
}: StrategyWorkflowBacktestReviewActionContext) {
  return async function rerunBacktestFromReview(review?: ReviewDocument | null) {
    if (!review?.strategy_id) {
      return
    }
    const recommendedRange =
      typeof review.decision_recommended_data_range === 'string' && review.decision_recommended_data_range.trim()
        ? review.decision_recommended_data_range.trim()
        : null
    const recommendedTimeframe =
      typeof review.decision_recommended_timeframe === 'string' && review.decision_recommended_timeframe.trim()
        ? review.decision_recommended_timeframe.trim()
        : null
    if (!recommendedRange || !recommendedTimeframe) {
      showFeedback('warning', '当前没有可执行建议', '这条 AI 复盘结果目前没有结构化的建议重跑参数。')
      return
    }

    const strategyName = resolveStrategyName(strategies, review.strategy_id, review.strategy_id)
    setSelectedStrategyId(review.strategy_id)
    setBacktestRangeDraft(recommendedRange)
    setBacktestTimeframeDraft(recommendedTimeframe)

    try {
      const rerunBacktest = await backtestMutation.mutateAsync({
        strategy_id: review.strategy_id,
        data_range: recommendedRange,
        timeframe: recommendedTimeframe,
        source_change_request_id: review.source_change_request_id ?? null,
        source_backtest_id: review.backtest_id ?? null,
        source_review_id: review.id,
        trigger_reason: 'review_decision_rerun',
      })
      setSelectedBacktestId(rerunBacktest.id)
      showFeedback(
        'success',
        '已按复盘建议重跑回测',
        `${strategyName} 已按 ${recommendedTimeframe} / ${recommendedRange} 重新生成回测结果。`,
      )
    } catch (error) {
      showFeedback('error', '按复盘建议重跑失败', resolveErrorMessage(error))
    }
  }
}

