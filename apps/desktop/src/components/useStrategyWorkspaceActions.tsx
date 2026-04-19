import { buildStrategyWorkspaceActionHandlers } from './buildStrategyWorkspaceActionHandlers'
import { renderLatestSchedulerCommandActions } from './renderLatestSchedulerCommandActions'
import type { UseStrategyWorkspaceActionsArgs } from './strategyWorkspaceActionsShared'

export function useStrategyWorkspaceActions({
  ...args
}: UseStrategyWorkspaceActionsArgs) {
  const actionHandlers = buildStrategyWorkspaceActionHandlers(args)
  const renderLatestActions = (buttonClass = 'ghost-button ghost-button--inline') =>
    renderLatestSchedulerCommandActions(args, buttonClass)

  return {
    ...actionHandlers,
    renderLatestSchedulerCommandActions: renderLatestActions,
  }
}
