import { useMutation } from '@tanstack/react-query'

import { api } from '../api'

import { buildStrategyWorkflowBacktestChangeRequestAction } from './useStrategyWorkflowBacktestChangeRequestAction'
import { buildStrategyWorkflowBacktestRecommendationAction } from './useStrategyWorkflowBacktestRecommendationAction'
import { buildStrategyWorkflowBacktestReviewAction } from './useStrategyWorkflowBacktestReviewAction'
import { buildStrategyWorkflowBacktestSubmitAction } from './useStrategyWorkflowBacktestSubmitAction'
import type { UseStrategyWorkflowBacktestActionsArgs } from './useStrategyWorkflowBacktestActions.types'

export function useStrategyWorkflowBacktestActions({
  refreshControlData,
  selectedStrategy,
  strategies,
  backtests,
  reviewCatalog,
  backtestRangeDraft,
  backtestTimeframeDraft,
  setSelectedStrategyId,
  setBacktestRangeDraft,
  setBacktestTimeframeDraft,
  setSelectedBacktestId,
  showFeedback,
}: UseStrategyWorkflowBacktestActionsArgs) {
  const backtestMutation = useMutation({
    mutationFn: api.createBacktest,
    onSuccess: refreshControlData,
  })

  const submitBacktest = buildStrategyWorkflowBacktestSubmitAction({
    backtestMutation,
    selectedStrategy,
    backtestRangeDraft,
    backtestTimeframeDraft,
    showFeedback,
  })

  const rerunBacktestFromRecommendation = buildStrategyWorkflowBacktestRecommendationAction({
    backtestMutation,
    selectedStrategy,
    strategies,
    backtests,
    reviewCatalog,
    setSelectedStrategyId,
    setBacktestRangeDraft,
    setBacktestTimeframeDraft,
    setSelectedBacktestId,
    showFeedback,
  })

  const rerunBacktestFromReview = buildStrategyWorkflowBacktestReviewAction({
    backtestMutation,
    strategies,
    setSelectedStrategyId,
    setBacktestRangeDraft,
    setBacktestTimeframeDraft,
    setSelectedBacktestId,
    showFeedback,
  })

  const rerunBacktestFromChangeRequest = buildStrategyWorkflowBacktestChangeRequestAction({
    backtestMutation,
    selectedStrategy,
    strategies,
    backtests,
    setSelectedStrategyId,
    setBacktestRangeDraft,
    setBacktestTimeframeDraft,
    setSelectedBacktestId,
    showFeedback,
  })

  return {
    backtestMutationPending: backtestMutation.isPending,
    submitBacktest,
    rerunBacktestFromRecommendation,
    rerunBacktestFromReview,
    rerunBacktestFromChangeRequest,
  }
}
