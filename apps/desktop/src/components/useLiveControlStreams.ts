import type { QueryClient } from '@tanstack/react-query'
import type {
  MarketLiveSnapshot,
} from '../types'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import type { LiveControlStreamStatus } from './useLiveControlStreamsShared'
import { useLiveControlStreamsAccount } from './useLiveControlStreamsAccount'
import { useLiveControlStreamsAi } from './useLiveControlStreamsAi'
import { useLiveControlStreamsMarket } from './useLiveControlStreamsMarket'
import { useLiveControlStreamsOps } from './useLiveControlStreamsOps'
import { useLiveControlStreamsStrategy } from './useLiveControlStreamsStrategy'

type UseLiveControlStreamsArgs = {
  liveMarketEnabled: boolean
  selectedSymbol: string
  selectedMarketTimeframe: MarketTimeframe
  queryClient: QueryClient
  seedMarketLiveCaches: (payload: MarketLiveSnapshot, skipKey?: string | null) => void
  onLiveMarketStreamStatusChange: (status: LiveControlStreamStatus) => void
  liveAiStreamEnabled: boolean
  liveOpsStreamEnabled: boolean
  liveAccountStreamEnabled: boolean
  liveStrategyStreamEnabled: boolean
}

export function useLiveControlStreams({
  liveMarketEnabled,
  selectedSymbol,
  selectedMarketTimeframe,
  queryClient,
  seedMarketLiveCaches,
  onLiveMarketStreamStatusChange,
  liveAiStreamEnabled,
  liveOpsStreamEnabled,
  liveAccountStreamEnabled,
  liveStrategyStreamEnabled,
}: UseLiveControlStreamsArgs) {
  useLiveControlStreamsMarket({
    enabled: liveMarketEnabled,
    selectedSymbol,
    selectedMarketTimeframe,
    queryClient,
    seedMarketLiveCaches,
    onStatusChange: onLiveMarketStreamStatusChange,
  })

  useLiveControlStreamsAi({
    enabled: liveAiStreamEnabled,
    queryClient,
  })

  useLiveControlStreamsOps({
    enabled: liveOpsStreamEnabled,
    queryClient,
  })

  useLiveControlStreamsAccount({
    enabled: liveAccountStreamEnabled,
    queryClient,
  })

  useLiveControlStreamsStrategy({
    enabled: liveStrategyStreamEnabled,
    queryClient,
  })
}
