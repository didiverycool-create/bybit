import type { ReviewDocument, StrategySummary } from '../types'

export function buildStrategyReviewCatalogCollections({
  selectedStrategy,
  reviews,
  selectedStrategyReviewsData,
  selectedBacktestReviewsData,
  replayTrackingReviewsData,
}: {
  selectedStrategy: StrategySummary | null
  reviews: ReviewDocument[]
  selectedStrategyReviewsData?: ReviewDocument[]
  selectedBacktestReviewsData?: ReviewDocument[]
  replayTrackingReviewsData?: ReviewDocument[]
}) {
  const strategyProposals = selectedStrategy
    ? reviews
        .flatMap((review) => review.proposals)
        .filter((proposal) => proposal.strategy_id === selectedStrategy.id)
        .sort(
          (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        )
    : []

  const selectedStrategyReviews = selectedStrategy
    ? (selectedStrategyReviewsData ?? reviews)
        .filter(
          (review) =>
            review.strategy_id === selectedStrategy.id ||
            review.proposals.some((proposal) => proposal.strategy_id === selectedStrategy.id),
        )
        .sort(
          (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        )
    : []

  const reviewCatalog = (() => {
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
  })()

  const proposalCatalog = (() => {
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
  })()

  return {
    strategyProposals,
    selectedStrategyReviews,
    reviewCatalog,
    proposalCatalog,
  }
}
