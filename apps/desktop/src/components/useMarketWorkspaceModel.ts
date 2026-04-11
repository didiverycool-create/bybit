import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../api'
import type {
  MarketDetail,
  MarketLiveDiagnostics,
  MarketLiveSnapshot,
  SectionKey,
  WatchlistInstrument,
} from '../types'
import {
  deriveMarketLiveDiagnostics,
  marketDiagnosticsSummaryLong,
  marketDiagnosticsSummaryShort,
  resolveErrorMessage,
} from '../utils/app-helpers'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import { normalizeWorkspaceMarketTimeframe } from '../utils/workspace-helpers'

type UseMarketWorkspaceModelArgs = {
  activeSection: SectionKey
  selectedSymbol: string
  setSelectedSymbol: (value: string) => void
  selectedMarketTimeframe: MarketTimeframe
  setSelectedMarketTimeframe: (value: MarketTimeframe) => void
  marketTimeframeOptions: ReadonlyArray<{ value: MarketTimeframe }>
  onSelectedPrice: (latestPrice: number) => void
}

type UseMarketWorkspaceModelResult = {
  liveMarketEnabled: boolean
  watchlist: WatchlistInstrument[]
  watchlistErrorMessage: string | null
  marketDetail: MarketDetail | null
  marketRenderableDetail: MarketDetail | null
  marketDiagnostics: MarketLiveDiagnostics | null
  marketDiagnosticsSummary: string
  marketDiagnosticsTitle: string
  marketDetailLoading: boolean
  marketDetailErrorMessage: string | null
  seedMarketLiveCaches: (payload: MarketLiveSnapshot, skipKey?: string | null) => void
  handleSelectMarketSymbol: (symbol: string, latestPrice?: number | null) => void
  handleSelectMarketTimeframe: (timeframe: MarketTimeframe) => void
}

