import type { ChangeRequest } from '../types'
import {
  getChangeRequestLinkedBacktestId,
  getChangeRequestLinkedBacktestRecommendation,
  getChangeRequestStrategyId,
  resolveErrorMessage,
} from '../utils/app-helpers'

import { resolveStrategyName } from './useStrategyWorkflowBacktestActionsShared'
import type { StrategyWorkflowBacktestChangeRequestActionContext } from './useStrategyWorkflowBacktestActions.types'

export function buildStrategyWorkflowBacktestChangeRequestAction({
  backtestMutation,
  selectedStrategy,
  strategies,
  backtests,
  setSelectedStrategyId,
  setBacktestRangeDraft,
  setBacktestTimeframeDraft,
  setSelectedBacktestId,
  showFeedback,
}: StrategyWorkflowBacktestChangeRequestActionContext) {
  return async function rerunBacktestFromChangeRequest(request?: ChangeRequest | null) {
    if (!request) {
      return
    }
    const strategyId = getChangeRequestStrategyId(request, selectedStrategy?.id ?? null)
    const linkedBacktestId = getChangeRequestLinkedBacktestId(request)
    const linkedBacktest = linkedBacktestId ? backtests.find((item) => item.id === linkedBacktestId) ?? null : null
    const rerunRecommendation = getChangeRequestLinkedBacktestRecommendation(request, linkedBacktest)
    const recommendedRange = rerunRecommendation?.recommendedRange ?? null
    const recommendedTimeframe = rerunRecommendation?.recommendedTimeframe ?? null
    if (!strategyId || !linkedBacktestId || !recommendedRange || !recommendedTimeframe) {
      showFeedback('warning', '当前没有可执行建议', '这条变更当前还没有可直接执行的结构化重跑参数。')
      return
    }

    const strategyName = resolveStrategyName(strategies, strategyId, strategyId)
    setSelectedStrategyId(strategyId)
    setBacktestRangeDraft(recommendedRange)
    setBacktestTimeframeDraft(recommendedTimeframe)

    try {
      const rerunBacktest = await backtestMutation.mutateAsync({
        strategy_id: strategyId,
        data_range: recommendedRange,
        timeframe: recommendedTimeframe,
        source_change_request_id: request.id,
        source_backtest_id: linkedBacktestId,
        source_review_id: request.linked_review_id ?? request.source_review_id ?? null,
        source_proposal_id: request.source_proposal_id ?? null,
        trigger_reason: 'decision_rerun',
      })
      setSelectedBacktestId(rerunBacktest.id)
      showFeedback(
        'success',
        '已按变更卡片建议重跑回测',
        `${strategyName} 已按 ${recommendedTimeframe} / ${recommendedRange} 重新生成回测结果。`,
      )
    } catch (error) {
      showFeedback('error', '按变更卡片建议重跑失败', resolveErrorMessage(error))
    }
  }
}
