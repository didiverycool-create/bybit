import type { UseAppShellWorkspaceCompositionStateArgs } from './useAppShellWorkspaceCompositionState'

export type AppShellWorkspaceCompositionStateSourceGroups = {
  workspaceQuerySource: UseAppShellWorkspaceCompositionStateArgs['workspaceBootstrapState'] &
    UseAppShellWorkspaceCompositionStateArgs['controlDataQueryModel']
  strategyRuntimeSource: UseAppShellWorkspaceCompositionStateArgs['runtimeAndSettingsModel'] &
    UseAppShellWorkspaceCompositionStateArgs['strategyWorkspaceCompositeModel']
  interactionSource: UseAppShellWorkspaceCompositionStateArgs['appInteractionModels'] &
    UseAppShellWorkspaceCompositionStateArgs['manualTradePreviewModel']
  workspaceOperationsSource: UseAppShellWorkspaceCompositionStateArgs['workspacePersistenceModel'] &
    UseAppShellWorkspaceCompositionStateArgs['workspaceOpsCollectionsModel']
}

export function buildAppShellWorkspaceCompositionStateSourceGroups({
  workspaceBootstrapState,
  controlDataQueryModel,
  runtimeAndSettingsModel,
  strategyWorkspaceCompositeModel,
  appInteractionModels,
  workspacePersistenceModel,
  workspaceOpsCollectionsModel,
  manualTradePreviewModel,
}: UseAppShellWorkspaceCompositionStateArgs): AppShellWorkspaceCompositionStateSourceGroups {
  return {
    workspaceQuerySource: {
      ...workspaceBootstrapState,
      ...controlDataQueryModel,
    },
    strategyRuntimeSource: {
      ...runtimeAndSettingsModel,
      ...strategyWorkspaceCompositeModel,
    },
    interactionSource: {
      ...appInteractionModels,
      ...manualTradePreviewModel,
    },
    workspaceOperationsSource: {
      ...workspacePersistenceModel,
      ...workspaceOpsCollectionsModel,
    },
  }
}
