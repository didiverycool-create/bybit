import type { BuildAppSurfaceModelsArgs } from './buildAppSurfaceModels'
import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'

type AppOverlayPanelsSurfaceArgs = BuildAppSurfaceModelsArgsInput['appOverlayPanels']

export function buildAppSurfaceModelsAppOverlayPanelsArgs(
  appOverlayPanels: AppOverlayPanelsSurfaceArgs,
): BuildAppSurfaceModelsArgs['appOverlayPanels'] {
  return {
    baseArgs: {
      panelState: appOverlayPanels.panelState,
      panelSetters: appOverlayPanels.panelSetters,
      navigationActions: appOverlayPanels.navigationActions,
      workspaceStatusModel: appOverlayPanels.workspaceStatusModel,
      workspaceControlActions: appOverlayPanels.workspaceControlActions,
      tradingExecutionActions: appOverlayPanels.tradingExecutionActions,
      strategyWorkspaceActions: appOverlayPanels.strategyWorkspaceActions,
      strategyWorkflowActions: appOverlayPanels.strategyWorkflowActions,
      reviewInspectorModel: appOverlayPanels.reviewInspectorModel,
    },
    derivedStateArgs: {
      dataState: appOverlayPanels.dataState,
      pendingState: appOverlayPanels.pendingState,
    },
  }
}
