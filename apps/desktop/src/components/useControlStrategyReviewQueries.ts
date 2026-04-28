import { useQuery } from '@tanstack/react-query'

import { aiWorkflowApi } from '../apiAiWorkflow'

import type { UseControlStrategyQueriesArgs } from './useControlStrategyQueries.types'

type UseControlStrategyReviewQueriesArgs = Pick<
  UseControlStrategyQueriesArgs,
  'activeSection' | 'replayTrackingScope'
> & {
  activeStrategyId: string
  selectedBacktestQueryId: string | null
  selectedStrategyIdForReplay: string | null
}

export function useControlStrategyReviewQueries({
  activeSection,
  activeStrategyId,
  replayTrackingScope,
  selectedBacktestQueryId,
  selectedStrategyIdForReplay,
}: UseControlStrategyReviewQueriesArgs) {
  const selectedStrategyReviewsQuery = useQuery({
    queryKey: ['strategy-reviews', activeStrategyId],
    queryFn: () => aiWorkflowApi.getReviews({ strategyId: activeStrategyId }),
    enabled:
      Boolean(activeStrategyId) &&
      (activeSection === 'strategy' || activeSection === 'backtest' || activeSection === 'replay'),
    refetchInterval:
      activeSection === 'strategy' ||
      activeSection === 'backtest' ||
      activeSection === 'replay'
        ? 30000
        : false,
  })
  const selectedBacktestReviewsQuery = useQuery({
    queryKey: ['backtest-reviews', selectedBacktestQueryId],
    queryFn: () =>
      aiWorkflowApi.getReviews({ backtestId: selectedBacktestQueryId, periods: ['backtest'] }),
    enabled:
      Boolean(selectedBacktestQueryId) &&
      (activeSection === 'backtest' || activeSection === 'replay'),
    refetchInterval:
      activeSection === 'backtest' || activeSection === 'replay' ? 30000 : false,
  })
  const replayTrackingReviewsQuery = useQuery({
    queryKey: ['replay-tracking-reviews', replayTrackingScope, selectedStrategyIdForReplay ?? 'none'],
    queryFn: () =>
      aiWorkflowApi.getReviews({
        strategyId: replayTrackingScope === 'selected' ? selectedStrategyIdForReplay : null,
        periods: ['strategy_issue', 'strategy_change'],
      }),
    enabled:
      activeSection === 'replay' &&
      (replayTrackingScope === 'all' || Boolean(selectedStrategyIdForReplay)),
    refetchInterval: activeSection === 'replay' ? 30000 : false,
  })

  return {
    replayTrackingReviewsQuery,
    selectedBacktestReviewsQuery,
    selectedStrategyReviewsQuery,
  }
}
