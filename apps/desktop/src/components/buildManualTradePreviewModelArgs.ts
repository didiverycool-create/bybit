import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useManualTradePreviewModel } from './useManualTradePreviewModel'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'

type BuildManualTradePreviewModelArgs = Parameters<typeof useManualTradePreviewModel>[0]
type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>

export type BuildManualTradePreviewModelArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  MarketWorkspaceModel &
  RuntimeAndSettingsModel

export function buildManualTradePreviewModelArgs({
  marketDetail,
  selectedMode,
  manualOrder,
  manualTradePanelOpen,
  serviceAvailable,
  editingOrderId,
  bybitPrivateStatus,
  selectedStrategyRuntimePreview,
  selectedStrategyRuntime,
  runtimeWorkerNeedsRecovery,
}: BuildManualTradePreviewModelArgsInput): BuildManualTradePreviewModelArgs {
  return {
    marketDetail,
    selectedMode,
    manualOrder,
    manualTradePanelOpen,
    serviceAvailable,
    editingOrderId,
    bybitPrivateStatus,
    selectedStrategyRuntimePreview,
    selectedStrategyRuntime,
    runtimeWorkerNeedsRecovery,
  }
}
