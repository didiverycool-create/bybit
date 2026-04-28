import type { BuildAppOverlayPanelsAssemblerArgs } from './buildAppOverlayPanelsAssembler'
import { buildAppOverlayPanelsTradingAccountProps } from './buildAppOverlayPanelsTradingAccountProps'

export function buildAppOverlayPanelsTradingAccountSection({
  panelState,
  panelSetters,
  tradingExecutionActions,
  dataState,
  pendingState,
}: BuildAppOverlayPanelsAssemblerArgs) {
  return buildAppOverlayPanelsTradingAccountProps({
    panelState: {
      manualTradePanelOpen: panelState.manualTradePanelOpen,
      orderHistoryPanelOpen: panelState.orderHistoryPanelOpen,
      accountInspectorOpen: panelState.accountInspectorOpen,
    },
    panelSetters: {
      setManualTradePanelOpen: panelSetters.setManualTradePanelOpen,
      setOrderHistoryPanelOpen: panelSetters.setOrderHistoryPanelOpen,
      setAccountInspectorOpen: panelSetters.setAccountInspectorOpen,
      setManualOrder: panelSetters.setManualOrder,
      setTradeOriginFilter: panelSetters.setTradeOriginFilter,
      setTradeScopeFilter: panelSetters.setTradeScopeFilter,
    },
    tradingExecutionActions,
    dataState: {
      serviceAvailable: dataState.serviceAvailable,
      settings: dataState.settings,
      selectedMode: dataState.selectedMode,
      selectedSymbol: dataState.selectedSymbol,
      editingOrder: dataState.editingOrder,
      manualOrder: dataState.manualOrder,
      manualTradePreviewLoading: dataState.manualTradePreviewLoading,
      manualTradePreview: dataState.manualTradePreview,
      manualTradingBlockedReason: dataState.manualTradingBlockedReason,
      accountOverview: dataState.accountOverview,
      bybitPrivateStatus: dataState.bybitPrivateStatus,
      bybitPublicStatus: dataState.bybitPublicStatus,
      tradeProbeResult: dataState.tradeProbeResult,
      tradeProbePending: dataState.tradeProbePending,
      tradeOriginFilter: dataState.tradeOriginFilter,
      tradeScopeFilter: dataState.tradeScopeFilter,
      filteredOrderHistory: dataState.filteredOrderHistory,
    },
    pendingState: {
      manualTradeMutationPending: pendingState.manualTradeMutationPending,
      exchangeOrderMutationPending: pendingState.exchangeOrderMutationPending,
      paperOrderMutationPending: pendingState.paperOrderMutationPending,
      replacePaperOrderPending: pendingState.replacePaperOrderPending,
      replaceExchangeOrderPending: pendingState.replaceExchangeOrderPending,
      cancelPaperOrderPending: pendingState.cancelPaperOrderPending,
      cancelExchangeOrderPending: pendingState.cancelExchangeOrderPending,
    },
  })
}
