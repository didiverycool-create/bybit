import type { QueryClient } from '@tanstack/react-query'

import type { MarketLiveSnapshot } from '../types'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import { useLiveControlStream, type LiveControlStreamStatus } from './useLiveControlStreamsShared'

type UseLiveControlStreamsMarketArgs = {
  enabled: boolean
  selectedSymbol: string
  selectedMarketTimeframe: MarketTimeframe
  queryClient: QueryClient
  seedMarketLiveCaches: (payload: MarketLiveSnapshot, skipKey?: string | null) => void
  onStatusChange: (status: LiveControlStreamStatus) => void
}

export function useLiveControlStreamsMarket({
  enabled,
  selectedSymbol,
  selectedMarketTimeframe,
  queryClient,
  seedMarketLiveCaches,
  onStatusChange,
}: UseLiveControlStreamsMarketArgs) {
  useLiveControlStream<MarketLiveSnapshot>({
    enabled: enabled && Boolean(selectedSymbol),
    url: `/api/market/stream?symbol=${encodeURIComponent(selectedSymbol)}&timeframe=${encodeURIComponent(selectedMarketTimeframe)}`,
    parsePayload: (event) => JSON.parse(event.data) as MarketLiveSnapshot,
    onPayload: (payload) => {
      queryClient.setQueryData(['market-live', selectedSymbol, selectedMarketTimeframe], payload)
      if (payload.detail?.candles?.length > 0) {
        queryClient.setQueryData(['market', selectedSymbol, selectedMarketTimeframe], payload.detail)
      }
      seedMarketLiveCaches(payload, `${selectedSymbol}:${selectedMarketTimeframe}`)
    },
    errorLabel: '解析市场流快照失败',
    onStatusChange,
  })
}
