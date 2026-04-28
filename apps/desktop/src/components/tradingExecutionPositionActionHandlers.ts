import type { BuildTradingExecutionActionHandlersArgs } from './buildTradingExecutionActionHandlers'
import { runTradingExecutionAction } from './tradingExecutionAsyncHelpers'

type TradingExecutionPositionActionArgs = Pick<
  BuildTradingExecutionActionHandlersArgs,
  'showFeedback' | 'mutations'
>

function buildClosePaperPositionAction({
  showFeedback,
  mutations,
}: TradingExecutionPositionActionArgs) {
  return async (symbol: string) => {
    await runTradingExecutionAction({
      execute: () => mutations.closePaperPositionMutation.mutateAsync(symbol),
      failureTitle: 'Paper 平仓失败',
      showFeedback,
      onSuccess: (trade) => {
        showFeedback('success', 'Paper 持仓已平仓', `${trade.symbol} 已按当前参考价写入一笔纸面平仓。`)
      },
    })
  }
}

function buildCloseExchangePositionAction({
  showFeedback,
  mutations,
}: TradingExecutionPositionActionArgs) {
  return async (symbol: string) => {
    await runTradingExecutionAction({
      execute: () => mutations.closeExchangePositionMutation.mutateAsync(symbol),
      failureTitle: '真实持仓平仓失败',
      showFeedback,
      onSuccess: (order) => {
        showFeedback(
          'success',
          '真实持仓平仓委托已提交',
          `${order.symbol} 的平仓限价委托已提交到 Bybit，订单号 ${order.order_id}。`,
        )
      },
    })
  }
}

function buildCloseAllPaperPositionsAction({
  showFeedback,
  mutations,
}: TradingExecutionPositionActionArgs) {
  return async () => {
    await runTradingExecutionAction({
      execute: () => mutations.closeAllPaperPositionsMutation.mutateAsync(),
      failureTitle: '批量平仓失败',
      showFeedback,
      onSuccess: (result) => {
        showFeedback(
          'success',
          result.closed_count > 0 ? '已批量平掉 Paper 持仓' : '当前没有可平的 Paper 持仓',
          result.closed_count > 0
            ? `本次共按参考价平掉 ${result.closed_count} 个本地持仓方向。`
            : 'Paper 持仓当前为空。',
        )
      },
    })
  }
}

function buildCloseAllExchangePositionsAction({
  showFeedback,
  mutations,
}: TradingExecutionPositionActionArgs) {
  return async () => {
    await runTradingExecutionAction({
      execute: () => mutations.closeAllExchangePositionsMutation.mutateAsync(),
      failureTitle: '批量提交真实平仓委托失败',
      showFeedback,
      onSuccess: (result) => {
        showFeedback(
          'success',
          result.submitted_count > 0 ? '已批量提交真实持仓平仓委托' : '当前没有可平的真实持仓',
          result.submitted_count > 0
            ? `本次共向 Bybit 提交 ${result.submitted_count} 条真实平仓委托。`
            : '当前真实持仓为空。',
        )
      },
    })
  }
}

export function buildTradingExecutionPositionActionHandlers({
  showFeedback,
  mutations,
}: TradingExecutionPositionActionArgs) {
  return {
    closePaperPosition: buildClosePaperPositionAction({
      showFeedback,
      mutations,
    }),
    closeExchangePosition: buildCloseExchangePositionAction({
      showFeedback,
      mutations,
    }),
    closeAllPaperPositions: buildCloseAllPaperPositionsAction({
      showFeedback,
      mutations,
    }),
    closeAllExchangePositions: buildCloseAllExchangePositionsAction({
      showFeedback,
      mutations,
    }),
  }
}
