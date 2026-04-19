import { useCallback } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import { api } from '../api'
import type { MarketTimeframe } from '../utils/workspace-helpers'

type UseMarketWorkspaceSelectionHandlersArgs = {
  queryClient: QueryClient
  selectedMarketTimeframe: MarketTimeframe
  selectedSymbol: string
  setSelectedSymbol: (value: string) => void
  setSelectedMarketTimeframe: (value: MarketTimeframe) => void
  onSelectedPrice: (latestPrice: number) => void
}

export type UseMarketWorkspaceSelectionHandlersResult = {
  handleSelectMarketSymbol: (symbol: string, latestPrice?: number | null) => void
  handleSelectMarketTimeframe: (timeframe: MarketTimeframe) => void
}

export function useMarketWorkspaceSelectionHandlers({
  queryClient,
  selectedMarketTimeframe,
  selectedSymbol,
  setSelectedSymbol,
  setSelectedMarketTimeframe,
  onSelectedPrice,
}: UseMarketWorkspaceSelectionHandlersArgs): UseMarketWorkspaceSelectionHandlersResult {
  const primeMarketLiveSelection = useCallback(
    (symbol: string, timeframe: MarketTimeframe) => {
      const normalizedSymbol = String(symbol || '').trim().toUpperCase()
      if (!normalizedSymbol) {
        return
      }
      void queryClient
        .fetchQuery({
          queryKey: ['market-live', normalizedSymbol, timeframe],
          queryFn: () => api.getMarketLiveSnapshot(normalizedSymbol, timeframe),
          staleTime: 0,
        })
        .catch(() => {
          // let the visible query and SSE stream continue retrying
        })
    },
    [queryClient],
  )

  const handleSelectMarketSymbol = useCallback(
    (symbol: string, latestPrice?: number | null) => {
      const normalizedSymbol = String(symbol || '').trim().toUpperCase()
      if (!normalizedSymbol) {
        return
      }
      primeMarketLiveSelection(normalizedSymbol, selectedMarketTimeframe)
      setSelectedSymbol(normalizedSymbol)
      if (typeof latestPrice === 'number' && Number.isFinite(latestPrice)) {
        onSelectedPrice(latestPrice)
      }
    },
    [onSelectedPrice, primeMarketLiveSelection, selectedMarketTimeframe, setSelectedSymbol],
  )

  const handleSelectMarketTimeframe = useCallback(
    (timeframe: MarketTimeframe) => {
      primeMarketLiveSelection(selectedSymbol, timeframe)
      setSelectedMarketTimeframe(timeframe)
    },
    [primeMarketLiveSelection, selectedSymbol, setSelectedMarketTimeframe],
  )

  return {
    handleSelectMarketSymbol,
    handleSelectMarketTimeframe,
  }
}
