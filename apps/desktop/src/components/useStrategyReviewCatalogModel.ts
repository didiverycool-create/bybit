import { useMemo } from 'react'

import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategySummary,
} from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestSampleQualityMeta,
  backtestWindowMeta,
} from '../utils/app-helpers'
import { buildProposalLinkMaps } from '../utils/proposal-linkage'

type UseStrategyReviewCatalogModelArgs = {
  selectedStrategy: StrategySummary | null
  backtests: BacktestRun[]
  reviews: ReviewDocument[]
  selectedStrategyReviewsData?: ReviewDocument[]
  selectedBacktestReviewsData?: ReviewDocument[]
  replayTrackingReviewsData?: ReviewDocument[]
  changeRequests: ChangeRequest[]
  schedulerJobs: AgentJob[]
}

export function useStrategyReviewCatalogModel({
  selectedStrategy,
  backtests,
  reviews,
  selectedStrategyReviewsData,
  selectedBacktestReviewsData,
  replayTrackingReviewsData,
  changeRequests,
  schedulerJobs,
}: UseStrategyReviewCatalogModelArgs) {
  const backtestReviewJobs = useMemo(
    () =>
      [...schedulerJobs]
        .filter((job) => job.job_type === 'generate_backtest_review')
        .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()),
    [schedulerJobs],
  )

  const strategyBacktests = selectedStrategy
    ? backtests.filter((item) => item.strategy_id === selectedStrategy.id)
    : []
  const latestStrategyBacktest = strategyBacktests[0]
  const latestStrategyBacktestDecisionMeta =
    backtestDecisionReadinessMeta(latestStrategyBacktest)
  const latestStrategyBacktestSampleMeta = backtestSampleQualityMeta(latestStrategyBacktest)
  const latestStrategyBacktestWindowMeta = backtestWindowMeta(latestStrategyBacktest)

  const strategyProposals = useMemo(
    () =>
      selectedStrategy
        ? reviews
            .flatMap((review) => review.proposals)
            .filter((proposal) => proposal.strategy_id === selectedStrategy.id)
            .sort(
              (left, right) =>
                new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
            )
        : [],
    [reviews, selectedStrategy],
  )

  const selectedStrategyReviews = selectedStrategy
    ? (selectedStrategyReviewsData ?? reviews)
        .filter(
          (review) =>
            review.strategy_id === selectedStrategy.id ||
            review.proposals.some((proposal) => proposal.strategy_id === selectedStrategy.id),
        )
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        )
    : []

  const reviewCatalog = useMemo(() => {
    const combined = [
      ...reviews,
      ...(selectedStrategyReviewsData ?? []),
      ...(selectedBacktestReviewsData ?? []),
      ...(replayTrackingReviewsData ?? []),
    ]
    const seen = new Set<string>()
    return combined.filter((review) => {
      if (seen.has(review.id)) {
        return false
      }
      seen.add(review.id)
      return true
    })
  }, [reviews, selectedStrategyReviewsData, selectedBacktestReviewsData, replayTrackingReviewsData])

  const proposalCatalog = useMemo(() => {
    const seen = new Set<string>()
    return reviewCatalog.flatMap((review) =>
      review.proposals.filter((proposal) => {
        if (seen.has(proposal.id)) {
          return false
        }
        seen.add(proposal.id)
        return true
      }),
    )
  }, [reviewCatalog])

  const {
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
  } = useMemo(
    () =>
      buildProposalLinkMaps({
        backtests,
        reviewCatalog,
        changeRequests,
        proposalCatalog,
        schedulerJobs,
        backtestReviewJobs,
      }),
    [backtests, reviewCatalog, changeRequests, proposalCatalog, schedulerJobs, backtestReviewJobs],
  )

  return {
    backtestReviewJobs,
    strategyBacktests,
    latestStrategyBacktest,
    latestStrategyBacktestDecisionMeta,
    latestStrategyBacktestSampleMeta,
    latestStrategyBacktestWindowMeta,
    strategyProposals,
    selectedStrategyReviews,
    reviewCatalog,
    proposalCatalog,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
  }
}
