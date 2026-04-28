import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { MarketDetail, Mode, OrderRecord } from '../types'

import {
  buildManualOrderDraft,
  closeManualTradeEditor,
  syncManualOrderSymbol,
  type ManualOrderState,
} from './tradingExecutionActionHelpers'
import type { TradingExecutionFeedback } from './tradingExecutionAsyncHelpers'
import {
  buildTradingExecutionOrderActionHandlers,
  buildTradingExecutionPositionActionHandlers,
  buildTradingExecutionSubmissionActionHandlers,
} from './tradingExecutionActionHandlerBuilders'
import type { useTradingExecutionMutations } from './useTradingExecutionMutations'

type TradingExecutionMutations = ReturnType<typeof useTradingExecutionMutations>

export type BuildTradingExecutionActionHandlersArgs = {
  refreshControlData: () => Promise<void>
  marketDetail: MarketDetail | null | undefined
  selectedMode: Mode
  manualOrder: ManualOrderState
  manualOrderQuantity: number
  manualOrderPrice: number
  manualTradingBlockedReason: string | null
  editingOrderId: string | null
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setManualOrder: Dispatch<SetStateAction<ManualOrderState>>
  setEditingOrderId: Dispatch<SetStateAction<string | null>>
  setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
  manualOrderSymbolRef: MutableRefObject<string | null>
  showFeedback: TradingExecutionFeedback
  mutations: TradingExecutionMutations
}

export function buildTradingExecutionActionHandlers({
  marketDetail,
  selectedMode,
  manualOrder,
  manualOrderQuantity,
  manualOrderPrice,
  manualTradingBlockedReason,
  editingOrderId,
  setSelectedSymbol,
  setManualOrder,
  setEditingOrderId,
  setManualTradePanelOpen,
  manualOrderSymbolRef,
  showFeedback,
  mutations,
}: BuildTradingExecutionActionHandlersArgs) {
  const manualTradeEditorControls = {
    setEditingOrderId,
    setManualTradePanelOpen,
  }

  const closeManualTradePanel = () => {
    closeManualTradeEditor(manualTradeEditorControls)
  }

  const openOrderEditor = (order: OrderRecord) => {
    syncManualOrderSymbol(setSelectedSymbol, manualOrderSymbolRef, order.symbol)
    setManualOrder(buildManualOrderDraft(order))
    setEditingOrderId(order.order_id)
    setManualTradePanelOpen(true)
  }

  const { submitManualOrder, submitPaperOrder } = buildTradingExecutionSubmissionActionHandlers({
    marketDetail,
    selectedMode,
    manualOrder,
    manualOrderQuantity,
    manualOrderPrice,
    manualTradingBlockedReason,
    setManualOrder,
    showFeedback,
    mutations,
  })

  const { closePaperPosition, closeExchangePosition, closeAllPaperPositions, closeAllExchangePositions } =
    buildTradingExecutionPositionActionHandlers({
      showFeedback,
      mutations,
    })

  const {
    cancelPaperOrder,
    cancelExchangeOrder,
    cancelAllExchangeOrders,
    cancelAllPaperOrders,
    replacePaperOrder,
    replaceExchangeOrder,
    probeBybitTradeRoute,
  } = buildTradingExecutionOrderActionHandlers({
    editingOrderId,
    manualOrderQuantity,
    manualOrderPrice,
    manualTradingBlockedReason,
    setManualOrder,
    showFeedback,
    mutations,
    manualTradeEditorControls,
  })

  return {
    tradeProbeResult: mutations.tradeProbeMutation.data,
    tradeProbePending: mutations.tradeProbeMutation.isPending,
    manualTradeMutationPending: mutations.manualTradeMutation.isPending,
    exchangeOrderMutationPending: mutations.exchangeOrderMutation.isPending,
    paperOrderMutationPending: mutations.paperOrderMutation.isPending,
    replacePaperOrderPending: mutations.replacePaperOrderMutation.isPending,
    replaceExchangeOrderPending: mutations.replaceExchangeOrderMutation.isPending,
    cancelPaperOrderPending: mutations.cancelPaperOrderMutation.isPending,
    cancelExchangeOrderPending: mutations.cancelExchangeOrderMutation.isPending,
    cancelAllPaperOrdersPending: mutations.cancelAllPaperOrdersMutation.isPending,
    cancelAllExchangeOrdersPending: mutations.cancelAllExchangeOrdersMutation.isPending,
    closeAllPaperPositionsPending: mutations.closeAllPaperPositionsMutation.isPending,
    closeAllExchangePositionsPending: mutations.closeAllExchangePositionsMutation.isPending,
    closePaperPositionPending: mutations.closePaperPositionMutation.isPending,
    closeExchangePositionPending: mutations.closeExchangePositionMutation.isPending,
    closeManualTradePanel,
    openOrderEditor,
    submitManualOrder,
    closePaperPosition,
    closeExchangePosition,
    closeAllPaperPositions,
    closeAllExchangePositions,
    submitPaperOrder,
    cancelPaperOrder,
    cancelExchangeOrder,
    cancelAllExchangeOrders,
    cancelAllPaperOrders,
    replacePaperOrder,
    replaceExchangeOrder,
    probeBybitTradeRoute,
  }
}
