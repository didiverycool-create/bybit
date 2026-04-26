import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import { marketApi } from '../apiMarket'
import type { WatchlistInstrument } from '../types'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import {
  isMissingSelectedMarketError,
  resolveFallbackWatchlistSymbol,
} from './marketWorkspaceSelectionHelpers'

type UseMarketWorkspaceSelectionEffectsArgs = {
  liveMarketEnabled: boolean
  liveSelectedSymbol?: string | null
  selectedSymbol: string
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  watchlist: WatchlistInstrument[]
  marketLiveError: unknown
  queryClient: QueryClient
  selectedMarketTimeframe: MarketTimeframe
}

export function useMarketWorkspaceSelectionEffects({
  liveMarketEnabled,
  liveSelectedSymbol,
  selectedSymbol,
  setSelectedSymbol,
  watchlist,
  marketLiveError,
  queryClient,
  selectedMarketTimeframe,
}: UseMarketWorkspaceSelectionEffectsArgs) {
  useEffect(() => {
    if (!liveMarketEnabled || !liveSelectedSymbol) {
      return
    }
    const correctedSymbol = String(liveSelectedSymbol || '').trim().toUpperCase()
    if (!correctedSymbol || correctedSymbol === selectedSymbol) {
      return
    }
    setSelectedSymbol(correctedSymbol)
  }, [liveMarketEnabled, liveSelectedSymbol, selectedSymbol, setSelectedSymbol])

  useEffect(() => {
    const firstSymbol = watchlist[0]?.symbol
    const hasSelectedSymbol = watchlist.some((item) => item.symbol === selectedSymbol)
    if (firstSymbol && (!selectedSymbol || !hasSelectedSymbol)) {
      setSelectedSymbol(firstSymbol)
    }
  }, [selectedSymbol, setSelectedSymbol, watchlist])

  useEffect(() => {
    if (!liveMarketEnabled || !marketLiveError) {
      return
    }
    if (!isMissingSelectedMarketError(marketLiveError)) {
      return
    }
    queryClient.removeQueries({
      queryKey: ['market-live', selectedSymbol, selectedMarketTimeframe],
      exact: true,
    })
    queryClient.removeQueries({
      queryKey: ['market', selectedSymbol, selectedMarketTimeframe],
      exact: true,
    })
    let cancelled = false
    void (async () => {
      try {
        const refreshedWatchlist = await queryClient.fetchQuery({
          queryKey: ['watchlist'],
          queryFn: marketApi.getWatchlist,
          staleTime: 0,
        })
        if (cancelled) {
          return
        }
        const fallbackSymbol = resolveFallbackWatchlistSymbol(refreshedWatchlist, selectedSymbol)
        if (fallbackSymbol && fallbackSymbol !== selectedSymbol) {
          setSelectedSymbol(fallbackSymbol)
        }
      } catch {
        // leave the visible error state intact until the next successful watchlist refresh
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    liveMarketEnabled,
    marketLiveError,
    queryClient,
    selectedMarketTimeframe,
    selectedSymbol,
    setSelectedSymbol,
  ])
}
