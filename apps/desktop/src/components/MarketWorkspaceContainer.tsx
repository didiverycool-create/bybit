import type { ComponentProps } from 'react'

import MarketWorkspaceSection from './MarketWorkspaceSection'

type MarketWorkspaceSectionProps = ComponentProps<typeof MarketWorkspaceSection>

type MarketWorkspaceContainerProps = {
  watchlistState: {
    watchlistErrorMessage: MarketWorkspaceSectionProps['watchlistErrorMessage']
    watchlist: MarketWorkspaceSectionProps['watchlist']
    selectedSymbol: MarketWorkspaceSectionProps['selectedSymbol']
    selectedWatchAlertLabel: MarketWorkspaceSectionProps['selectedWatchAlertLabel']
  }
  marketState: {
    marketDetail: MarketWorkspaceSectionProps['marketDetail']
    marketRenderableDetail: MarketWorkspaceSectionProps['marketRenderableDetail']
    marketDiagnostics: MarketWorkspaceSectionProps['marketDiagnostics']
    marketDiagnosticsSummary: MarketWorkspaceSectionProps['marketDiagnosticsSummary']
    marketDiagnosticsTitle: MarketWorkspaceSectionProps['marketDiagnosticsTitle']
    marketHeader: MarketWorkspaceSectionProps['marketHeader']
    marketDetailLoading: MarketWorkspaceSectionProps['marketDetailLoading']
    marketDetailErrorMessage: MarketWorkspaceSectionProps['marketDetailErrorMessage']
    marketLiveStatusMessage: MarketWorkspaceSectionProps['marketLiveStatusMessage']
    marketLiveStatusTitle: MarketWorkspaceSectionProps['marketLiveStatusTitle']
    selectedMarketTimeframe: MarketWorkspaceSectionProps['selectedMarketTimeframe']
    marketTimeframeOptions: MarketWorkspaceSectionProps['marketTimeframeOptions']
    manualTradingBlockedReason: MarketWorkspaceSectionProps['manualTradingBlockedReason']
  }
  actions: Pick<
    MarketWorkspaceSectionProps,
    | 'onSelectMarketSymbol'
    | 'onSelectMarketTimeframe'
    | 'onOpenWatchlistManager'
    | 'onOpenManualTrade'
  >
}

export default function MarketWorkspaceContainer({
  watchlistState,
  marketState,
  actions,
}: MarketWorkspaceContainerProps) {
  return (
    <MarketWorkspaceSection
      watchlistErrorMessage={watchlistState.watchlistErrorMessage}
      watchlist={watchlistState.watchlist}
      selectedSymbol={watchlistState.selectedSymbol}
      onSelectMarketSymbol={actions.onSelectMarketSymbol}
      marketDetail={marketState.marketDetail}
      marketRenderableDetail={marketState.marketRenderableDetail}
      marketDiagnostics={marketState.marketDiagnostics}
      marketDiagnosticsSummary={marketState.marketDiagnosticsSummary}
      marketDiagnosticsTitle={marketState.marketDiagnosticsTitle}
      marketHeader={marketState.marketHeader}
      marketDetailLoading={marketState.marketDetailLoading}
      marketDetailErrorMessage={marketState.marketDetailErrorMessage}
      marketLiveStatusMessage={marketState.marketLiveStatusMessage}
      marketLiveStatusTitle={marketState.marketLiveStatusTitle}
      selectedWatchAlertLabel={watchlistState.selectedWatchAlertLabel}
      selectedMarketTimeframe={marketState.selectedMarketTimeframe}
      marketTimeframeOptions={marketState.marketTimeframeOptions}
      onSelectMarketTimeframe={actions.onSelectMarketTimeframe}
      onOpenWatchlistManager={actions.onOpenWatchlistManager}
      onOpenManualTrade={actions.onOpenManualTrade}
      manualTradingBlockedReason={marketState.manualTradingBlockedReason}
    />
  )
}
