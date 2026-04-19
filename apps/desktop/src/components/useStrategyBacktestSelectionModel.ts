import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
  StrategySummary,
} from '../types'
import { useStrategyBacktestSelectionCurrentBacktestState } from './useStrategyBacktestSelectionCurrentBacktestState'
import { useStrategyBacktestSelectionStrategyState } from './useStrategyBacktestSelectionStrategyState'

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
  const strategySelectionState = useStrategyBacktestSelectionStrategyState({
    latestStrategyBacktest,
    selectedStrategy,
    selectedChangeRequestId,
    selectedStrategyReviews,
    reviewCatalog,
    backtestReviewJobs,
    strategyProposals,
    changeRequests,
  })
  const currentBacktestState = useStrategyBacktestSelectionCurrentBacktestState({
    selectedStrategy,
    selectedBacktestId,
    selectedBacktestReviewsData,
    reviewCatalog,
    backtests,
    backtestFilter,
    backtestReviewJobs,
  })

  return {
    ...strategySelectionState,
    ...currentBacktestState,
  }
}
