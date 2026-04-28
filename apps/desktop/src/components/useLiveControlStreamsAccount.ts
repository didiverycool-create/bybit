import type { QueryClient } from '@tanstack/react-query'

import type { AccountLiveSnapshot } from '../types'
import { useLiveControlStream } from './useLiveControlStreamsShared'

type UseLiveControlStreamsAccountArgs = {
  enabled: boolean
  queryClient: QueryClient
}

export function useLiveControlStreamsAccount({
  enabled,
  queryClient,
}: UseLiveControlStreamsAccountArgs) {
  useLiveControlStream<AccountLiveSnapshot>({
    enabled,
    url: '/api/account/stream',
    parsePayload: (event) => JSON.parse(event.data) as AccountLiveSnapshot,
    onPayload: (payload) => {
      queryClient.setQueryData(['account-live'], payload)
      queryClient.setQueryData(['account-overview'], payload.overview)
      queryClient.setQueryData(['account-positions'], payload.positions)
      queryClient.setQueryData(['account-orders'], payload.orders)
      queryClient.setQueryData(['account-order-history'], payload.order_history)
    },
    errorLabel: '解析账户实时流快照失败',
  })
}
