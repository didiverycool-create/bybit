import type { UseAppShellCoreModelsArgs } from './useAppShellCoreModels.types'
import { useAppShellCoreActionModels } from './useAppShellCoreActionModels'
import { useAppShellCoreDataModels } from './useAppShellCoreDataModels'
import { useAppShellCoreEffects } from './useAppShellCoreEffects'

export type { UseAppShellCoreModelsArgs } from './useAppShellCoreModels.types'

export function useAppShellCoreModels({
  queryClient,
  workspaceBootstrapState,
  marketTimeframePresets,
}: UseAppShellCoreModelsArgs) {
  const coreDataSource = {
    workspaceBootstrapState,
    marketTimeframePresets,
  }
  const {
    marketWorkspaceModel,
    controlDataQueryModel,
    desktopUiActions,
  } = useAppShellCoreDataModels(coreDataSource)

  const coreEffectsSource = {
    queryClient,
    workspaceBootstrapState,
    controlDataQueryModel,
    desktopUiActions,
    marketWorkspaceModel,
  }
  const {
    runtimeAndSettingsModel,
    strategyWorkspaceCompositeModel,
  } = useAppShellCoreEffects(coreEffectsSource)

  const coreActionSource = {
    queryClient,
    workspaceBootstrapState,
    controlDataQueryModel,
    marketWorkspaceModel,
    desktopUiActions,
    runtimeAndSettingsModel,
  }
  const {
    manualTradePreviewModel,
    controlRefreshActions,
    tradingExecutionActions,
  } = useAppShellCoreActionModels(coreActionSource)

  return {
    marketWorkspaceModel,
    controlDataQueryModel,
    desktopUiActions,
    runtimeAndSettingsModel,
    strategyWorkspaceCompositeModel,
    manualTradePreviewModel,
    controlRefreshActions,
    tradingExecutionActions,
  }
}
