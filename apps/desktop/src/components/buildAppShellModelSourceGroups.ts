import type { QueryClient } from '@tanstack/react-query'

import type { UseAppShellCompositionModelsArgs } from './useAppShellCompositionModels'
import type { useAppShellCoreModels, UseAppShellCoreModelsArgs } from './useAppShellCoreModels'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { MarketTimeframe } from '../utils/workspace-helpers'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type MarketPresetOption = { value: MarketTimeframe; label: string }
type ShellCoreModels = ReturnType<typeof useAppShellCoreModels>

export type BuildAppShellCoreModelsSourceArgs = {
  workspaceBootstrapState: AppWorkspaceBootstrapState
  marketTimeframePresets: readonly MarketPresetOption[]
}

export type BuildAppShellCompositionModelsSourceArgs = {
  queryClient: QueryClient
  workspaceBootstrapState: AppWorkspaceBootstrapState
  shellCoreModels: ShellCoreModels
}

export function buildAppShellCoreModelsSource({
  workspaceBootstrapState,
  marketTimeframePresets,
}: BuildAppShellCoreModelsSourceArgs): UseAppShellCoreModelsArgs {
  return {
    workspaceBootstrapState,
    marketTimeframePresets,
  }
}

export function buildAppShellCompositionModelsSource({
  queryClient,
  workspaceBootstrapState,
  shellCoreModels,
}: BuildAppShellCompositionModelsSourceArgs): UseAppShellCompositionModelsArgs {
  return {
    queryClient,
    workspaceBootstrapState,
    controlDataQueryModel: shellCoreModels.controlDataQueryModel,
    controlRefreshActions: shellCoreModels.controlRefreshActions,
    desktopUiActions: shellCoreModels.desktopUiActions,
    manualTradePreviewModel: shellCoreModels.manualTradePreviewModel,
    marketWorkspaceModel: shellCoreModels.marketWorkspaceModel,
    runtimeAndSettingsModel: shellCoreModels.runtimeAndSettingsModel,
    strategyWorkspaceCompositeModel: shellCoreModels.strategyWorkspaceCompositeModel,
  }
}
