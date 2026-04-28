import type { useAppCompositionModel } from './useAppCompositionModel'
import type { useAppInteractionModels } from './useAppInteractionModels'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useManualTradePreviewModel } from './useManualTradePreviewModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'
import type { useWorkspaceOpsCollectionsModel } from './useWorkspaceOpsCollectionsModel'
import type { useWorkspacePersistence } from './useWorkspacePersistence'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>
type AppInteractionModels = ReturnType<typeof useAppInteractionModels>
type WorkspacePersistenceModel = ReturnType<typeof useWorkspacePersistence>
type WorkspaceOpsCollectionsModel = ReturnType<typeof useWorkspaceOpsCollectionsModel>
type ManualTradePreviewModel = ReturnType<typeof useManualTradePreviewModel>

export type BuildAppCompositionModelArgs = Parameters<typeof useAppCompositionModel>[0]

export type BuildAppCompositionModelArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  RuntimeAndSettingsModel &
  StrategyWorkspaceCompositeModel &
  AppInteractionModels &
  WorkspacePersistenceModel &
  WorkspaceOpsCollectionsModel &
  ManualTradePreviewModel
