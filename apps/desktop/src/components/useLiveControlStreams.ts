import { useEffect } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import { CONTROL_API_BASE } from '../api'
import type {
  AccountLiveSnapshot,
  AiLiveSnapshot,
  MarketLiveSnapshot,
  OpsLiveSnapshot,
  StrategyRuntimeSnapshot,
} from '../types'
import type { MarketTimeframe } from '../utils/workspace-helpers'

type UseLiveControlStreamsArgs = {
  liveMarketEnabled: boolean
  selectedSymbol: string
  selectedMarketTimeframe: MarketTimeframe
  queryClient: QueryClient
  seedMarketLiveCaches: (payload: MarketLiveSnapshot, skipKey?: string | null) => void
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
  liveAiStreamEnabled,
  liveOpsStreamEnabled,
  liveAccountStreamEnabled,
  liveStrategyStreamEnabled,
}: UseLiveControlStreamsArgs) {
  useEffect(() => {
    if (!liveMarketEnabled || !selectedSymbol || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(
      `${CONTROL_API_BASE}/api/market/stream?symbol=${encodeURIComponent(selectedSymbol)}&timeframe=${encodeURIComponent(selectedMarketTimeframe)}`,
    )

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as MarketLiveSnapshot
        queryClient.setQueryData(['market-live', selectedSymbol, selectedMarketTimeframe], payload)
        if (payload.detail?.candles?.length > 0) {
          queryClient.setQueryData(['market', selectedSymbol, selectedMarketTimeframe], payload.detail)
        }
        seedMarketLiveCaches(payload, `${selectedSymbol}:${selectedMarketTimeframe}`)
      } catch (error) {
        console.warn('解析市场流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [liveMarketEnabled, queryClient, seedMarketLiveCaches, selectedMarketTimeframe, selectedSymbol])

  useEffect(() => {
    if (!liveAiStreamEnabled || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(`${CONTROL_API_BASE}/api/ai/stream`)

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as AiLiveSnapshot
        queryClient.setQueryData(['ai-live'], payload)
        queryClient.setQueryData(['scheduler'], {
          scheduler: payload.scheduler,
          jobs: payload.jobs,
          change_requests: payload.change_requests,
        })
        queryClient.setQueryData(['change-requests'], payload.change_requests)
      } catch (error) {
        console.warn('解析 AI 调度流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [liveAiStreamEnabled, queryClient])

  useEffect(() => {
    if (!liveOpsStreamEnabled || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(`${CONTROL_API_BASE}/api/ops/stream`)

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as OpsLiveSnapshot
        queryClient.setQueryData(['ops-live'], payload)
        queryClient.setQueryData(['alerts'], payload.alerts)
        queryClient.setQueryData(['trades'], payload.trades)
        queryClient.setQueryData(['audit'], payload.audit_events)
      } catch (error) {
        console.warn('解析 ops 实时流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [liveOpsStreamEnabled, queryClient])

  useEffect(() => {
    if (!liveAccountStreamEnabled || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(`${CONTROL_API_BASE}/api/account/stream`)

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as AccountLiveSnapshot
        queryClient.setQueryData(['account-live'], payload)
        queryClient.setQueryData(['account-overview'], payload.overview)
        queryClient.setQueryData(['account-positions'], payload.positions)
        queryClient.setQueryData(['account-orders'], payload.orders)
        queryClient.setQueryData(['account-order-history'], payload.order_history)
      } catch (error) {
        console.warn('解析账户实时流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [liveAccountStreamEnabled, queryClient])

  useEffect(() => {
    if (!liveStrategyStreamEnabled || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(`${CONTROL_API_BASE}/api/strategies/stream`)

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { items?: StrategyRuntimeSnapshot[] }
        queryClient.setQueryData(['strategy-runtime'], payload.items ?? [])
      } catch (error) {
        console.warn('解析策略运行态流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [liveStrategyStreamEnabled, queryClient])
}
