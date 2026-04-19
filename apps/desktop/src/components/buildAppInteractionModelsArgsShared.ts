import type { QueryClient } from '@tanstack/react-query'

import type { useAppInteractionModels } from './useAppInteractionModels'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useControlRefreshActions } from './useControlRefreshActions'
import type { useDesktopUiActions } from './useDesktopUiActions'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'

type BuildAppInteractionModelsArgs = Parameters<typeof useAppInteractionModels>[0]
type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type ControlRefreshActions = ReturnType<typeof useControlRefreshActions>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>

export type BuildAppInteractionModelsArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  ControlRefreshActions &
  DesktopUiActions &
  RuntimeAndSettingsModel &
  StrategyWorkspaceCompositeModel & {
    queryClient: QueryClient
    findProposalById: BuildAppInteractionModelsArgs['strategyWorkflowArgs']['findProposalById']
  }

export type AppInteractionNavigationArgs = BuildAppInteractionModelsArgs['navigationArgs']
export type AppInteractionStrategyWorkflowArgs = BuildAppInteractionModelsArgs['strategyWorkflowArgs']
export type AppInteractionWorkspaceControlArgs = BuildAppInteractionModelsArgs['workspaceControlArgs']
