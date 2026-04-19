import { closeManualTradeEditor, closeManualTradeEditorIfEditing } from './tradingExecutionActionHelpers'
import { runTradingExecutionAction } from './tradingExecutionAsyncHelpers'
import type { TradingExecutionOrderActionArgs } from './tradingExecutionOrderActionHandlers.types'

export function buildCancelPaperOrderAction({
  editingOrderId,
  showFeedback,
  mutations,
  manualTradeEditorControls,
}: TradingExecutionOrderActionArgs) {
  return async (orderId: string) => {
    await runTradingExecutionAction({
      execute: () => mutations.cancelPaperOrderMutation.mutateAsync(orderId),
      failureTitle: '取消 Paper 委托失败',
      showFeedback,
      onSuccess: (order) => {
        showFeedback('success', 'Paper 委托已取消', `${order.symbol} 的本地限价委托已取消。`)
        closeManualTradeEditorIfEditing(editingOrderId, orderId, manualTradeEditorControls)
      },
    })
  }
}

export function buildCancelExchangeOrderAction({
  editingOrderId,
  showFeedback,
  mutations,
  manualTradeEditorControls,
}: TradingExecutionOrderActionArgs) {
  return async (orderId: string) => {
    await runTradingExecutionAction({
      execute: () => mutations.cancelExchangeOrderMutation.mutateAsync(orderId),
      failureTitle: '真实委托撤单失败',
      showFeedback,
      onSuccess: (order) => {
        showFeedback('success', '真实委托已撤销', `${order.symbol} 的 Bybit 委托 ${order.order_id} 已提交撤单。`)
        closeManualTradeEditorIfEditing(editingOrderId, orderId, manualTradeEditorControls)
      },
    })
  }
}

export function buildCancelAllExchangeOrdersAction({
  showFeedback,
  mutations,
}: TradingExecutionOrderActionArgs) {
  return async () => {
    await runTradingExecutionAction({
      execute: () => mutations.cancelAllExchangeOrdersMutation.mutateAsync(),
      failureTitle: '批量撤销真实委托失败',
      showFeedback,
      onSuccess: (result) => {
        showFeedback(
          'success',
          result.cancelled_count > 0 ? '已批量撤销真实委托' : '当前没有可撤的真实委托',
          result.cancelled_count > 0
            ? `本次共向 Bybit 提交 ${result.cancelled_count} 条真实委托撤单。`
            : '当前未成交真实委托为空。',
        )
      },
    })
  }
}

export function buildCancelAllPaperOrdersAction({
  showFeedback,
  mutations,
  manualTradeEditorControls,
}: TradingExecutionOrderActionArgs) {
  return async () => {
    await runTradingExecutionAction({
      execute: () => mutations.cancelAllPaperOrdersMutation.mutateAsync(),
      failureTitle: '批量取消 Paper 委托失败',
      showFeedback,
      onSuccess: (result) => {
        showFeedback(
          'success',
          result.cancelled_count > 0 ? '已批量取消 Paper 委托' : '当前没有可取消的 Paper 委托',
          result.cancelled_count > 0
            ? `本次共取消 ${result.cancelled_count} 笔本地限价委托。`
            : '未成交委托列表当前为空。',
        )
        closeManualTradeEditor(manualTradeEditorControls)
      },
    })
  }
}
