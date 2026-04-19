import type { QueryClient } from '@tanstack/react-query'

import type {
  MarketDetail,
  MarketLiveSnapshot,
  WatchlistInstrument,
} from '../types'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import { useMarketWorkspaceLiveCachePersistence } from './useMarketWorkspaceLiveCachePersistence'
import { useMarketWorkspaceLiveCachePrefetch } from './useMarketWorkspaceLiveCachePrefetch'
import { useMarketWorkspaceLiveCacheSeed } from './useMarketWorkspaceLiveCacheSeed'

type UseMarketWorkspaceLiveCacheArgs = {
  queryClient: QueryClient
  liveMarketEnabled: boolean
  marketLiveSnapshot: MarketLiveSnapshot | undefined
  watchlist: WatchlistInstrument[]
  marketTimeframeOptions: ReadonlyArray<{ value: MarketTimeframe }>
  marketSelectionKey: string
  matchedMarketDetail: MarketDetail | null
}

export function useMarketWorkspaceLiveCache({
  queryClient,
  liveMarketEnabled,
  marketLiveSnapshot,
  watchlist,
  marketTimeframeOptions,
  marketSelectionKey,
  matchedMarketDetail,
}: UseMarketWorkspaceLiveCacheArgs) {
  const {
    stableMarketDetails,
    stableMarketDiagnostics,
    seedMarketLiveCaches,
    setStableMarketDetails,
  } = useMarketWorkspaceLiveCacheSeed({
    queryClient,
    liveMarketEnabled,
    marketLiveSnapshot,
    marketSelectionKey,
  })

  useMarketWorkspaceLiveCachePrefetch({
    liveMarketEnabled,
    watchlist,
    marketTimeframeOptions,
    stableMarketDetails,
    queryClient,
    seedMarketLiveCaches,
  })

  useMarketWorkspaceLiveCachePersistence({
    marketSelectionKey,
    matchedMarketDetail,
    setStableMarketDetails,
  })

  return {
    stableMarketDetails,
    stableMarketDiagnostics,
    seedMarketLiveCaches,
  }
}
