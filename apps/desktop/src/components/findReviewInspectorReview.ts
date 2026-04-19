import type { ReviewDocument } from '../types'

type FindReviewInspectorReviewArgs = {
  reviewCatalog: ReviewDocument[]
  strategyActivityReviewRecords: ReviewDocument[]
  reviewInspectorReviewId: string | null
}

export function findReviewInspectorReview({
  reviewCatalog,
  strategyActivityReviewRecords,
  reviewInspectorReviewId,
}: FindReviewInspectorReviewArgs): ReviewDocument | null {
  return (
    reviewCatalog.find((item) => item.id === reviewInspectorReviewId) ??
    strategyActivityReviewRecords.find((item) => item.id === reviewInspectorReviewId) ??
    null
  )
}
