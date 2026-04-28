import { resetManualTradeDraftAndCloseEditor } from './tradingExecutionActionHelpers'
import { runTradingExecutionAction } from './tradingExecutionAsyncHelpers'
import type { TradingExecutionOrderActionArgs } from './tradingExecutionOrderActionHandlers.types'

export function buildReplacePaperOrderAction({
  editingOrderId,
  manualOrderQuantity,
  manualOrderPrice,
  manualTradingBlockedReason,
  setManualOrder,
  showFeedback,
  mutations,
  manualTradeEditorControls,
}: TradingExecutionOrderActionArgs) {
  return async () => {
    if (!editingOrderId) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能修改本地限价委托', manualTradingBlockedReason)
      return
    }

    await runTradingExecutionAction({
      execute: () =>
        mutations.replacePaperOrderMutation.mutateAsync({
          orderId: editingOrderId,
          quantity: manualOrderQuantity,
          price: manualOrderPrice,
        }),
      failureTitle: 'Paper 委托修改失败',
      showFeedback,
      onSuccess: (order) => {
        showFeedback(
          'success',
          order.status === 'Filled' ? 'Paper 委托已修改并成交' : 'Paper 委托已修改',
          order.status === 'Filled'
            ? `${order.symbol} 的本地限价委托在改价后已立即成交。`
            : `${order.symbol} 的本地限价委托已更新到新价格和数量。`,
        )
        resetManualTradeDraftAndCloseEditor(setManualOrder, manualTradeEditorControls)
      },
    })
  }
}

export function buildReplaceExchangeOrderAction({
  editingOrderId,
  manualOrderQuantity,
  manualOrderPrice,
  manualTradingBlockedReason,
  setManualOrder,
  showFeedback,
  mutations,
  manualTradeEditorControls,
}: TradingExecutionOrderActionArgs) {
  return async () => {
    if (!editingOrderId) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能修改真实委托', manualTradingBlockedReason)
      return
    }

    await runTradingExecutionAction({
      execute: () =>
        mutations.replaceExchangeOrderMutation.mutateAsync({
          orderId: editingOrderId,
          quantity: manualOrderQuantity,
          price: manualOrderPrice,
        }),
      failureTitle: '真实委托修改失败',
      showFeedback,
      onSuccess: (order) => {
        showFeedback(
          'success',
          '真实委托已修改',
          `${order.symbol} 的 Bybit 委托 ${order.order_id} 已更新为价格 ${order.price}、数量 ${order.qty}。`,
        )
        resetManualTradeDraftAndCloseEditor(setManualOrder, manualTradeEditorControls)
      },
    })
  }
}
