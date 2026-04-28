import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlRefreshActions } from './useControlRefreshActions'
import type { useDesktopUiActions } from './useDesktopUiActions'
import type { useManualTradePreviewModel } from './useManualTradePreviewModel'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useTradingExecutionActions } from './useTradingExecutionActions'

type BuildTradingExecutionActionsArgs = Parameters<typeof useTradingExecutionActions>[0]
type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlRefreshActions = ReturnType<typeof useControlRefreshActions>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>
type ManualTradePreviewModel = ReturnType<typeof useManualTradePreviewModel>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>

export type BuildTradingExecutionActionsArgsInput =
  AppWorkspaceBootstrapState &
  ControlRefreshActions &
  DesktopUiActions &
  ManualTradePreviewModel &
  MarketWorkspaceModel

export function buildTradingExecutionActionsArgs({
  refreshControlData,
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
}: BuildTradingExecutionActionsArgsInput): BuildTradingExecutionActionsArgs {
  return {
    refreshControlData,
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
  }
}
