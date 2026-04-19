import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

import type { UseControlStrategyQueriesArgs } from './useControlStrategyQueries.types'

type UseControlStrategyPrimaryQueriesArgs = Pick<
  UseControlStrategyQueriesArgs,
  'activeSection'
>

export function useControlStrategyPrimaryQueries({
  activeSection,
}: UseControlStrategyPrimaryQueriesArgs) {
  const strategiesQuery = useQuery({
    queryKey: ['strategies'],
    queryFn: api.getStrategies,
    refetchInterval: 20000,
  })
  const strategyRuntimeQuery = useQuery({
    queryKey: ['strategy-runtime'],
    queryFn: api.getStrategyRuntime,
    enabled: activeSection === 'strategy' || activeSection === 'overview',
    refetchInterval: 6000,
    staleTime: 0,
  })
  const backtestsQuery = useQuery({
    queryKey: ['backtests'],
    queryFn: api.getBacktests,
    refetchInterval: 20000,
  })
  const reviewsQuery = useQuery({
    queryKey: ['reviews'],
    queryFn: api.getReviews,
    refetchInterval: 30000,
  })

  return {
    backtestsQuery,
    reviewsQuery,
    strategiesQuery,
    strategyRuntimeQuery,
  }
}
