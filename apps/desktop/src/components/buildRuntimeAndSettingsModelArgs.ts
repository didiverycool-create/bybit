import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'

type BuildRuntimeAndSettingsModelArgs = Parameters<typeof useRuntimeAndSettingsModel>[0]
type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>

export type BuildRuntimeAndSettingsModelArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  MarketWorkspaceModel

export function buildRuntimeAndSettingsModelArgs({
  runtimeWorkerStatusQuery,
  watchlist,
  selectedSymbol,
  selectedStrategyRuntime,
  selectedModeStrategyPreview,
  settings,
  settingsDraft,
  setSettingsDraft,
  lastLoadedSettingsSignatureRef,
  snapshot,
  aiLiveQuery,
  auditEvents,
}: BuildRuntimeAndSettingsModelArgsInput): BuildRuntimeAndSettingsModelArgs {
  return {
    runtimeWorkerStatusData: runtimeWorkerStatusQuery.data,
    watchlist,
    selectedSymbol,
    selectedStrategyRuntime,
    selectedModeStrategyPreview,
    settings,
    settingsDraft,
    setSettingsDraft,
    lastLoadedSettingsSignatureRef,
    snapshot,
    aiLiveData: aiLiveQuery.data,
    auditEvents,
  }
}
