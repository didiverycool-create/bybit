import type { QueryClient } from '@tanstack/react-query'

import { buildReplayWorkspaceModelArgs } from './buildReplayWorkspaceModelArgs'
import { buildWorkspaceOpsCollectionsModelArgs } from './buildWorkspaceOpsCollectionsModelArgs'
import { buildWorkspacePersistenceArgs } from './buildWorkspacePersistenceArgs'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useControlRefreshActions } from './useControlRefreshActions'
import type { useDesktopUiActions } from './useDesktopUiActions'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'
import { useAppWorkspaceSyncModel } from './useAppWorkspaceSyncModel'
import { useReplayWorkspaceModel } from './useReplayWorkspaceModel'
import { useWorkspaceOpsCollectionsModel } from './useWorkspaceOpsCollectionsModel'
import { useWorkspacePersistence } from './useWorkspacePersistence'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type ControlRefreshActions = ReturnType<typeof useControlRefreshActions>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>

export type UseAppShellWorkspaceCompositionModelsArgs = {
  queryClient: QueryClient
  workspaceBootstrapState: AppWorkspaceBootstrapState
  controlDataQueryModel: ControlDataQueryModel
  controlRefreshActions: ControlRefreshActions
  desktopUiActions: DesktopUiActions
  marketWorkspaceModel: MarketWorkspaceModel
  runtimeAndSettingsModel: RuntimeAndSettingsModel
  strategyWorkspaceCompositeModel: StrategyWorkspaceCompositeModel
}

export function useAppShellWorkspaceCompositionModels({
  queryClient,
  workspaceBootstrapState,
  controlDataQueryModel,
  controlRefreshActions,
  desktopUiActions,
  marketWorkspaceModel,
  runtimeAndSettingsModel,
  strategyWorkspaceCompositeModel,
}: UseAppShellWorkspaceCompositionModelsArgs) {
  const workspaceQuerySource = {
    ...workspaceBootstrapState,
    ...controlDataQueryModel,
  }
  const strategyReplaySource = {
    ...workspaceQuerySource,
    ...strategyWorkspaceCompositeModel,
  }
  const replayWorkspaceModel = useReplayWorkspaceModel(
    buildReplayWorkspaceModelArgs(strategyReplaySource),
  )

  const workspaceSyncSource = {
    ...workspaceQuerySource,
    ...marketWorkspaceModel,
    ...runtimeAndSettingsModel,
    ...strategyWorkspaceCompositeModel,
    queryClient,
  }
  const appWorkspaceSyncModel = useAppWorkspaceSyncModel({
    ...workspaceSyncSource,
  })
  const workspacePersistenceSource = {
    ...workspaceQuerySource,
    ...controlRefreshActions,
    ...desktopUiActions,
    ...marketWorkspaceModel,
    ...appWorkspaceSyncModel,
  }
  const workspacePersistenceModel = useWorkspacePersistence(
    buildWorkspacePersistenceArgs(workspacePersistenceSource),
  )
  const workspaceOpsCollectionsModel = useWorkspaceOpsCollectionsModel(
    buildWorkspaceOpsCollectionsModelArgs(workspaceQuerySource),
  )

  return {
    replayWorkspaceModel,
    workspacePersistenceModel,
    workspaceOpsCollectionsModel,
  }
}
