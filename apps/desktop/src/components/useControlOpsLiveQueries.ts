import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

type UseControlOpsLiveQueriesArgs = {
  liveAiEnabled: boolean
  liveOpsEnabled: boolean
  liveAccountEnabled: boolean
}

export function useControlOpsLiveQueries({
  liveAiEnabled,
  liveOpsEnabled,
  liveAccountEnabled,
}: UseControlOpsLiveQueriesArgs) {
  const aiLiveQuery = useQuery({
    queryKey: ['ai-live'],
    queryFn: api.getAiLiveSnapshot,
    enabled: liveAiEnabled,
    refetchInterval: 4000,
    staleTime: 0,
  })
  const opsLiveQuery = useQuery({
    queryKey: ['ops-live'],
    queryFn: api.getOpsLiveSnapshot,
    enabled: liveOpsEnabled,
    refetchInterval: 4000,
    staleTime: 0,
  })
  const accountLiveQuery = useQuery({
    queryKey: ['account-live'],
    queryFn: api.getAccountLiveSnapshot,
    enabled: liveAccountEnabled,
    refetchInterval: 4000,
    staleTime: 0,
  })

  return {
    aiLiveQuery,
    opsLiveQuery,
    accountLiveQuery,
  }
}
