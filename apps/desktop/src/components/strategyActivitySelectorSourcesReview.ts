import type { ReviewDocument, StrategyActivityReviewSummary, StrategyActivitySnapshot } from '../types'
import {
  resolveStrategyActivityDecisionSection,
  resolveStrategyActivitySection,
} from './strategyActivitySelectorStructure'
import { preferStrategyActivitySectionPriority } from './strategyActivitySelectorPriority'
import { preferStrategyActivityValue } from './strategyActivitySelectorValue'

export function resolveStrategyActivityReviewSources(activity?: StrategyActivitySnapshot | null) {
  const reviewSection = resolveStrategyActivitySection(activity, 'review')
  const trackingSection = resolveStrategyActivitySection(activity, 'tracking')
  const reviewDecisionContext = resolveStrategyActivityDecisionSection(activity, 'review')
  return {
    latestPrimaryReview: preferStrategyActivitySectionPriority(
      reviewSection?.latest_primary,
      undefined,
    ),
    latestActionablePrimaryReview: preferStrategyActivitySectionPriority(
      reviewSection?.latest_actionable_primary,
      undefined,
    ),
    latestTrackingReview: preferStrategyActivityValue(
      reviewSection?.latest_tracking,
      trackingSection?.latest_review,
    ),
    latestPrimaryReviewRecord: preferStrategyActivitySectionPriority(
      reviewSection?.latest_primary_record,
      reviewDecisionContext?.latest_primary_record,
    ),
    latestActionablePrimaryReviewRecord: preferStrategyActivitySectionPriority(
      reviewSection?.latest_actionable_primary_record,
      reviewDecisionContext?.latest_actionable_primary_record,
    ),
    latestTrackingReviewRecord: preferStrategyActivityValue(
      reviewSection?.latest_tracking_record,
      trackingSection?.latest_review_record,
    ),
  } satisfies {
    latestPrimaryReview: StrategyActivityReviewSummary | null
    latestActionablePrimaryReview: StrategyActivityReviewSummary | null
    latestTrackingReview: StrategyActivityReviewSummary | null
    latestPrimaryReviewRecord: ReviewDocument | null
    latestActionablePrimaryReviewRecord: ReviewDocument | null
    latestTrackingReviewRecord: ReviewDocument | null
  }
}
