import MarketWorkspaceHeroSection from './MarketWorkspaceHeroSection'
import MarketWorkspaceTradingSection from './MarketWorkspaceTradingSection'
import type { MarketWorkspaceSectionProps } from './marketWorkspaceSectionTypes'

export default function MarketWorkspaceSection({
  watchlistErrorMessage,
  watchlist,
  selectedSymbol,
  onSelectMarketSymbol,
  marketDetail,
  marketRenderableDetail,
  marketDiagnostics,
  marketDiagnosticsSummary,
  marketDiagnosticsTitle,
  marketHeader,
  marketDetailLoading,
  marketDetailErrorMessage,
  marketLiveStatusMessage,
  marketLiveStatusTitle,
  selectedWatchAlertLabel,
  selectedMarketTimeframe,
  marketTimeframeOptions,
  onSelectMarketTimeframe,
  onOpenWatchlistManager,
  onOpenManualTrade,
  manualTradingBlockedReason,
}: MarketWorkspaceSectionProps) {
  return (
    <section className="section-grid section-grid--market section-entrance">
      <MarketWorkspaceHeroSection
        watchlistErrorMessage={watchlistErrorMessage}
        watchlist={watchlist}
        selectedSymbol={selectedSymbol}
        onSelectMarketSymbol={onSelectMarketSymbol}
        marketDetail={marketDetail}
        marketRenderableDetail={marketRenderableDetail}
        marketDiagnostics={marketDiagnostics}
        marketDiagnosticsSummary={marketDiagnosticsSummary}
        marketDiagnosticsTitle={marketDiagnosticsTitle}
        marketHeader={marketHeader}
        marketDetailLoading={marketDetailLoading}
        marketDetailErrorMessage={marketDetailErrorMessage}
        marketLiveStatusMessage={marketLiveStatusMessage}
        marketLiveStatusTitle={marketLiveStatusTitle}
        selectedWatchAlertLabel={selectedWatchAlertLabel}
        selectedMarketTimeframe={selectedMarketTimeframe}
        marketTimeframeOptions={marketTimeframeOptions}
        onSelectMarketTimeframe={onSelectMarketTimeframe}
        onOpenWatchlistManager={onOpenWatchlistManager}
      />
      <MarketWorkspaceTradingSection
        marketDetail={marketDetail}
        selectedWatchAlertLabel={selectedWatchAlertLabel}
        manualTradingBlockedReason={manualTradingBlockedReason}
        onOpenManualTrade={onOpenManualTrade}
      />
    </section>
  )
}
