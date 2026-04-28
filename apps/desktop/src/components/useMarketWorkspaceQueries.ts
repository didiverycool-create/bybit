import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { marketApi } from '../apiMarket'
import type {
  MarketLiveSnapshot,
  SectionKey,
  WatchlistInstrument,
} from '../types'
import { resolveErrorMessage } from '../utils/app-helpers'
import type { MarketTimeframe } from '../utils/workspace-helpers'

export type UseMarketWorkspaceQueriesArgs = {
  activeSection: SectionKey
  selectedSymbol: string
  selectedMarketTimeframe: MarketTimeframe
}

export function useMarketWorkspaceQueries({
  activeSection,
  selectedSymbol,
  selectedMarketTimeframe,
}: UseMarketWorkspaceQueriesArgs) {
  const liveMarketEnabled = activeSection === 'overview' || activeSection === 'market'

  const watchlistQuery = useQuery({
    queryKey: ['watchlist'],
    queryFn: marketApi.getWatchlist,
    enabled: true,
    refetchInterval: 12000,
    staleTime: 0,
  })
  const marketDetailQuery = useQuery({
    queryKey: ['market', selectedSymbol, selectedMarketTimeframe],
    queryFn: () => marketApi.getMarketDetail(selectedSymbol, selectedMarketTimeframe),
    enabled: !liveMarketEnabled,
    refetchInterval: 12000,
  })
  const marketLiveQuery = useQuery({
    queryKey: ['market-live', selectedSymbol, selectedMarketTimeframe],
    queryFn: () => marketApi.getMarketLiveSnapshot(selectedSymbol, selectedMarketTimeframe),
    enabled: liveMarketEnabled,
    refetchInterval: 30000,
    staleTime: 0,
  })

  const liveMarketPayload = marketLiveQuery.isError
    ? null
    : ((marketLiveQuery.data ?? null) as MarketLiveSnapshot | null)
  const watchlist = useMemo<WatchlistInstrument[]>(
    () =>
      liveMarketEnabled
        ? liveMarketPayload?.watchlist ?? watchlistQuery.data ?? []
        : watchlistQuery.data ?? [],
    [liveMarketEnabled, liveMarketPayload?.watchlist, watchlistQuery.data],
  )
  const watchlistErrorMessage =
    watchlist.length === 0 && watchlistQuery.isError
      ? resolveErrorMessage(watchlistQuery.error)
      : null

  return {
    liveMarketEnabled,
    watchlistQuery,
    marketDetailQuery,
    marketLiveQuery,
    liveMarketPayload,
    watchlist,
    watchlistErrorMessage,
  }
}
