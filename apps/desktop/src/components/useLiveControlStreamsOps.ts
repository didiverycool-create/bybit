import type { QueryClient } from '@tanstack/react-query'

import type { OpsLiveSnapshot } from '../types'
import { useLiveControlStream } from './useLiveControlStreamsShared'

type UseLiveControlStreamsOpsArgs = {
  enabled: boolean
  queryClient: QueryClient
}

export function useLiveControlStreamsOps({ enabled, queryClient }: UseLiveControlStreamsOpsArgs) {
  useLiveControlStream<OpsLiveSnapshot>({
    enabled,
    url: '/api/ops/stream',
    parsePayload: (event) => JSON.parse(event.data) as OpsLiveSnapshot,
    onPayload: (payload) => {
      queryClient.setQueryData(['ops-live'], payload)
      queryClient.setQueryData(['alerts'], payload.alerts)
      queryClient.setQueryData(['trades'], payload.trades)
      queryClient.setQueryData(['audit'], payload.audit_events)
    },
    errorLabel: '解析 ops 实时流快照失败',
  })
}
