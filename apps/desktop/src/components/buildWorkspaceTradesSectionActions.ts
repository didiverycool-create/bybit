import type { BuildWorkspaceSectionActionsResult } from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionOpsConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

type BuildWorkspaceTradesSectionActionsArgs = Pick<
  BuildWorkspaceSectionOpsConsumerArgs,
  'tradingExecutionActions' | 'setters'
>

export type BuildWorkspaceTradesSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'tradesWorkspaceActions'
>

export function buildWorkspaceTradesSectionActions({
  tradingExecutionActions,
  setters,
}: BuildWorkspaceTradesSectionActionsArgs): BuildWorkspaceTradesSectionActionsResult {
  return {
    tradesWorkspaceActions: {
      onOpenAccountInspector: () => setters.setAccountInspectorOpen(true),
      onOpenOrderHistory: () => setters.setOrderHistoryPanelOpen(true),
      onTradeModeFilterChange: setters.setTradeModeFilter,
      onTradeOriginFilterChange: setters.setTradeOriginFilter,
      onToggleTradeScopeFilter: () =>
        setters.setTradeScopeFilter((current) => (current === 'selected' ? 'all' : 'selected')),
      onCloseAllPaperPositions: tradingExecutionActions.closeAllPaperPositions,
      onCloseAllExchangePositions: tradingExecutionActions.closeAllExchangePositions,
      onClosePaperPosition: tradingExecutionActions.closePaperPosition,
      onCloseExchangePosition: tradingExecutionActions.closeExchangePosition,
      onCancelAllPaperOrders: tradingExecutionActions.cancelAllPaperOrders,
      onCancelAllExchangeOrders: tradingExecutionActions.cancelAllExchangeOrders,
      onOpenOrderEditor: tradingExecutionActions.openOrderEditor,
      onCancelPaperOrder: tradingExecutionActions.cancelPaperOrder,
      onCancelExchangeOrder: tradingExecutionActions.cancelExchangeOrder,
    },
  }
}
