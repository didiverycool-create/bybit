import { resolveErrorMessage } from '../utils/app-helpers'

import type { StrategyWorkflowExecuteSignalActionContext } from './useStrategyWorkflowExecutionActions.types'

export function buildStrategyWorkflowExecuteSignalAction({
  selectedMode,
  selectedStrategy,
  selectedStrategyRuntimePreview,
  selectedStrategyRuntime,
  showFeedback,
  executeStrategySignalMutation,
}: StrategyWorkflowExecuteSignalActionContext) {
  return async function executeSelectedStrategySignal() {
    if (!selectedStrategy || !selectedStrategyRuntimePreview) {
      return
    }
    if (!selectedStrategyRuntimePreview.allowed) {
      showFeedback(
        'warning',
        '当前策略信号不可执行',
        selectedStrategyRuntimePreview.recommended_action
          ? `${selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过。'} 建议 ${selectedStrategyRuntimePreview.recommended_action}`
          : selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过。',
      )
      return
    }

    try {
      const result = await executeStrategySignalMutation.mutateAsync({
        strategyId: selectedStrategy.id,
        note:
          selectedStrategyRuntime?.next_action ??
          `${selectedStrategy.name} 按当前策略信号提交${selectedMode === 'paper' ? '纸面执行' : '真实委托'}`,
        mode: selectedMode,
      })
      if (result.kind === 'paper_trade' && result.trade) {
        showFeedback(
          'success',
          '策略纸面信号已执行',
          `${result.trade.symbol} 已按当前策略运行态写入一笔 ${result.trade.side === 'buy' ? '买入' : '卖出'} 纸面成交。`,
        )
        return
      }
      if (result.kind === 'exchange_order' && result.order) {
        showFeedback(
          'success',
          '策略真实委托已提交',
          `${result.order.symbol} 已按当前策略信号向 Bybit 提交一笔 ${result.order.side === 'buy' ? '买入' : '卖出'} 限价委托。`,
        )
        return
      }
      showFeedback('success', '策略执行已提交', result.message)
    } catch (error) {
      showFeedback(
        'error',
        selectedMode === 'paper' ? '策略纸面信号执行失败' : '策略真实委托提交失败',
        resolveErrorMessage(error),
      )
    }
  }
}
