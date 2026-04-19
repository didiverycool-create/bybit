import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import type { MarketDetail, MarketLiveDiagnostics, MarketLiveSnapshot, SectionKey, WatchlistInstrument } from '../types'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import { buildMarketWorkspaceDerivedState } from './buildMarketWorkspaceDerivedState'
import { resolveMatchedMarketDetail, resolveMarketSelectionKey } from './marketWorkspaceCacheHelpers'
import {
  createIdleLiveControlStreamStatus,
  type LiveControlStreamStatus,
} from './useLiveControlStreamsShared'
import { useMarketWorkspaceLiveCache } from './useMarketWorkspaceLiveCache'
import { useMarketWorkspaceQueries } from './useMarketWorkspaceQueries'
import { useMarketWorkspaceSelectionEffects } from './useMarketWorkspaceSelectionEffects'
import { useMarketWorkspaceSelectionHandlers } from './useMarketWorkspaceSelectionHandlers'

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
  marketLiveStatusMessage: string | null
  marketLiveStatusTitle: string
  seedMarketLiveCaches: (payload: MarketLiveSnapshot, skipKey?: string | null) => void
  onLiveMarketStreamStatusChange: (status: LiveControlStreamStatus) => void
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
  const [marketLiveStreamStatus, setMarketLiveStreamStatus] = useState<LiveControlStreamStatus>(
    createIdleLiveControlStreamStatus,
  )
  const {
    liveMarketEnabled,
    marketDetailQuery,
    marketLiveQuery,
    liveMarketPayload,
    watchlist,
    watchlistErrorMessage,
  } = useMarketWorkspaceQueries({
    activeSection,
    selectedSymbol,
    selectedMarketTimeframe,
  })

  const marketSelectionKey = resolveMarketSelectionKey(selectedSymbol, selectedMarketTimeframe)
  const resolvedMarketDetail = liveMarketEnabled
    ? liveMarketPayload?.detail ?? null
    : marketDetailQuery.data ?? null
  const matchedMarketDetail = resolveMatchedMarketDetail(
    resolvedMarketDetail,
    selectedSymbol,
    selectedMarketTimeframe,
  )
  const {
    stableMarketDetails,
    stableMarketDiagnostics,
    seedMarketLiveCaches,
  } = useMarketWorkspaceLiveCache({
    queryClient,
    liveMarketEnabled,
    marketLiveSnapshot: marketLiveQuery.data,
    watchlist,
    marketTimeframeOptions,
    marketSelectionKey,
    matchedMarketDetail,
  })

  useMarketWorkspaceSelectionEffects({
    liveMarketEnabled,
    liveSelectedSymbol: liveMarketPayload?.selected_symbol,
    selectedSymbol,
    setSelectedSymbol,
    watchlist,
    marketLiveError: marketLiveQuery.error,
    queryClient,
    selectedMarketTimeframe,
  })

  const {
    marketDetail,
    marketRenderableDetail,
    marketDiagnostics,
    marketDiagnosticsSummary,
    marketDiagnosticsTitle,
    marketDetailLoading,
    marketDetailErrorMessage,
    marketLiveStatusMessage,
    marketLiveStatusTitle,
  } = buildMarketWorkspaceDerivedState({
    liveMarketEnabled,
    marketDetailQueryData: marketDetailQuery.data,
    marketLiveSnapshot: liveMarketPayload,
    matchedMarketDetail,
    stableMarketDetails,
    stableMarketDiagnostics,
    marketSelectionKey,
    marketLiveQueryIsLoading: marketLiveQuery.isLoading,
    marketLiveQueryIsFetching: marketLiveQuery.isFetching,
    marketLiveQueryError: marketLiveQuery.error,
    marketDetailQueryIsLoading: marketDetailQuery.isLoading,
    marketDetailQueryIsFetching: marketDetailQuery.isFetching,
    marketDetailQueryError: marketDetailQuery.error,
    marketLiveStreamStatus,
  })

  const { handleSelectMarketSymbol, handleSelectMarketTimeframe } =
    useMarketWorkspaceSelectionHandlers({
      queryClient,
      selectedMarketTimeframe,
      selectedSymbol,
      setSelectedSymbol,
      setSelectedMarketTimeframe,
      onSelectedPrice,
    })

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
    marketLiveStatusMessage,
    marketLiveStatusTitle,
    seedMarketLiveCaches,
    onLiveMarketStreamStatusChange: setMarketLiveStreamStatus,
    handleSelectMarketSymbol,
    handleSelectMarketTimeframe,
  }
}
