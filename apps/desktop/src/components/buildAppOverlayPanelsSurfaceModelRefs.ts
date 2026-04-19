import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'
import type { BuildAppOverlayPanelsSurfaceModelsArgsInput } from './buildAppOverlayPanelsSurfaceDataArgs'

type AppOverlayPanelsSurfaceArgs = BuildAppSurfaceModelsArgsInput['appOverlayPanels']

export function buildAppOverlayPanelsSurfaceModelRefs({
  workspaceStatusModel,
  workspaceControlActions,
  tradingExecutionActions,
  strategyWorkspaceActions,
  strategyWorkflowActions,
  reviewInspectorModel,
}: BuildAppOverlayPanelsSurfaceModelsArgsInput): Pick<
  AppOverlayPanelsSurfaceArgs,
  | 'workspaceStatusModel'
  | 'workspaceControlActions'
  | 'tradingExecutionActions'
  | 'strategyWorkspaceActions'
  | 'strategyWorkflowActions'
  | 'reviewInspectorModel'
> {
  return {
    workspaceStatusModel,
    workspaceControlActions,
    tradingExecutionActions,
    strategyWorkspaceActions,
    strategyWorkflowActions,
    reviewInspectorModel,
  }
}
