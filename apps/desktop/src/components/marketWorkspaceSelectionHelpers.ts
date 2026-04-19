import type { MarketDetail, WatchlistInstrument } from '../types'
import { resolveErrorMessage } from '../utils/app-helpers'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import { resolveMarketSelectionKey } from './marketWorkspaceCacheHelpers'

export function buildMarketLivePrefetchTargets(
  watchlist: ReadonlyArray<WatchlistInstrument>,
  marketTimeframeOptions: ReadonlyArray<{ value: MarketTimeframe }>,
): Array<{ detailKey: string; symbol: string; timeframe: MarketTimeframe }> {
  const seen = new Set<string>()
  const targets: Array<{ detailKey: string; symbol: string; timeframe: MarketTimeframe }> = []

  watchlist.forEach((item) => {
    marketTimeframeOptions.forEach((preset) => {
      const symbol = String(item.symbol || '').trim().toUpperCase()
      if (!symbol) {
        return
      }
      const detailKey = resolveMarketSelectionKey(symbol, preset.value)
      if (seen.has(detailKey)) {
        return
      }
      seen.add(detailKey)
      targets.push({
        detailKey,
        symbol,
        timeframe: preset.value,
      })
    })
  })

  return targets
}

export function shouldPersistMatchedMarketDetail(
  existing: MarketDetail | undefined,
  nextDetail: MarketDetail,
): boolean {
  return !(
    existing &&
    existing.updated_at === nextDetail.updated_at &&
    existing.candles.length === nextDetail.candles.length
  )
}

export function resolveFallbackWatchlistSymbol(
  watchlist: ReadonlyArray<WatchlistInstrument>,
  selectedSymbol: string,
): string | null {
  return (
    watchlist.find((item) => item.symbol === selectedSymbol)?.symbol ??
    watchlist[0]?.symbol ??
    null
  )
}

export function isMissingSelectedMarketError(error: unknown): boolean {
  return resolveErrorMessage(error).includes('当前自选中找不到该品种')
}
