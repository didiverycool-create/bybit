import type { MarketDetail, MarketLiveDiagnostics, WatchlistInstrument } from '../types'

export type MarketTimeframe = '15m' | '1h' | '4h' | '1d'

export type TimeframeOption = {
  value: MarketTimeframe
  label: string
}

export type MarketWorkspaceHeroSectionProps = {
  watchlistErrorMessage: string | null
  watchlist: WatchlistInstrument[]
  selectedSymbol: string
  onSelectMarketSymbol: (symbol: string, latestPrice?: number | null) => void
  marketDetail: MarketDetail | null
  marketRenderableDetail: MarketDetail | null
  marketDiagnostics: MarketLiveDiagnostics | null
  marketDiagnosticsSummary: string
  marketDiagnosticsTitle: string
  marketHeader: string
  marketDetailLoading: boolean
  marketDetailErrorMessage: string | null
  marketLiveStatusMessage: string | null
  marketLiveStatusTitle: string
  selectedWatchAlertLabel: string
  selectedMarketTimeframe: MarketTimeframe
  marketTimeframeOptions: TimeframeOption[]
  onSelectMarketTimeframe: (value: MarketTimeframe) => void
  onOpenWatchlistManager: () => void
}

export type MarketWorkspaceTradingSectionProps = {
  marketDetail: MarketDetail | null
  selectedWatchAlertLabel: string
  manualTradingBlockedReason?: string | null
  onOpenManualTrade: () => void
}

export type MarketWorkspaceSectionProps = MarketWorkspaceHeroSectionProps &
  MarketWorkspaceTradingSectionProps
