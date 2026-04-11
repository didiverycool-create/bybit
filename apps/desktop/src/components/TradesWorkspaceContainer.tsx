import type { ComponentProps } from 'react'

import TradesWorkspaceSection from './TradesWorkspaceSection'

type TradesWorkspaceSectionProps = ComponentProps<typeof TradesWorkspaceSection>

type TradesWorkspaceContainerProps = {
  summaryState: {
    privateApiReady: TradesWorkspaceSectionProps['privateApiReady']
    accountOverview: TradesWorkspaceSectionProps['accountOverview']
    todayRealizedPnl: TradesWorkspaceSectionProps['todayRealizedPnl']
    recentTradesCount: TradesWorkspaceSectionProps['recentTradesCount']
    manualTradesCount: TradesWorkspaceSectionProps['manualTradesCount']
  }
  filterState: {
    selectedMode: TradesWorkspaceSectionProps['selectedMode']
    tradeModeFilter: TradesWorkspaceSectionProps['tradeModeFilter']
    tradeOriginFilter: TradesWorkspaceSectionProps['tradeOriginFilter']
    tradeScopeFilter: TradesWorkspaceSectionProps['tradeScopeFilter']
    selectedSymbol: TradesWorkspaceSectionProps['selectedSymbol']
  }
  positionsState: {
    accountPositions: TradesWorkspaceSectionProps['accountPositions']
    serviceAvailable: TradesWorkspaceSectionProps['serviceAvailable']
    closeAllPaperPositionsPending: TradesWorkspaceSectionProps['closeAllPaperPositionsPending']
    closeAllExchangePositionsPending: TradesWorkspaceSectionProps['closeAllExchangePositionsPending']
    closePaperPositionPending: TradesWorkspaceSectionProps['closePaperPositionPending']
    closeExchangePositionPending: TradesWorkspaceSectionProps['closeExchangePositionPending']
  }
  ordersState: {
    filteredAccountOrders: TradesWorkspaceSectionProps['filteredAccountOrders']
    cancelAllPaperOrdersPending: TradesWorkspaceSectionProps['cancelAllPaperOrdersPending']
    cancelAllExchangeOrdersPending: TradesWorkspaceSectionProps['cancelAllExchangeOrdersPending']
    replacePaperOrderPending: TradesWorkspaceSectionProps['replacePaperOrderPending']
    replaceExchangeOrderPending: TradesWorkspaceSectionProps['replaceExchangeOrderPending']
    cancelPaperOrderPending: TradesWorkspaceSectionProps['cancelPaperOrderPending']
    cancelExchangeOrderPending: TradesWorkspaceSectionProps['cancelExchangeOrderPending']
    filteredTrades: TradesWorkspaceSectionProps['filteredTrades']
  }
  actions: Pick<
    TradesWorkspaceSectionProps,
    | 'onOpenAccountInspector'
    | 'onOpenOrderHistory'
    | 'onTradeModeFilterChange'
    | 'onTradeOriginFilterChange'
    | 'onToggleTradeScopeFilter'
    | 'onCloseAllPaperPositions'
    | 'onCloseAllExchangePositions'
    | 'onClosePaperPosition'
    | 'onCloseExchangePosition'
    | 'onCancelAllPaperOrders'
    | 'onCancelAllExchangeOrders'
    | 'onOpenOrderEditor'
    | 'onCancelPaperOrder'
    | 'onCancelExchangeOrder'
  >
}

export default function TradesWorkspaceContainer({
  summaryState,
  filterState,
  positionsState,
  ordersState,
  actions,
}: TradesWorkspaceContainerProps) {
  return (
    <TradesWorkspaceSection
      privateApiReady={summaryState.privateApiReady}
      onOpenAccountInspector={actions.onOpenAccountInspector}
      accountOverview={summaryState.accountOverview}
      todayRealizedPnl={summaryState.todayRealizedPnl}
      recentTradesCount={summaryState.recentTradesCount}
      manualTradesCount={summaryState.manualTradesCount}
      onOpenOrderHistory={actions.onOpenOrderHistory}
      selectedMode={filterState.selectedMode}
      tradeModeFilter={filterState.tradeModeFilter}
      onTradeModeFilterChange={actions.onTradeModeFilterChange}
      tradeOriginFilter={filterState.tradeOriginFilter}
      onTradeOriginFilterChange={actions.onTradeOriginFilterChange}
      tradeScopeFilter={filterState.tradeScopeFilter}
      selectedSymbol={filterState.selectedSymbol}
      onToggleTradeScopeFilter={actions.onToggleTradeScopeFilter}
      accountPositions={positionsState.accountPositions}
      serviceAvailable={positionsState.serviceAvailable}
      closeAllPaperPositionsPending={positionsState.closeAllPaperPositionsPending}
      closeAllExchangePositionsPending={positionsState.closeAllExchangePositionsPending}
      onCloseAllPaperPositions={actions.onCloseAllPaperPositions}
      onCloseAllExchangePositions={actions.onCloseAllExchangePositions}
      closePaperPositionPending={positionsState.closePaperPositionPending}
      closeExchangePositionPending={positionsState.closeExchangePositionPending}
      onClosePaperPosition={actions.onClosePaperPosition}
      onCloseExchangePosition={actions.onCloseExchangePosition}
      filteredAccountOrders={ordersState.filteredAccountOrders}
      cancelAllPaperOrdersPending={ordersState.cancelAllPaperOrdersPending}
      cancelAllExchangeOrdersPending={ordersState.cancelAllExchangeOrdersPending}
      onCancelAllPaperOrders={actions.onCancelAllPaperOrders}
      onCancelAllExchangeOrders={actions.onCancelAllExchangeOrders}
      replacePaperOrderPending={ordersState.replacePaperOrderPending}
      replaceExchangeOrderPending={ordersState.replaceExchangeOrderPending}
      cancelPaperOrderPending={ordersState.cancelPaperOrderPending}
      cancelExchangeOrderPending={ordersState.cancelExchangeOrderPending}
      onOpenOrderEditor={actions.onOpenOrderEditor}
      onCancelPaperOrder={actions.onCancelPaperOrder}
      onCancelExchangeOrder={actions.onCancelExchangeOrder}
      filteredTrades={ordersState.filteredTrades}
    />
  )
}
