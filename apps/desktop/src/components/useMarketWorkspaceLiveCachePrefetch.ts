import { useEffect } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import { api } from '../api'
import type { MarketDetail, MarketLiveSnapshot, WatchlistInstrument } from '../types'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import { buildMarketLivePrefetchTargets } from './marketWorkspaceSelectionHelpers'

type UseMarketWorkspaceLiveCachePrefetchArgs = {
  liveMarketEnabled: boolean
  watchlist: ReadonlyArray<WatchlistInstrument>
  marketTimeframeOptions: ReadonlyArray<{ value: MarketTimeframe }>
  stableMarketDetails: Record<string, MarketDetail>
  queryClient: QueryClient
  seedMarketLiveCaches: (payload: MarketLiveSnapshot, skipKey?: string | null) => void
}

export function useMarketWorkspaceLiveCachePrefetch({
  liveMarketEnabled,
  watchlist,
  marketTimeframeOptions,
  stableMarketDetails,
  queryClient,
  seedMarketLiveCaches,
}: UseMarketWorkspaceLiveCachePrefetchArgs) {
  useEffect(() => {
    if (!liveMarketEnabled || watchlist.length === 0) {
      return
    }
    const targets = buildMarketLivePrefetchTargets(watchlist, marketTimeframeOptions)
    targets.forEach(({ detailKey, symbol, timeframe }) => {
      if (stableMarketDetails[detailKey]) {
        return
      }
      if (queryClient.getQueryData(['market-live', symbol, timeframe])) {
        return
      }
      void queryClient
        .prefetchQuery({
          queryKey: ['market-live', symbol, timeframe],
          queryFn: () => api.getMarketLiveSnapshot(symbol, timeframe),
          staleTime: 0,
        })
        .then((payload) => {
          if (payload) {
            seedMarketLiveCaches(payload, detailKey)
          }
        })
        .catch(() => {
          // let explicit symbol/timeframe switches retry on demand
        })
    })
  }, [
    liveMarketEnabled,
    marketTimeframeOptions,
    queryClient,
    seedMarketLiveCaches,
    stableMarketDetails,
    watchlist,
  ])
}