export function useMarketWorkspaceModel({
  activeSection,
  selectedSymbol,
  setSelectedSymbol,
  selectedMarketTimeframe,
  setSelectedMarketTimeframe,
  marketTimeframeOptions,
  onSelectedPrice,
}: UseMarketWorkspaceModelArgs): UseMarketWorkspaceModelResult {
  const queryClient = useQueryClient()
  const liveMarketEnabled = activeSection === 'overview' || activeSection === 'market'

  const watchlistQuery = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
    enabled: true,
    refetchInterval: 12000,
    staleTime: 0,
  })
  const marketDetailQuery = useQuery({
    queryKey: ['market', selectedSymbol, selectedMarketTimeframe],
    queryFn: () => api.getMarketDetail(selectedSymbol, selectedMarketTimeframe),
    enabled: !liveMarketEnabled,
    refetchInterval: 12000,
  })
  const marketLiveQuery = useQuery({
    queryKey: ['market-live', selectedSymbol, selectedMarketTimeframe],
    queryFn: () => api.getMarketLiveSnapshot(selectedSymbol, selectedMarketTimeframe),
    enabled: liveMarketEnabled,
    refetchInterval: 30000,
    staleTime: 0,
  })

  const liveMarketPayload = marketLiveQuery.isError ? null : (marketLiveQuery.data ?? null)
  const watchlist = useMemo(
    () =>
      liveMarketEnabled
        ? liveMarketPayload?.watchlist ?? watchlistQuery.data ?? []
        : watchlistQuery.data ?? [],
    [liveMarketEnabled, liveMarketPayload?.watchlist, watchlistQuery.data],
  )
  const watchlistErrorMessage =
    watchlist.length === 0 && watchlistQuery.isError ? resolveErrorMessage(watchlistQuery.error) : null

  useEffect(() => {
    if (!liveMarketEnabled || !liveMarketPayload?.selected_symbol) {
      return
    }
    const correctedSymbol = String(liveMarketPayload.selected_symbol || '').trim().toUpperCase()
    if (!correctedSymbol || correctedSymbol === selectedSymbol) {
      return
    }
    setSelectedSymbol(correctedSymbol)
  }, [liveMarketEnabled, liveMarketPayload?.selected_symbol, selectedSymbol, setSelectedSymbol])

  const [stableMarketDetails, setStableMarketDetails] = useState<Record<string, MarketDetail>>({})
  const [stableMarketDiagnostics, setStableMarketDiagnostics] = useState<
    Record<string, MarketLiveDiagnostics>
  >({})

  const seedMarketLiveCaches = useCallback(
    (payload: MarketLiveSnapshot, skipKey?: string | null) => {
      queryClient.setQueryData(['watchlist'], payload.watchlist)
      const seen = new Set<string>()
      const details = [...(payload.watchlist_details ?? []), payload.detail].filter(Boolean)
      const nextStableDetails: Record<string, MarketDetail> = {}
      const nextStableDiagnostics: Record<string, MarketLiveDiagnostics> = {}
      for (const detail of details) {
        const normalizedSymbol = String(detail.symbol || '').trim().toUpperCase()
        if (!normalizedSymbol) {
          continue
        }
        const normalizedTimeframe = normalizeWorkspaceMarketTimeframe(detail.timeframe)
        const detailKey = `${normalizedSymbol}:${normalizedTimeframe}`
        if (seen.has(detailKey) || detail.candles.length === 0) {
          continue
        }
        seen.add(detailKey)
        const diagnostics = deriveMarketLiveDiagnostics(
          payload,
          detail,
          normalizedSymbol,
          normalizedTimeframe,
        )
        nextStableDetails[detailKey] = detail
        nextStableDiagnostics[detailKey] = diagnostics
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
      const detailEntries = Object.entries(nextStableDetails)
      if (detailEntries.length > 0) {
        setStableMarketDetails((current) => {
          let changed = false
          const next = { ...current }
          detailEntries.forEach(([detailKey, detail]) => {
            const existing = current[detailKey]
            const existingLastTime = existing?.candles.at(-1)?.time ?? null
            const nextLastTime = detail.candles.at(-1)?.time ?? null
            if (
              existing &&
              existing.updated_at === detail.updated_at &&
              existing.candles.length === detail.candles.length &&
              existingLastTime === nextLastTime
            ) {
              return
            }
            next[detailKey] = detail
            changed = true
          })
          return changed ? next : current
        })
      }
      const diagnosticEntries = Object.entries(nextStableDiagnostics)
      if (diagnosticEntries.length > 0) {
        setStableMarketDiagnostics((current) => {
          let changed = false
          const next = { ...current }
          diagnosticEntries.forEach(([detailKey, diagnostics]) => {
            const existing = current[detailKey]
            if (
              existing &&
              existing.effective_symbol === diagnostics.effective_symbol &&
              existing.timeframe === diagnostics.timeframe &&
              existing.detail_source === diagnostics.detail_source &&
              existing.detail_candle_count === diagnostics.detail_candle_count &&
              existing.watchlist_real_detail_count === diagnostics.watchlist_real_detail_count &&
              existing.watchlist_fallback_detail_count ===
                diagnostics.watchlist_fallback_detail_count &&
              existing.generated_in_ms === diagnostics.generated_in_ms &&
              existing.selection_corrected === diagnostics.selection_corrected
            ) {
              return
            }
            next[detailKey] = diagnostics
            changed = true
          })
          return changed ? next : current
        })
      }
    },
    [queryClient],
  )

  const marketSelectionKey = `${selectedSymbol}:${selectedMarketTimeframe}`

  useEffect(() => {
    if (!liveMarketEnabled || !marketLiveQuery.data) {
      return
    }
    seedMarketLiveCaches(marketLiveQuery.data, marketSelectionKey)
  }, [liveMarketEnabled, marketLiveQuery.data, marketSelectionKey, seedMarketLiveCaches])

  useEffect(() => {
    if (!liveMarketEnabled || watchlist.length === 0) {
      return
    }
    const targets = watchlist.flatMap((item) =>
      marketTimeframeOptions.map((preset) => ({
        symbol: item.symbol,
        timeframe: preset.value,
      })),
    )
    targets.forEach(({ symbol, timeframe }) => {
      const normalizedSymbol = String(symbol || '').trim().toUpperCase()
      if (!normalizedSymbol) {
        return
      }
      const detailKey = `${normalizedSymbol}:${timeframe}`
      if (stableMarketDetails[detailKey]) {
        return
      }
      if (queryClient.getQueryData(['market-live', normalizedSymbol, timeframe])) {
        return
      }
      void queryClient
        .prefetchQuery({
          queryKey: ['market-live', normalizedSymbol, timeframe],
          queryFn: () => api.getMarketLiveSnapshot(normalizedSymbol, timeframe),
          staleTime: 0,
        })
        .then((payload) => {
          if (payload) {
            seedMarketLiveCaches(payload, `${normalizedSymbol}:${timeframe}`)
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

  const resolvedMarketDetail = liveMarketEnabled ? liveMarketPayload?.detail ?? null : marketDetailQuery.data
  const matchedMarketDetail =
    resolvedMarketDetail &&
    resolvedMarketDetail.symbol.toUpperCase() === selectedSymbol.toUpperCase() &&
    normalizeWorkspaceMarketTimeframe(resolvedMarketDetail.timeframe) === selectedMarketTimeframe
      ? resolvedMarketDetail
      : null

  useEffect(() => {
    if (matchedMarketDetail && matchedMarketDetail.candles.length > 0) {
      setStableMarketDetails((current) => {
        const existing = current[marketSelectionKey]
        if (
          existing &&
          existing.updated_at === matchedMarketDetail.updated_at &&
          existing.candles.length === matchedMarketDetail.candles.length
        ) {
          return current
        }
        return {
          ...current,
          [marketSelectionKey]: matchedMarketDetail,
        }
      })
    }
  }, [marketSelectionKey, matchedMarketDetail])

  const marketDetail =
    (matchedMarketDetail && matchedMarketDetail.candles.length > 0 ? matchedMarketDetail : null) ??
    stableMarketDetails[marketSelectionKey] ??
    null
  const marketDiagnostics = liveMarketEnabled
    ? liveMarketPayload?.diagnostics ?? stableMarketDiagnostics[marketSelectionKey] ?? null
    : null
  const marketDiagnosticsSummary = marketDiagnosticsSummaryShort(marketDiagnostics)
  const marketDiagnosticsTitle = marketDiagnosticsSummaryLong(marketDiagnostics)
  const marketRenderableDetail = marketDetail && marketDetail.candles.length > 0 ? marketDetail : null
  const marketDetailLoading =
    !marketRenderableDetail &&
    (liveMarketEnabled
      ? marketLiveQuery.isLoading || marketLiveQuery.isFetching
      : marketDetailQuery.isLoading || marketDetailQuery.isFetching)
  const marketDetailErrorMessage =
    !marketRenderableDetail && (liveMarketEnabled ? marketLiveQuery.error : marketDetailQuery.error)
      ? resolveErrorMessage(liveMarketEnabled ? marketLiveQuery.error : marketDetailQuery.error)
      : null

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

  useEffect(() => {
    const firstSymbol = watchlist[0]?.symbol
    const hasSelectedSymbol = watchlist.some((item) => item.symbol === selectedSymbol)
    if (firstSymbol && (!selectedSymbol || !hasSelectedSymbol)) {
      setSelectedSymbol(firstSymbol)
    }
  }, [selectedSymbol, setSelectedSymbol, watchlist])

  useEffect(() => {
    if (!liveMarketEnabled || !marketLiveQuery.error) {
      return
    }
    const errorMessage = resolveErrorMessage(marketLiveQuery.error)
    if (!errorMessage.includes('当前自选中找不到该品种')) {
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
          queryFn: api.getWatchlist,
          staleTime: 0,
        })
        if (cancelled) {
          return
        }
        const fallbackSymbol =
          refreshedWatchlist.find((item) => item.symbol === selectedSymbol)?.symbol ??
          refreshedWatchlist[0]?.symbol ??
          null
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
    marketLiveQuery.error,
    queryClient,
    selectedMarketTimeframe,
    selectedSymbol,
    setSelectedSymbol,
  ])

  return {
    liveMarketEnabled,
    watchlist,
    watchlistErrorMessage,
    marketDetail,
    marketRenderableDetail,
    marketDiagnostics,
    marketDiagnosticsSummary,
    marketDiagnosticsTitle,
    marketDetailLoading,
    marketDetailErrorMessage,
    seedMarketLiveCaches,
    handleSelectMarketSymbol,
    handleSelectMarketTimeframe,
  }
}
