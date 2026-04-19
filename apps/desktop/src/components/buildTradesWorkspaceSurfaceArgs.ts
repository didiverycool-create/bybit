import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildTradesWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildTradesWorkspaceSurfaceArgs({
  source,
}: BuildTradesWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['tradesWorkspace'] {
  const {
    selectedMode,
    tradeModeFilter,
    tradeOriginFilter,
    tradeScopeFilter,
    selectedSymbol,
    accountOverview,
    accountPositions,
    serviceAvailable,
    closeAllPaperPositionsPending,
    closeAllExchangePositionsPending,
    closePaperPositionPending,
    closeExchangePositionPending,
    filteredAccountOrders,
    filteredTrades,
    bybitPrivateStatus,
    trades,
    snapshot,
    opsLive,
  } = source

  return {
    summaryState: {
      privateApiReady: Boolean(bybitPrivateStatus?.can_query_private),
      accountOverview,
      todayRealizedPnl: snapshot?.today_performance.realized_pnl ?? null,
      recentTradesCount: opsLive?.summary.recent_trades ?? trades.length,
      manualTradesCount: opsLive?.summary.manual_trades ?? 0,
    },
    filterState: {
      selectedMode,
      tradeModeFilter,
      tradeOriginFilter,
      tradeScopeFilter,
      selectedSymbol,
    },
    positionsState: {
      accountPositions,
      serviceAvailable,
      closeAllPaperPositionsPending,
      closeAllExchangePositionsPending,
      closePaperPositionPending,
      closeExchangePositionPending,
    },
    ordersState: {
      filteredAccountOrders,
      cancelAllPaperOrdersPending: source.cancelAllPaperOrdersPending,
      cancelAllExchangeOrdersPending: source.cancelAllExchangeOrdersPending,
      replacePaperOrderPending: source.replacePaperOrderPending,
      replaceExchangeOrderPending: source.replaceExchangeOrderPending,
      cancelPaperOrderPending: source.cancelPaperOrderPending,
      cancelExchangeOrderPending: source.cancelExchangeOrderPending,
      filteredTrades,
    },
  }
}
