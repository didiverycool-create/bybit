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
  backtestReviewJobMeta,
  getAgentJobBacktestId,
  isStrategyTrackingReview,
} from '../utils/app-helpers'

type UseStrategyBacktestSelectionStrategyStateArgs = {
  latestStrategyBacktest: BacktestRun | null
  selectedStrategy: StrategySummary | null
  selectedChangeRequestId: string | null
  selectedStrategyReviews: ReviewDocument[]
  reviewCatalog: ReviewDocument[]
  backtestReviewJobs: AgentJob[]
  strategyProposals: StrategyProposal[]
  changeRequests: ChangeRequest[]
}

export function useStrategyBacktestSelectionStrategyState({
  latestStrategyBacktest,
  selectedStrategy,
  selectedChangeRequestId,
  selectedStrategyReviews,
  reviewCatalog,
  backtestReviewJobs,
  strategyProposals,
  changeRequests,
}: UseStrategyBacktestSelectionStrategyStateArgs) {
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
  }
}
