import type {
  MarketDetail,
  MarketLiveSnapshot,
  WatchlistInstrument,
  WatchlistRemoveResult,
} from './types'
import { deleteJson, fetchJsonStrict, postJson } from './apiHttp'

export const marketApi = {
  getWatchlist: () => fetchJsonStrict<WatchlistInstrument[]>('/api/market/watchlist'),
  addWatchlistItem: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    requested_by?: string
  }) => postJson<WatchlistInstrument>('/api/market/watchlist', payload),
  removeWatchlistItem: (symbol: string) =>
    deleteJson<WatchlistRemoveResult>(
      `/api/market/watchlist/${encodeURIComponent(symbol)}?requested_by=desktop_operator`,
    ),
  getMarketDetail: (symbol: string, timeframe = '1h') =>
    fetchJsonStrict<MarketDetail>(
      `/api/market/${symbol}?timeframe=${encodeURIComponent(timeframe)}`,
    ),
  getMarketLiveSnapshot: (symbol: string, timeframe = '1h') =>
    fetchJsonStrict<MarketLiveSnapshot>(
      `/api/market/live?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
    ),
}
