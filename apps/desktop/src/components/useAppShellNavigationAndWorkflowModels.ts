import type { QueryClient } from '@tanstack/react-query'

import { buildAppInteractionModelsArgs } from './buildAppInteractionModelsArgs'
import { findAppShellProposalById } from './findAppShellProposalById'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useControlRefreshActions } from './useControlRefreshActions'
import type { useDesktopUiActions } from './useDesktopUiActions'
import type { useReplayWorkspaceModel } from './useReplayWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'
import { useAppInteractionModels } from './useAppInteractionModels'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type ControlRefreshActions = ReturnType<typeof useControlRefreshActions>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>
type ReplayWorkspaceModel = ReturnType<typeof useReplayWorkspaceModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>

export type UseAppShellNavigationAndWorkflowModelsArgs = {
  queryClient: QueryClient
  workspaceBootstrapState: AppWorkspaceBootstrapState
  controlDataQueryModel: ControlDataQueryModel
  controlRefreshActions: ControlRefreshActions
  desktopUiActions: DesktopUiActions
  replayWorkspaceModel: ReplayWorkspaceModel
  runtimeAndSettingsModel: RuntimeAndSettingsModel
  strategyWorkspaceCompositeModel: StrategyWorkspaceCompositeModel
}

export function useAppShellNavigationAndWorkflowModels({
  queryClient,
  workspaceBootstrapState,
  controlDataQueryModel,
  controlRefreshActions,
  desktopUiActions,
  replayWorkspaceModel,
  runtimeAndSettingsModel,
  strategyWorkspaceCompositeModel,
}: UseAppShellNavigationAndWorkflowModelsArgs) {
  const findProposalById = (proposalId: string) =>
    findAppShellProposalById(
      strategyWorkspaceCompositeModel.strategyProposals,
      replayWorkspaceModel.replayProposalFeed,
      proposalId,
    )
  const appInteractionWorkspaceSource = {
    ...workspaceBootstrapState,
    ...controlDataQueryModel,
  }
  const appInteractionActionsSource = {
    ...controlRefreshActions,
    ...desktopUiActions,
    queryClient,
  }
  const appInteractionStrategySource = {
    ...runtimeAndSettingsModel,
    ...strategyWorkspaceCompositeModel,
    findProposalById,
  }
  const appInteractionSource = {
    ...appInteractionWorkspaceSource,
    ...appInteractionActionsSource,
    ...appInteractionStrategySource,
  }

  return useAppInteractionModels(
    buildAppInteractionModelsArgs(appInteractionSource),
  )
}
