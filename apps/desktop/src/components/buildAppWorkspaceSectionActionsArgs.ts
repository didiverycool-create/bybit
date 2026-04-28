import type { BuildWorkspaceSectionActionsArgs } from './buildWorkspaceSectionActions'
import type { useStrategyWorkflowActions } from './useStrategyWorkflowActions'
import type { useStrategyWorkspaceActions } from './useStrategyWorkspaceActions'
import type { useTradingExecutionActions } from './useTradingExecutionActions'
import type { useWorkspaceControlActions } from './useWorkspaceControlActions'
import type { useWorkspaceNavigation } from './useWorkspaceNavigation'

type WorkspaceNavigationModel = ReturnType<typeof useWorkspaceNavigation>
type StrategyWorkspaceActionsModel = ReturnType<typeof useStrategyWorkspaceActions>
type StrategyWorkflowActionsModel = ReturnType<typeof useStrategyWorkflowActions>
type WorkspaceControlActionsModel = ReturnType<typeof useWorkspaceControlActions>
type TradingExecutionActionsModel = ReturnType<typeof useTradingExecutionActions>

export type BuildAppWorkspaceSectionActionsArgsInput = {
  selectedStrategy: BuildWorkspaceSectionActionsArgs['selectedStrategy']
  news: BuildWorkspaceSectionActionsArgs['news']
  navigationActions: WorkspaceNavigationModel
  strategyWorkspaceActions: Pick<StrategyWorkspaceActionsModel, 'openStrategyTrackingPanel'>
  strategyWorkflowActions: StrategyWorkflowActionsModel
  workspaceControlActions: WorkspaceControlActionsModel
  tradingExecutionActions: Pick<
    TradingExecutionActionsModel,
    | 'openOrderEditor'
    | 'closePaperPosition'
    | 'closeExchangePosition'
    | 'closeAllPaperPositions'
    | 'closeAllExchangePositions'
    | 'cancelPaperOrder'
    | 'cancelExchangeOrder'
    | 'cancelAllExchangeOrders'
    | 'cancelAllPaperOrders'
  >
  marketSelectionActions: BuildWorkspaceSectionActionsArgs['marketSelectionActions']
  settingsPersistenceActions: BuildWorkspaceSectionActionsArgs['settingsPersistenceActions']
  setters: BuildWorkspaceSectionActionsArgs['setters']
}

export function buildAppWorkspaceSectionActionsArgs({
  selectedStrategy,
  news,
  navigationActions,
  strategyWorkspaceActions,
  strategyWorkflowActions,
  workspaceControlActions,
  tradingExecutionActions,
  marketSelectionActions,
  settingsPersistenceActions,
  setters,
}: BuildAppWorkspaceSectionActionsArgsInput): BuildWorkspaceSectionActionsArgs {
  const sharedSource = {
    selectedStrategy,
    news,
    navigationActions,
    setters,
  }
  const strategySource = {
    strategyWorkspaceActions,
    strategyWorkflowActions,
    workspaceControlActions,
  }
  const opsSource = {
    tradingExecutionActions,
    marketSelectionActions,
    settingsPersistenceActions,
  }

  return {
    selectedStrategy: sharedSource.selectedStrategy,
    news: sharedSource.news,
    navigationActions: sharedSource.navigationActions,
    strategyWorkspaceActionState: {
      openStrategyTrackingPanel: strategySource.strategyWorkspaceActions.openStrategyTrackingPanel,
    },
    strategyWorkflowActions: strategySource.strategyWorkflowActions,
    workspaceControlActions: strategySource.workspaceControlActions,
    tradingExecutionActions: opsSource.tradingExecutionActions,
    marketSelectionActions: opsSource.marketSelectionActions,
    settingsPersistenceActions: opsSource.settingsPersistenceActions,
    setters: sharedSource.setters,
  }
}
