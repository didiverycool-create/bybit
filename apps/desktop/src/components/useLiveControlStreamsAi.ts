import type { QueryClient } from '@tanstack/react-query'

import type { AiLiveSnapshot } from '../types'
import { useLiveControlStream } from './useLiveControlStreamsShared'

type UseLiveControlStreamsAiArgs = {
  enabled: boolean
  queryClient: QueryClient
}

export function useLiveControlStreamsAi({ enabled, queryClient }: UseLiveControlStreamsAiArgs) {
  useLiveControlStream<AiLiveSnapshot>({
    enabled,
    url: '/api/ai/stream',
    parsePayload: (event) => JSON.parse(event.data) as AiLiveSnapshot,
    onPayload: (payload) => {
      queryClient.setQueryData(['ai-live'], payload)
      queryClient.setQueryData(['scheduler'], {
        scheduler: payload.scheduler,
        jobs: payload.jobs,
        change_requests: payload.change_requests,
      })
      queryClient.setQueryData(['change-requests'], payload.change_requests)
    },
    errorLabel: '解析 AI 调度流快照失败',
  })
}
