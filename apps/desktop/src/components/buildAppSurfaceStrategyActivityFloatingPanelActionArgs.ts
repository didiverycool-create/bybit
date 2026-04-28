import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildStrategyActivityFloatingPanelSurfaceArgsInput } from './buildStrategyActivityFloatingPanelSurfaceArgs'

export type BuildAppSurfaceStrategyActivityFloatingPanelActionArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAppSurfaceStrategyActivityFloatingPanelActionArgs({
  source,
}: BuildAppSurfaceStrategyActivityFloatingPanelActionArgsInput): Pick<
  BuildStrategyActivityFloatingPanelSurfaceArgsInput,
  | 'navigationActions'
  | 'strategyWorkspaceActions'
  | 'workspaceControlActions'
  | 'strategyWorkflowActions'
  | 'tradingExecutionActions'
  | 'setters'
> {
  const {
    setStrategyActivityPanelOpen,
    setWatchlistManagerOpen,
    workspaceNavigation,
    strategyWorkflowActions,
    workspaceControlActions,
    tradingExecutionActions,
    strategyWorkspaceActions,
  } = source

  return {
    navigationActions: workspaceNavigation,
    strategyWorkspaceActions,
    workspaceControlActions,
    strategyWorkflowActions,
    tradingExecutionActions,
    setters: {
      setStrategyActivityPanelOpen,
      setWatchlistManagerOpen,
    },
  }
}
