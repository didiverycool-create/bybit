import type { useAppShellCompositionModels } from './useAppShellCompositionModels'
import type { useAppShellCoreModels } from './useAppShellCoreModels'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ShellCoreModels = ReturnType<typeof useAppShellCoreModels>
type ShellCompositionModels = ReturnType<typeof useAppShellCompositionModels>

export type AppPresentationModelsSourceGroups = {
  workspacePresentationSource: AppWorkspaceBootstrapState &
    ShellCoreModels['marketWorkspaceModel'] &
    ShellCoreModels['controlDataQueryModel'] &
    ShellCoreModels['desktopUiActions'] &
    ShellCoreModels['runtimeAndSettingsModel'] &
    ShellCoreModels['strategyWorkspaceCompositeModel'] &
    ShellCoreModels['controlRefreshActions']
  compositionPresentationSource: ShellCompositionModels['workspacePersistenceModel'] &
    ShellCompositionModels['workspaceOpsCollectionsModel'] &
    ShellCompositionModels['overviewWorkspaceDerivedState'] &
    ShellCompositionModels['appInteractionModels'] &
    ShellCompositionModels['appCompositionModel'] &
    ShellCompositionModels['replayWorkspaceModel']
}

export function buildAppPresentationModelsSourceGroups({
  workspaceBootstrapState,
  shellCoreModels,
  shellCompositionModels,
}: {
  workspaceBootstrapState: AppWorkspaceBootstrapState
  shellCoreModels: ShellCoreModels
  shellCompositionModels: ShellCompositionModels
}): AppPresentationModelsSourceGroups {
  const {
    controlDataQueryModel,
    controlRefreshActions,
    desktopUiActions,
    marketWorkspaceModel,
    runtimeAndSettingsModel,
    strategyWorkspaceCompositeModel,
  } = shellCoreModels
  const {
    appCompositionModel,
    appInteractionModels,
    overviewWorkspaceDerivedState,
    replayWorkspaceModel,
    workspaceOpsCollectionsModel,
    workspacePersistenceModel,
  } = shellCompositionModels

  return {
    workspacePresentationSource: {
      ...workspaceBootstrapState,
      ...marketWorkspaceModel,
      ...controlDataQueryModel,
      ...desktopUiActions,
      ...runtimeAndSettingsModel,
      ...strategyWorkspaceCompositeModel,
      ...controlRefreshActions,
    },
    compositionPresentationSource: {
      ...workspacePersistenceModel,
      ...workspaceOpsCollectionsModel,
      ...overviewWorkspaceDerivedState,
      ...appInteractionModels,
      ...appCompositionModel,
      ...replayWorkspaceModel,
    },
  }
}
