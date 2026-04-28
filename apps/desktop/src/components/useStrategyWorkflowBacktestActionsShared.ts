import type { ReviewDocument, StrategySummary } from '../types'

export function resolveStrategyName(
  strategies: StrategySummary[],
  strategyId: string,
  fallbackName: string | null | undefined,
) {
  return strategies.find((item) => item.id === strategyId)?.name ?? fallbackName ?? strategyId
}

export function findLatestBacktestReview(reviewCatalog: ReviewDocument[], backtestId: string) {
  return (
    reviewCatalog
      .filter((review) => review.backtest_id === backtestId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null
  )
}

