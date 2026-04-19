import type { BuildWorkspaceSectionActionsArgs } from './buildWorkspaceSectionActions'

export type BuildWorkspaceSectionStrategyConsumerArgs = Pick<
  BuildWorkspaceSectionActionsArgs,
  | 'selectedStrategy'
  | 'navigationActions'
  | 'strategyWorkspaceActionState'
  | 'strategyWorkflowActions'
  | 'workspaceControlActions'
  | 'setters'
>

export type BuildWorkspaceSectionOpsConsumerArgs = Pick<
  BuildWorkspaceSectionActionsArgs,
  | 'news'
  | 'navigationActions'
  | 'strategyWorkflowActions'
  | 'workspaceControlActions'
  | 'tradingExecutionActions'
  | 'marketSelectionActions'
  | 'settingsPersistenceActions'
  | 'setters'
>

export type BuildWorkspaceSectionActionConsumerGroups = {
  strategyConsumerArgs: BuildWorkspaceSectionStrategyConsumerArgs
  opsConsumerArgs: BuildWorkspaceSectionOpsConsumerArgs
}

export function buildWorkspaceSectionActionConsumerGroups({
  selectedStrategy,
  news,
  navigationActions,
  strategyWorkspaceActionState,
  strategyWorkflowActions,
  workspaceControlActions,
  tradingExecutionActions,
  marketSelectionActions,
  settingsPersistenceActions,
  setters,
}: BuildWorkspaceSectionActionsArgs): BuildWorkspaceSectionActionConsumerGroups {
  return {
    strategyConsumerArgs: {
      selectedStrategy,
      navigationActions,
      strategyWorkspaceActionState,
      strategyWorkflowActions,
      workspaceControlActions,
      setters,
    },
    opsConsumerArgs: {
      news,
      navigationActions,
      strategyWorkflowActions,
      workspaceControlActions,
      tradingExecutionActions,
      marketSelectionActions,
      settingsPersistenceActions,
      setters,
    },
  }
}
