import { buildCancelAllExchangeOrdersAction, buildCancelAllPaperOrdersAction, buildCancelExchangeOrderAction, buildCancelPaperOrderAction } from './tradingExecutionOrderActionHandlersCancel'
import { buildProbeBybitTradeRouteAction } from './tradingExecutionOrderActionHandlersTradeProbe'
import { buildReplaceExchangeOrderAction, buildReplacePaperOrderAction } from './tradingExecutionOrderActionHandlersReplace'
import type { TradingExecutionOrderActionArgs } from './tradingExecutionOrderActionHandlers.types'

export function buildTradingExecutionOrderActionHandlers({
  editingOrderId,
  manualOrderQuantity,
  manualOrderPrice,
  manualTradingBlockedReason,
  setManualOrder,
  showFeedback,
  mutations,
  manualTradeEditorControls,
}: TradingExecutionOrderActionArgs) {
  return {
    cancelPaperOrder: buildCancelPaperOrderAction({
      editingOrderId,
      manualOrderQuantity,
      manualOrderPrice,
      manualTradingBlockedReason,
      setManualOrder,
      showFeedback,
      mutations,
      manualTradeEditorControls,
    }),
    cancelExchangeOrder: buildCancelExchangeOrderAction({
      editingOrderId,
      manualOrderQuantity,
      manualOrderPrice,
      manualTradingBlockedReason,
      setManualOrder,
      showFeedback,
      mutations,
      manualTradeEditorControls,
    }),
    cancelAllExchangeOrders: buildCancelAllExchangeOrdersAction({
      editingOrderId,
      manualOrderQuantity,
      manualOrderPrice,
      manualTradingBlockedReason,
      setManualOrder,
      showFeedback,
      mutations,
      manualTradeEditorControls,
    }),
    cancelAllPaperOrders: buildCancelAllPaperOrdersAction({
      editingOrderId,
      manualOrderQuantity,
      manualOrderPrice,
      manualTradingBlockedReason,
      setManualOrder,
      showFeedback,
      mutations,
      manualTradeEditorControls,
    }),
    replacePaperOrder: buildReplacePaperOrderAction({
      editingOrderId,
      manualOrderQuantity,
      manualOrderPrice,
      manualTradingBlockedReason,
      setManualOrder,
      showFeedback,
      mutations,
      manualTradeEditorControls,
    }),
    replaceExchangeOrder: buildReplaceExchangeOrderAction({
      editingOrderId,
      manualOrderQuantity,
      manualOrderPrice,
      manualTradingBlockedReason,
      setManualOrder,
      showFeedback,
      mutations,
      manualTradeEditorControls,
    }),
    probeBybitTradeRoute: buildProbeBybitTradeRouteAction({
      editingOrderId,
      manualOrderQuantity,
      manualOrderPrice,
      manualTradingBlockedReason,
      setManualOrder,
      showFeedback,
      mutations,
      manualTradeEditorControls,
    }),
  }
}
