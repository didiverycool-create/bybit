import { buildAppCompositionModelArgs } from './buildAppCompositionModelArgs'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useManualTradePreviewModel } from './useManualTradePreviewModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'
import type { useWorkspaceOpsCollectionsModel } from './useWorkspaceOpsCollectionsModel'
import type { useWorkspacePersistence } from './useWorkspacePersistence'
import { buildAppShellWorkspaceCompositionStateSourceGroups } from './buildAppShellWorkspaceCompositionStateSourceGroups'
import { useAppCompositionModel } from './useAppCompositionModel'
import type { useAppInteractionModels } from './useAppInteractionModels'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type ManualTradePreviewModel = ReturnType<typeof useManualTradePreviewModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>
type WorkspacePersistenceModel = ReturnType<typeof useWorkspacePersistence>
type WorkspaceOpsCollectionsModel = ReturnType<typeof useWorkspaceOpsCollectionsModel>
type AppInteractionModels = ReturnType<typeof useAppInteractionModels>

export type UseAppShellWorkspaceCompositionStateArgs = {
  workspaceBootstrapState: AppWorkspaceBootstrapState
  controlDataQueryModel: ControlDataQueryModel
  runtimeAndSettingsModel: RuntimeAndSettingsModel
  strategyWorkspaceCompositeModel: StrategyWorkspaceCompositeModel
  appInteractionModels: AppInteractionModels
  workspacePersistenceModel: WorkspacePersistenceModel
  workspaceOpsCollectionsModel: WorkspaceOpsCollectionsModel
  manualTradePreviewModel: ManualTradePreviewModel
}

export function useAppShellWorkspaceCompositionState({
  workspaceBootstrapState,
  controlDataQueryModel,
  runtimeAndSettingsModel,
  strategyWorkspaceCompositeModel,
  appInteractionModels,
  workspacePersistenceModel,
  workspaceOpsCollectionsModel,
  manualTradePreviewModel,
}: UseAppShellWorkspaceCompositionStateArgs) {
  const {
    workspaceQuerySource,
    strategyRuntimeSource,
    interactionSource,
    workspaceOperationsSource,
  } = buildAppShellWorkspaceCompositionStateSourceGroups({
    workspaceBootstrapState,
    controlDataQueryModel,
    runtimeAndSettingsModel,
    strategyWorkspaceCompositeModel,
    appInteractionModels,
    workspacePersistenceModel,
    workspaceOpsCollectionsModel,
    manualTradePreviewModel,
  })
  const appCompositionSource = {
    ...workspaceQuerySource,
    ...strategyRuntimeSource,
    ...interactionSource,
    ...workspaceOperationsSource,
  }

  return useAppCompositionModel(
    buildAppCompositionModelArgs(appCompositionSource),
  )
}
