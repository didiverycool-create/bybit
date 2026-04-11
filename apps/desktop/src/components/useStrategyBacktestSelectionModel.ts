import { useMemo } from 'react'

import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
  StrategySummary,
} from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  backtestReviewJobMeta,
  backtestSampleQualityMeta,
  backtestWindowMeta,
  getAgentJobBacktestId,
  isStrategyTrackingReview,
} from '../utils/app-helpers'

type UseStrategyBacktestSelectionModelArgs = {
  latestStrategyBacktest: BacktestRun | null
  selectedStrategy: StrategySummary | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  selectedStrategyReviews: ReviewDocument[]
  selectedBacktestReviewsData: ReviewDocument[] | undefined
  reviewCatalog: ReviewDocument[]
  backtests: BacktestRun[]
  backtestFilter: 'selected' | 'all'
  backtestReviewJobs: AgentJob[]
  strategyProposals: StrategyProposal[]
  changeRequests: ChangeRequest[]
}

export function useStrategyBacktestSelectionModel({
  latestStrategyBacktest,
  selectedStrategy,
  selectedChangeRequestId,
  selectedBacktestId,
  selectedStrategyReviews,
  selectedBacktestReviewsData,
  reviewCatalog,
  backtests,
  backtestFilter,
  backtestReviewJobs,
  strategyProposals,
  changeRequests,
}: UseStrategyBacktestSelectionModelArgs) {
  const latestStrategyBacktestReview = useMemo(
    () =>
      latestStrategyBacktest
        ? reviewCatalog
            .filter((review) => review.backtest_id === latestStrategyBacktest.id)
            .sort(
              (left, right) =>
                new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
            )[0] ?? null
        : null,
    [latestStrategyBacktest, reviewCatalog],
  )
  const latestStrategyBacktestReviewJob = useMemo(
    () =>
      latestStrategyBacktest
        ? backtestReviewJobs.find((job) => getAgentJobBacktestId(job) === latestStrategyBacktest.id) ??
          null
        : null,
    [backtestReviewJobs, latestStrategyBacktest],
  )
  const latestStrategyBacktestReviewJobMeta = backtestReviewJobMeta(
    latestStrategyBacktestReviewJob,
    Boolean(latestStrategyBacktestReview),
  )

  const selectedStrategyPrimaryReviews = useMemo(
    () => selectedStrategyReviews.filter((review) => !isStrategyTrackingReview(review.period)),
    [selectedStrategyReviews],
  )
  const openStrategyProposals = useMemo(
    () => strategyProposals.filter((proposal) => ['pending', 'testing'].includes(proposal.status)),
    [strategyProposals],
  )
  const gatedPublishProposalCount = useMemo(
    () =>
      openStrategyProposals.filter(
        (proposal) => proposal.proposal_type === 'publish_recommendation',
      ).length,
    [openStrategyProposals],
  )
  const allStrategyChangeRequests = useMemo(
    () =>
      selectedStrategy
        ? changeRequests.filter((request) => String(request.payload.strategy_id ?? '') === selectedStrategy.id)
        : [],
    [changeRequests, selectedStrategy],
  )
  const selectedStrategyChangeRequest =
    selectedChangeRequestId != null
      ? allStrategyChangeRequests.find((request) => request.id === selectedChangeRequestId) ?? null
      : null
  const strategyChangeRequests = useMemo(() => {
    const recentRequests = allStrategyChangeRequests.slice(0, 6)
    if (!selectedStrategyChangeRequest) {
      return recentRequests
    }
    if (recentRequests.some((request) => request.id === selectedStrategyChangeRequest.id)) {
      return recentRequests
    }
    return [
      selectedStrategyChangeRequest,
      ...allStrategyChangeRequests
        .filter((request) => request.id !== selectedStrategyChangeRequest.id)
        .slice(0, 5),
    ]
  }, [allStrategyChangeRequests, selectedStrategyChangeRequest])
  const selectedStrategyReview =
    selectedStrategyPrimaryReviews[0] ?? selectedStrategyReviews[0] ?? null
  const selectedStrategyParameterSignature = JSON.stringify(
    (selectedStrategy?.parameters ?? []).map((parameter) => [parameter.key, parameter.value]),
  )

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
  const selectedBacktestReviewJob =
    selectedBacktest
      ? backtestReviewJobs.find((job) => getAgentJobBacktestId(job) === selectedBacktest.id) ?? null
      : null
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
    latestStrategyBacktestReview,
    latestStrategyBacktestReviewJob,
    latestStrategyBacktestReviewJobMeta,
    selectedStrategyPrimaryReviews,
    openStrategyProposals,
    gatedPublishProposalCount,
    allStrategyChangeRequests,
    selectedStrategyChangeRequest,
    strategyChangeRequests,
    selectedStrategyReview,
    selectedStrategyParameterSignature,
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
