import type { QueryClient } from '@tanstack/react-query'

import type { StrategyRuntimeSnapshot } from '../types'
import { useLiveControlStream } from './useLiveControlStreamsShared'

type UseLiveControlStreamsStrategyArgs = {
  enabled: boolean
  queryClient: QueryClient
}

export function useLiveControlStreamsStrategy({
  enabled,
  queryClient,
}: UseLiveControlStreamsStrategyArgs) {
  useLiveControlStream<{ items?: StrategyRuntimeSnapshot[] }>({
    enabled,
    url: '/api/strategies/stream',
    parsePayload: (event) => JSON.parse(event.data) as { items?: StrategyRuntimeSnapshot[] },
    onPayload: (payload) => {
      queryClient.setQueryData(['strategy-runtime'], payload.items ?? [])
    },
    errorLabel: '解析策略运行态流快照失败',
  })
}
