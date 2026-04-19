import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

import type { UseControlStrategyQueriesArgs } from './useControlStrategyQueries.types'

type UseControlStrategyLiveQueriesArgs = Pick<
  UseControlStrategyQueriesArgs,
  'selectedMode' | 'strategyActivityPanelOpen'
> & {
  activeStrategyId: string
  liveStrategyEnabled: boolean
  selectedStrategySupportsSelectedMode: boolean
  runtimePreviewMatchesSelectedMode: boolean
  selectedStrategyModeMismatchPreview: unknown
}

export function useControlStrategyLiveQueries({
  activeStrategyId,
  liveStrategyEnabled,
  selectedMode,
  selectedStrategySupportsSelectedMode,
  runtimePreviewMatchesSelectedMode,
  selectedStrategyModeMismatchPreview,
  strategyActivityPanelOpen,
}: UseControlStrategyLiveQueriesArgs) {
  const strategyExecutionPreviewQuery = useQuery({
    queryKey: ['strategy-execution-preview', activeStrategyId, selectedMode],
    queryFn: () => api.getStrategyExecutionPreview(activeStrategyId, selectedMode),
    enabled:
      Boolean(activeStrategyId) &&
      liveStrategyEnabled &&
      selectedStrategySupportsSelectedMode &&
      !runtimePreviewMatchesSelectedMode &&
      !selectedStrategyModeMismatchPreview,
    refetchInterval: 6000,
    staleTime: 0,
  })
  const strategyActivityQuery = useQuery({
    queryKey: ['strategy-activity', activeStrategyId],
    queryFn: () => api.getStrategyActivity(activeStrategyId),
    enabled: Boolean(activeStrategyId) && strategyActivityPanelOpen,
    refetchInterval: strategyActivityPanelOpen ? 5000 : false,
    staleTime: 0,
  })

  return {
    strategyActivityQuery,
    strategyExecutionPreviewQuery,
  }
}
