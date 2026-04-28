import type { ReviewDocument } from '../types'

export type ReplayProposalFeedItem = {
  reviewId: string
  reviewTitle: string
  reviewPeriod: string
  proposal: ReviewDocument['proposals'][number]
}

export function buildReplayWorkspaceProposalFeed(
  scopedReplayPrimaryReviews: ReviewDocument[],
): ReplayProposalFeedItem[] {
  return scopedReplayPrimaryReviews.flatMap((review) =>
    review.proposals.map((proposal) => ({
      reviewId: review.id,
      reviewTitle: review.title,
      reviewPeriod: review.period,
      proposal,
    })),
  )
}
