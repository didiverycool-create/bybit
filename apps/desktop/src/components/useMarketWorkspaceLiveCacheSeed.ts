import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import type {
  MarketDetail,
  MarketLiveDiagnostics,
  MarketLiveSnapshot,
} from '../types'
import {
  buildMarketLiveCacheSeedState,
  mergeStableMarketDetails,
  mergeStableMarketDiagnostics,
} from './marketWorkspaceCacheHelpers'

type UseMarketWorkspaceLiveCacheSeedArgs = {
  queryClient: QueryClient
  liveMarketEnabled: boolean
  marketLiveSnapshot: MarketLiveSnapshot | undefined
  marketSelectionKey: string
}

export type UseMarketWorkspaceLiveCacheSeedResult = {
  stableMarketDetails: Record<string, MarketDetail>
  stableMarketDiagnostics: Record<string, MarketLiveDiagnostics>
  seedMarketLiveCaches: (payload: MarketLiveSnapshot, skipKey?: string | null) => void
  setStableMarketDetails: Dispatch<SetStateAction<Record<string, MarketDetail>>>
}

export function useMarketWorkspaceLiveCacheSeed({
  queryClient,
  liveMarketEnabled,
  marketLiveSnapshot,
  marketSelectionKey,
}: UseMarketWorkspaceLiveCacheSeedArgs): UseMarketWorkspaceLiveCacheSeedResult {
  const [stableMarketDetails, setStableMarketDetails] = useState<Record<string, MarketDetail>>({})
  const [stableMarketDiagnostics, setStableMarketDiagnostics] = useState<
    Record<string, MarketLiveDiagnostics>
  >({})

  const seedMarketLiveCaches = useCallback(
    (payload: MarketLiveSnapshot, skipKey?: string | null) => {
      queryClient.setQueryData(['watchlist'], payload.watchlist)
      const {
        nextStableDetails,
        nextStableDiagnostics,
        seededDetails,
      } = buildMarketLiveCacheSeedState(payload)
      for (const {
        detail,
        detailKey,
        diagnostics,
        normalizedSymbol,
        normalizedTimeframe,
      } of seededDetails) {
        queryClient.setQueryData(['market', normalizedSymbol, normalizedTimeframe], detail)
        if (detailKey === skipKey) {
          continue
        }
        queryClient.setQueryData<MarketLiveSnapshot>(
          ['market-live', normalizedSymbol, normalizedTimeframe],
          (current) => ({
            selected_symbol: normalizedSymbol,
            watchlist: payload.watchlist,
            detail,
            watchlist_details: payload.watchlist_details ?? current?.watchlist_details ?? [detail],
            diagnostics,
            generated_at: payload.generated_at,
          }),
        )
      }
      if (Object.keys(nextStableDetails).length > 0) {
        setStableMarketDetails((current) => mergeStableMarketDetails(current, nextStableDetails))
      }
      if (Object.keys(nextStableDiagnostics).length > 0) {
        setStableMarketDiagnostics((current) =>
          mergeStableMarketDiagnostics(current, nextStableDiagnostics),
        )
      }
    },
    [queryClient],
  )

  useEffect(() => {
    if (!liveMarketEnabled || !marketLiveSnapshot) {
      return
    }
    seedMarketLiveCaches(marketLiveSnapshot, marketSelectionKey)
  }, [liveMarketEnabled, marketLiveSnapshot, marketSelectionKey, seedMarketLiveCaches])

  return {
    stableMarketDetails,
    stableMarketDiagnostics,
    seedMarketLiveCaches,
    setStableMarketDetails,
  }
}
