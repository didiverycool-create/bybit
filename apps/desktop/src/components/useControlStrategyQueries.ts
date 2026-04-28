import { useMemo } from 'react'

import { useControlStrategyLiveQueries } from './useControlStrategyLiveQueries'
import { useControlStrategyPrimaryQueries } from './useControlStrategyPrimaryQueries'
import { useControlStrategyReviewQueries } from './useControlStrategyReviewQueries'
import { useControlStrategySelectionState } from './useControlStrategySelectionState'
import type { UseControlStrategyQueriesArgs } from './useControlStrategyQueries.types'

export function useControlStrategyQueries({
  activeSection,
  selectedMode,
  selectedStrategyId,
  selectedBacktestId,
  backtestFilter,
  replayTrackingScope,
  strategyActivityPanelOpen,
}: UseControlStrategyQueriesArgs) {
  const liveStrategyEnabled = activeSection === 'strategy' || activeSection === 'overview'
  const primaryQueries = useControlStrategyPrimaryQueries({
    activeSection,
  })
  const selectionState = useControlStrategySelectionState({
    backtestsQueryData: primaryQueries.backtestsQuery.data,
    backtestFilter,
    selectedBacktestId,
    selectedMode,
    selectedStrategyId,
    strategiesQueryData: primaryQueries.strategiesQuery.data,
    strategyRuntimeQueryData: primaryQueries.strategyRuntimeQuery.data,
  })
  const liveQueries = useControlStrategyLiveQueries({
    activeStrategyId: selectionState.activeStrategyId,
    liveStrategyEnabled,
    selectedMode,
    selectedStrategySupportsSelectedMode: selectionState.selectedStrategySupportsSelectedMode,
    runtimePreviewMatchesSelectedMode: selectionState.runtimePreviewMatchesSelectedMode,
    selectedStrategyModeMismatchPreview: selectionState.selectedStrategyModeMismatchPreview,
    strategyActivityPanelOpen,
  })
  const reviews = useMemo(() => primaryQueries.reviewsQuery.data ?? [], [primaryQueries.reviewsQuery.data])
  const reviewQueries = useControlStrategyReviewQueries({
    activeSection,
    activeStrategyId: selectionState.activeStrategyId,
    replayTrackingScope,
    selectedBacktestQueryId: selectionState.selectedBacktestQueryId,
    selectedStrategyIdForReplay: selectionState.selectedStrategy?.id ?? null,
  })
  const selectedModeStrategyPreview =
    liveQueries.strategyExecutionPreviewQuery.data ??
    selectionState.selectedStrategyModeMismatchPreview ??
    selectionState.selectedStrategyExecutionPreview
  const strategyActivityQueryErrorMessage =
    liveQueries.strategyActivityQuery.error instanceof Error
      ? liveQueries.strategyActivityQuery.error.message
      : liveQueries.strategyActivityQuery.error
        ? String(liveQueries.strategyActivityQuery.error)
        : ''

  return {
    activeStrategyId: selectionState.activeStrategyId,
    backtests: selectionState.backtests,
    backtestsQuery: primaryQueries.backtestsQuery,
    replayTrackingReviewsQuery: reviewQueries.replayTrackingReviewsQuery,
    reviews,
    reviewsQuery: primaryQueries.reviewsQuery,
    selectedBacktestQueryId: selectionState.selectedBacktestQueryId,
    selectedBacktestReviewsQuery: reviewQueries.selectedBacktestReviewsQuery,
    selectedModeStrategyPreview,
    selectedStrategy: selectionState.selectedStrategy,
    selectedStrategyActivity: liveQueries.strategyActivityQuery.data,
    selectedStrategyExecutionPreview: selectionState.selectedStrategyExecutionPreview,
    selectedStrategyModeMismatchPreview: selectionState.selectedStrategyModeMismatchPreview,
    selectedStrategyReviewsQuery: reviewQueries.selectedStrategyReviewsQuery,
    selectedStrategyRuntime: selectionState.selectedStrategyRuntime,
    selectedStrategySupportsSelectedMode: selectionState.selectedStrategySupportsSelectedMode,
    strategies: selectionState.strategies,
    strategiesQuery: primaryQueries.strategiesQuery,
    strategyActivityQuery: liveQueries.strategyActivityQuery,
    strategyActivityQueryErrorMessage,
    strategyExecutionPreviewQuery: liveQueries.strategyExecutionPreviewQuery,
    strategyNameMap: selectionState.strategyNameMap,
    strategyRuntime: selectionState.strategyRuntime,
    strategyRuntimeQuery: primaryQueries.strategyRuntimeQuery,
  }
}
