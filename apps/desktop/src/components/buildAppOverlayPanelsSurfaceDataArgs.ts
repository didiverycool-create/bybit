import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'
import { buildAppOverlayPanelsSurfaceModelRefs } from './buildAppOverlayPanelsSurfaceModelRefs'
import {
  buildAppOverlayPanelsSurfaceDataStateArgs,
  type BuildAppOverlayPanelsSurfaceDataStateArgsInput,
} from './buildAppOverlayPanelsSurfaceDataStateArgs'
import {
  buildAppOverlayPanelsSurfacePendingStateArgs,
  type BuildAppOverlayPanelsSurfacePendingStateArgsInput,
} from './buildAppOverlayPanelsSurfacePendingStateArgs'

type AppOverlayPanelsSurfaceArgs = BuildAppSurfaceModelsArgsInput['appOverlayPanels']

export type BuildAppOverlayPanelsSurfaceModelsArgsInput = {
  workspaceStatusModel: AppOverlayPanelsSurfaceArgs['workspaceStatusModel']
  workspaceControlActions: AppOverlayPanelsSurfaceArgs['workspaceControlActions']
  tradingExecutionActions: AppOverlayPanelsSurfaceArgs['tradingExecutionActions']
  strategyWorkspaceActions: AppOverlayPanelsSurfaceArgs['strategyWorkspaceActions']
  strategyWorkflowActions: AppOverlayPanelsSurfaceArgs['strategyWorkflowActions']
  reviewInspectorModel: AppOverlayPanelsSurfaceArgs['reviewInspectorModel']
}

export type BuildAppOverlayPanelsSurfaceDataArgsInput =
  BuildAppOverlayPanelsSurfaceDataStateArgsInput

export type BuildAppOverlayPanelsSurfacePendingArgsInput =
  BuildAppOverlayPanelsSurfacePendingStateArgsInput

export type BuildAppOverlayPanelsSurfaceDataBundleArgsInput =
  BuildAppOverlayPanelsSurfaceModelsArgsInput &
    BuildAppOverlayPanelsSurfaceDataArgsInput &
    BuildAppOverlayPanelsSurfacePendingArgsInput

export function buildAppOverlayPanelsSurfaceDataArgs(
  input: BuildAppOverlayPanelsSurfaceDataBundleArgsInput,
): Pick<
  AppOverlayPanelsSurfaceArgs,
  | 'workspaceStatusModel'
  | 'workspaceControlActions'
  | 'tradingExecutionActions'
  | 'strategyWorkspaceActions'
  | 'strategyWorkflowActions'
  | 'reviewInspectorModel'
  | 'dataState'
  | 'pendingState'
> {
  return {
    ...buildAppOverlayPanelsSurfaceModelRefs(input),
    dataState: buildAppOverlayPanelsSurfaceDataStateArgs(input),
    pendingState: buildAppOverlayPanelsSurfacePendingStateArgs(input),
  }
}
