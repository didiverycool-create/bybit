import { useMemo } from 'react'

import {
  buildStrategyModeMismatchPreview,
  extractStrategyExecutionPreview,
  strategyExecutionPreviewMatchesMode,
  strategySupportsExecutionPreviewMode,
} from '../utils/app-helpers'

import { resolveSelectedStrategyId } from './resolveSelectedStrategyId'
import type { UseControlStrategyQueriesArgs } from './useControlStrategyQueries.types'

type UseControlStrategySelectionStateArgs = Pick<
  UseControlStrategyQueriesArgs,
  'selectedBacktestId' | 'selectedMode' | 'selectedStrategyId' | 'backtestFilter'
> & {
  strategiesQueryData: Awaited<ReturnType<typeof import('../api').api.getStrategies>> | undefined
  strategyRuntimeQueryData: Awaited<ReturnType<typeof import('../api').api.getStrategyRuntime>> | undefined
  backtestsQueryData: Awaited<ReturnType<typeof import('../api').api.getBacktests>> | undefined
}

export function useControlStrategySelectionState({
  backtestsQueryData,
  backtestFilter,
  selectedBacktestId,
  selectedMode,
  selectedStrategyId,
  strategiesQueryData,
  strategyRuntimeQueryData,
}: UseControlStrategySelectionStateArgs) {
  const strategies = useMemo(() => strategiesQueryData ?? [], [strategiesQueryData])
  const strategyRuntime = strategyRuntimeQueryData ?? []
  const backtests = useMemo(() => backtestsQueryData ?? [], [backtestsQueryData])
  const resolvedSelectedStrategyId = resolveSelectedStrategyId({
    strategies,
    selectedStrategyId,
  })
  const selectedStrategy =
    strategies.find((item) => item.id === resolvedSelectedStrategyId) ?? strategies[0]
  const selectedStrategyRuntime = selectedStrategy
    ? strategyRuntime.find((item) => item.strategy_id === selectedStrategy.id) ?? null
    : null
  const selectedStrategyExecutionPreview = extractStrategyExecutionPreview(selectedStrategyRuntime)
  const selectedStrategyModeMismatchPreview = buildStrategyModeMismatchPreview(
    selectedStrategy,
    selectedStrategyRuntime,
    selectedMode,
  )
  const selectedStrategySupportsSelectedMode = strategySupportsExecutionPreviewMode(
    selectedStrategy,
    selectedMode,
  )
  const activeStrategyId = selectedStrategy?.id ?? resolvedSelectedStrategyId ?? ''
  const runtimePreviewMatchesSelectedMode = strategyExecutionPreviewMatchesMode(
    selectedStrategyExecutionPreview,
    selectedMode,
  )
  const strategyNameMap = useMemo(
    () => new Map(strategies.map((item) => [item.id, item.name])),
    [strategies],
  )
  const selectedBacktestQueryId =
    selectedBacktestId ??
    (
      (
        backtestFilter === 'selected' && activeStrategyId
          ? backtests.find((item) => item.strategy_id === activeStrategyId)
          : backtests[0]
      )?.id ?? null
    )

  return {
    activeStrategyId,
    backtests,
    runtimePreviewMatchesSelectedMode,
    selectedBacktestQueryId,
    selectedStrategy,
    selectedStrategyExecutionPreview,
    selectedStrategyModeMismatchPreview,
    selectedStrategyRuntime,
    selectedStrategySupportsSelectedMode,
    strategies,
    strategyNameMap,
    strategyRuntime,
  }
}
