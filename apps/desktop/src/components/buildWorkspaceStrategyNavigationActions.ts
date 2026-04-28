import { buildWorkspaceStrategyEditorNavigationAction } from './buildWorkspaceStrategyEditorNavigationAction'
import { buildWorkspaceStrategyReplayNavigationActions } from './buildWorkspaceStrategyReplayNavigationActions'
import type { BuildWorkspaceStrategyNavigationActionsArgs } from './buildWorkspaceStrategyNavigationActions.types'

export function buildWorkspaceStrategyNavigationActions({
  ...args
}: BuildWorkspaceStrategyNavigationActionsArgs) {
  const openStrategyEditor = buildWorkspaceStrategyEditorNavigationAction(args)
  const replayNavigationActions = buildWorkspaceStrategyReplayNavigationActions(args)

  return {
    openStrategyEditor,
    ...replayNavigationActions,
  }
}
