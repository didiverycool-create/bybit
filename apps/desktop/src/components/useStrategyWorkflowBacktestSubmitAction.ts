import { resolveErrorMessage } from '../utils/app-helpers'

import type { StrategyWorkflowBacktestSubmitActionContext } from './useStrategyWorkflowBacktestActions.types'

export function buildStrategyWorkflowBacktestSubmitAction({
  backtestMutation,
  selectedStrategy,
  backtestRangeDraft,
  backtestTimeframeDraft,
  showFeedback,
}: StrategyWorkflowBacktestSubmitActionContext) {
  return async function submitBacktest() {
    if (!selectedStrategy) {
      return
    }
    try {
      await backtestMutation.mutateAsync({
        strategy_id: selectedStrategy.id,
        data_range: backtestRangeDraft,
        timeframe: backtestTimeframeDraft,
      })
      showFeedback(
        'success',
        '回测任务已完成',
        `${selectedStrategy.name} 已按 ${backtestTimeframeDraft} / ${backtestRangeDraft} 写回新的回测结果。`,
      )
    } catch (error) {
      showFeedback('error', '回测发起失败', resolveErrorMessage(error))
    }
  }
}

