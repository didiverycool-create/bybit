import { useQuery } from '@tanstack/react-query'

import { accountTradingApi } from '../apiAccountTrading'
import { aiWorkflowApi } from '../apiAiWorkflow'
import { opsMonitoringApi } from '../apiOpsMonitoring'

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
    queryFn: aiWorkflowApi.getAiLiveSnapshot,
    enabled: liveAiEnabled,
    refetchInterval: 4000,
    staleTime: 0,
  })
  const opsLiveQuery = useQuery({
    queryKey: ['ops-live'],
    queryFn: opsMonitoringApi.getOpsLiveSnapshot,
    enabled: liveOpsEnabled,
    refetchInterval: 4000,
    staleTime: 0,
  })
  const accountLiveQuery = useQuery({
    queryKey: ['account-live'],
    queryFn: accountTradingApi.getAccountLiveSnapshot,
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
