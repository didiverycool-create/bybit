import type { UseAppShellInteractionCompositionModelsArgs } from './useAppShellInteractionCompositionModels'

export type AppShellInteractionCompositionSourceGroups = {
  overviewDerivedStateSource: {
    layoutPreset: UseAppShellInteractionCompositionModelsArgs['workspaceBootstrapState']['layoutPreset']
    watchlist: UseAppShellInteractionCompositionModelsArgs['marketWorkspaceModel']['watchlist']
    aiActivityFeed: UseAppShellInteractionCompositionModelsArgs['runtimeAndSettingsModel']['aiActivityFeed']
  }
  navigationWorkflowSource: Pick<
    UseAppShellInteractionCompositionModelsArgs,
    | 'queryClient'
    | 'workspaceBootstrapState'
    | 'controlDataQueryModel'
    | 'controlRefreshActions'
    | 'desktopUiActions'
    | 'replayWorkspaceModel'
    | 'runtimeAndSettingsModel'
    | 'strategyWorkspaceCompositeModel'
  >
  appCompositionSource: Pick<
    UseAppShellInteractionCompositionModelsArgs,
    | 'workspaceBootstrapState'
    | 'controlDataQueryModel'
    | 'runtimeAndSettingsModel'
    | 'strategyWorkspaceCompositeModel'
    | 'workspacePersistenceModel'
    | 'workspaceOpsCollectionsModel'
    | 'manualTradePreviewModel'
  > & {
    appInteractionModels: ReturnType<
      typeof import('./useAppShellNavigationAndWorkflowModels').useAppShellNavigationAndWorkflowModels
    >
  }
}

export function buildAppShellInteractionCompositionSourceGroups({
  queryClient,
  workspaceBootstrapState,
  controlDataQueryModel,
  controlRefreshActions,
  desktopUiActions,
  marketWorkspaceModel,
  replayWorkspaceModel,
  runtimeAndSettingsModel,
  strategyWorkspaceCompositeModel,
}: UseAppShellInteractionCompositionModelsArgs): Omit<
  AppShellInteractionCompositionSourceGroups,
  'appCompositionSource'
> {
  return {
    overviewDerivedStateSource: {
      layoutPreset: workspaceBootstrapState.layoutPreset,
      watchlist: marketWorkspaceModel.watchlist,
      aiActivityFeed: runtimeAndSettingsModel.aiActivityFeed,
    },
    navigationWorkflowSource: {
      queryClient,
      workspaceBootstrapState,
      controlDataQueryModel,
      controlRefreshActions,
      desktopUiActions,
      replayWorkspaceModel,
      runtimeAndSettingsModel,
      strategyWorkspaceCompositeModel,
    },
  }
}

export function buildAppShellWorkspaceCompositionSource({
  workspaceBootstrapState,
  controlDataQueryModel,
  runtimeAndSettingsModel,
  strategyWorkspaceCompositeModel,
  workspacePersistenceModel,
  workspaceOpsCollectionsModel,
  manualTradePreviewModel,
}: Pick<
  UseAppShellInteractionCompositionModelsArgs,
  | 'workspaceBootstrapState'
  | 'controlDataQueryModel'
  | 'runtimeAndSettingsModel'
  | 'strategyWorkspaceCompositeModel'
  | 'workspacePersistenceModel'
  | 'workspaceOpsCollectionsModel'
  | 'manualTradePreviewModel'
>): Omit<AppShellInteractionCompositionSourceGroups['appCompositionSource'], 'appInteractionModels'> {
  return {
    workspaceBootstrapState,
    controlDataQueryModel,
    runtimeAndSettingsModel,
    strategyWorkspaceCompositeModel,
    workspacePersistenceModel,
    workspaceOpsCollectionsModel,
    manualTradePreviewModel,
  }
}
