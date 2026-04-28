import { useMemo } from 'react'

import type { AgentJob, BacktestRun, ReviewDocument, StrategySummary } from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  backtestReviewJobMeta,
  backtestSampleQualityMeta,
  backtestWindowMeta,
  getAgentJobBacktestId,
} from '../utils/app-helpers'

type UseStrategyBacktestSelectionCurrentBacktestStateArgs = {
  selectedStrategy: StrategySummary | null
  selectedBacktestId: string | null
  selectedBacktestReviewsData: ReviewDocument[] | undefined
  reviewCatalog: ReviewDocument[]
  backtests: BacktestRun[]
  backtestFilter: 'selected' | 'all'
  backtestReviewJobs: AgentJob[]
}

export function useStrategyBacktestSelectionCurrentBacktestState({
  selectedStrategy,
  selectedBacktestId,
  selectedBacktestReviewsData,
  reviewCatalog,
  backtests,
  backtestFilter,
  backtestReviewJobs,
}: UseStrategyBacktestSelectionCurrentBacktestStateArgs) {
  const backtestsForWorkspace =
    backtestFilter === 'selected' && selectedStrategy
      ? backtests.filter((item) => item.strategy_id === selectedStrategy.id)
      : backtests
  const selectedBacktest =
    backtestsForWorkspace.find((item) => item.id === selectedBacktestId) ?? backtestsForWorkspace[0]
  const selectedBacktestReviews = selectedBacktest
    ? (selectedBacktestReviewsData ?? reviewCatalog)
        .filter((review) => review.backtest_id === selectedBacktest.id)
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        )
    : []
  const selectedBacktestReview = selectedBacktestReviews[0] ?? null
  const selectedBacktestReviewJob = useMemo(
    () =>
      selectedBacktest
        ? backtestReviewJobs.find((job) => getAgentJobBacktestId(job) === selectedBacktest.id) ?? null
        : null,
    [backtestReviewJobs, selectedBacktest],
  )
  const selectedBacktestProposals = selectedBacktestReview?.proposals ?? []
  const selectedBacktestDecisionMeta = backtestDecisionReadinessMeta(selectedBacktest)
  const selectedBacktestSampleMeta = backtestSampleQualityMeta(selectedBacktest)
  const selectedBacktestLineageMeta = backtestLineageMeta(selectedBacktest)
  const selectedBacktestWindowMeta = backtestWindowMeta(selectedBacktest)
  const selectedBacktestReviewJobMeta = backtestReviewJobMeta(
    selectedBacktestReviewJob,
    Boolean(selectedBacktestReview),
  )

  return {
    backtestsForWorkspace,
    selectedBacktest,
    selectedBacktestReviews,
    selectedBacktestReview,
    selectedBacktestReviewJob,
    selectedBacktestProposals,
    selectedBacktestDecisionMeta,
    selectedBacktestSampleMeta,
    selectedBacktestLineageMeta,
    selectedBacktestWindowMeta,
    selectedBacktestReviewJobMeta,
  }
}
