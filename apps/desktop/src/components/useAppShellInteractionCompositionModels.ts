import type { QueryClient } from '@tanstack/react-query'

import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useControlRefreshActions } from './useControlRefreshActions'
import type { useDesktopUiActions } from './useDesktopUiActions'
import type { useManualTradePreviewModel } from './useManualTradePreviewModel'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useReplayWorkspaceModel } from './useReplayWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'
import type { useWorkspaceOpsCollectionsModel } from './useWorkspaceOpsCollectionsModel'
import type { useWorkspacePersistence } from './useWorkspacePersistence'
import {
  buildAppShellInteractionCompositionSourceGroups,
  buildAppShellWorkspaceCompositionSource,
} from './buildAppShellInteractionCompositionSourceGroups'
import { useAppShellNavigationAndWorkflowModels } from './useAppShellNavigationAndWorkflowModels'
import { useAppShellOverviewDerivedState } from './useAppShellOverviewDerivedState'
import { useAppShellWorkspaceCompositionState } from './useAppShellWorkspaceCompositionState'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type ControlRefreshActions = ReturnType<typeof useControlRefreshActions>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>
type ManualTradePreviewModel = ReturnType<typeof useManualTradePreviewModel>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>
type ReplayWorkspaceModel = ReturnType<typeof useReplayWorkspaceModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>
type WorkspacePersistenceModel = ReturnType<typeof useWorkspacePersistence>
type WorkspaceOpsCollectionsModel = ReturnType<typeof useWorkspaceOpsCollectionsModel>

export type UseAppShellInteractionCompositionModelsArgs = {
  queryClient: QueryClient
  workspaceBootstrapState: AppWorkspaceBootstrapState
  controlDataQueryModel: ControlDataQueryModel
  controlRefreshActions: ControlRefreshActions
  desktopUiActions: DesktopUiActions
  manualTradePreviewModel: ManualTradePreviewModel
  marketWorkspaceModel: MarketWorkspaceModel
  replayWorkspaceModel: ReplayWorkspaceModel
  runtimeAndSettingsModel: RuntimeAndSettingsModel
  strategyWorkspaceCompositeModel: StrategyWorkspaceCompositeModel
  workspacePersistenceModel: WorkspacePersistenceModel
  workspaceOpsCollectionsModel: WorkspaceOpsCollectionsModel
}

export function useAppShellInteractionCompositionModels({
  queryClient,
  workspaceBootstrapState,
  controlDataQueryModel,
  controlRefreshActions,
  desktopUiActions,
  manualTradePreviewModel,
  marketWorkspaceModel,
  replayWorkspaceModel,
  runtimeAndSettingsModel,
  strategyWorkspaceCompositeModel,
  workspacePersistenceModel,
  workspaceOpsCollectionsModel,
}: UseAppShellInteractionCompositionModelsArgs) {
  const { overviewDerivedStateSource, navigationWorkflowSource } =
    buildAppShellInteractionCompositionSourceGroups({
      queryClient,
      workspaceBootstrapState,
      controlDataQueryModel,
      controlRefreshActions,
      desktopUiActions,
      manualTradePreviewModel,
      marketWorkspaceModel,
      replayWorkspaceModel,
      runtimeAndSettingsModel,
      strategyWorkspaceCompositeModel,
      workspacePersistenceModel,
      workspaceOpsCollectionsModel,
    })
  const overviewWorkspaceDerivedState = useAppShellOverviewDerivedState({
    ...overviewDerivedStateSource,
  })
  const appInteractionModels = useAppShellNavigationAndWorkflowModels(
    navigationWorkflowSource,
  )
  const appCompositionSource = {
    ...buildAppShellWorkspaceCompositionSource({
      workspaceBootstrapState,
      controlDataQueryModel,
      runtimeAndSettingsModel,
      strategyWorkspaceCompositeModel,
      workspacePersistenceModel,
      workspaceOpsCollectionsModel,
      manualTradePreviewModel,
    }),
    appInteractionModels,
  }
  const appCompositionModel = useAppShellWorkspaceCompositionState(
    appCompositionSource,
  )

  return {
    overviewWorkspaceDerivedState,
    appInteractionModels,
    appCompositionModel,
  }
}
