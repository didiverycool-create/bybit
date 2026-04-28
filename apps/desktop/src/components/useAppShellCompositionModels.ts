import type { QueryClient } from '@tanstack/react-query'

import { useAppShellInteractionCompositionModels } from './useAppShellInteractionCompositionModels'
import { useAppShellWorkspaceCompositionModels } from './useAppShellWorkspaceCompositionModels'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useControlRefreshActions } from './useControlRefreshActions'
import type { useDesktopUiActions } from './useDesktopUiActions'
import type { useManualTradePreviewModel } from './useManualTradePreviewModel'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type ControlRefreshActions = ReturnType<typeof useControlRefreshActions>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>
type ManualTradePreviewModel = ReturnType<typeof useManualTradePreviewModel>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>

export type UseAppShellCompositionModelsArgs = {
  queryClient: QueryClient
  workspaceBootstrapState: AppWorkspaceBootstrapState
  controlDataQueryModel: ControlDataQueryModel
  controlRefreshActions: ControlRefreshActions
  desktopUiActions: DesktopUiActions
  manualTradePreviewModel: ManualTradePreviewModel
  marketWorkspaceModel: MarketWorkspaceModel
  runtimeAndSettingsModel: RuntimeAndSettingsModel
  strategyWorkspaceCompositeModel: StrategyWorkspaceCompositeModel
}

export function useAppShellCompositionModels({
  queryClient,
  workspaceBootstrapState,
  controlDataQueryModel,
  controlRefreshActions,
  desktopUiActions,
  manualTradePreviewModel,
  marketWorkspaceModel,
  runtimeAndSettingsModel,
  strategyWorkspaceCompositeModel,
}: UseAppShellCompositionModelsArgs) {
  const sharedWorkspaceCompositionArgs = {
    queryClient,
    workspaceBootstrapState,
    controlDataQueryModel,
    controlRefreshActions,
    desktopUiActions,
    marketWorkspaceModel,
    runtimeAndSettingsModel,
    strategyWorkspaceCompositeModel,
  }
  const workspaceCompositionModels = useAppShellWorkspaceCompositionModels(
    sharedWorkspaceCompositionArgs,
  )

  const sharedInteractionCompositionArgs = {
    ...sharedWorkspaceCompositionArgs,
    manualTradePreviewModel,
    replayWorkspaceModel: workspaceCompositionModels.replayWorkspaceModel,
    workspacePersistenceModel: workspaceCompositionModels.workspacePersistenceModel,
    workspaceOpsCollectionsModel: workspaceCompositionModels.workspaceOpsCollectionsModel,
  }
  const interactionCompositionModels = useAppShellInteractionCompositionModels(
    sharedInteractionCompositionArgs,
  )

  return {
    ...workspaceCompositionModels,
    ...interactionCompositionModels,
  }
}
