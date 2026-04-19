import { useMemo } from 'react'

import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategySummary,
} from '../types'
import { buildStrategyReviewCatalogBacktestState } from './buildStrategyReviewCatalogBacktestState'
import { buildStrategyReviewCatalogCollections } from './buildStrategyReviewCatalogCollections'
import { buildStrategyReviewCatalogProposalLinkMaps } from './buildStrategyReviewCatalogProposalLinkMaps'

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
  const {
    backtestReviewJobs,
    strategyBacktests,
    latestStrategyBacktest,
    latestStrategyBacktestDecisionMeta,
    latestStrategyBacktestSampleMeta,
    latestStrategyBacktestWindowMeta,
  } = useMemo(
    () => {
      const strategyReviewBacktestStateSource = {
        selectedStrategy,
        backtests,
        schedulerJobs,
      }
      return buildStrategyReviewCatalogBacktestState(
        strategyReviewBacktestStateSource,
      )
    },
    [backtests, schedulerJobs, selectedStrategy],
  )

  const {
    strategyProposals,
    selectedStrategyReviews,
    reviewCatalog,
    proposalCatalog,
  } = useMemo(
    () => {
      const strategyReviewCollectionsSource = {
        selectedStrategy,
        reviews,
        selectedStrategyReviewsData,
        selectedBacktestReviewsData,
        replayTrackingReviewsData,
      }
      return buildStrategyReviewCatalogCollections(strategyReviewCollectionsSource)
    },
    [reviews, replayTrackingReviewsData, selectedBacktestReviewsData, selectedStrategy, selectedStrategyReviewsData],
  )

  const {
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
  } = useMemo(
    () => {
      const strategyReviewProposalLinkSource = {
        backtests,
        reviewCatalog,
        changeRequests,
        proposalCatalog,
        schedulerJobs,
        backtestReviewJobs,
      }
      return buildStrategyReviewCatalogProposalLinkMaps(
        strategyReviewProposalLinkSource,
      )
    },
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
