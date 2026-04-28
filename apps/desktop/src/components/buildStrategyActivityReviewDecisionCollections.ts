import type { ReviewDocument } from '../types'
import { isStrategyTrackingReview, prependUniqueActivityItem } from '../utils/app-helpers'
import type {
  StrategyActivityDecisionContext,
  UseStrategyActivityDecisionModelArgs,
} from './strategyActivityDecisionShared'

type ReviewDecisionCollectionArgs = Pick<UseStrategyActivityDecisionModelArgs, 'selectedStrategy'>

export function buildStrategyActivityReviewDecisionCollections(
  { selectedStrategy }: ReviewDecisionCollectionArgs,
  context: StrategyActivityDecisionContext,
) {
  const {
    focusedReplayReview,
    activityStrategyId,
    latestTrackingReviewSource,
    latestPrimaryReviewSource,
    latestActionableBacktestReviewSource,
    latestActionablePrimaryReviewSource,
    latestBacktestReviewRecordSource,
    latestActionableBacktestReviewRecordSource,
    latestPrimaryReviewRecordSource,
    latestActionablePrimaryReviewRecordSource,
    latestTrackingReviewRecordSource,
    recentReviews,
    isReviewFocusedOnActivityStrategy,
  } = context

  const strategyActivityTrackingReviews = (() => {
    let activityReviews = recentReviews.filter((review) => isStrategyTrackingReview(review.period))
    if (
      latestTrackingReviewSource &&
      activityStrategyId &&
      isStrategyTrackingReview(latestTrackingReviewSource.period) &&
      isReviewFocusedOnActivityStrategy(latestTrackingReviewSource, activityStrategyId)
    ) {
      activityReviews = prependUniqueActivityItem(activityReviews, latestTrackingReviewSource, (review) => review.id, 8)
    }
    if (
      !focusedReplayReview ||
      !activityStrategyId ||
      !isStrategyTrackingReview(focusedReplayReview.period) ||
      !isReviewFocusedOnActivityStrategy(focusedReplayReview, selectedStrategy?.id ?? null)
    ) {
      return activityReviews
    }
    return prependUniqueActivityItem(activityReviews, focusedReplayReview, (review) => review.id, 8)
  })()

  const strategyActivityPrimaryReviews = (() => {
    let activityReviews = recentReviews.filter((review) => !isStrategyTrackingReview(review.period))
    if (
      latestPrimaryReviewSource &&
      activityStrategyId &&
      !isStrategyTrackingReview(latestPrimaryReviewSource.period) &&
      isReviewFocusedOnActivityStrategy(latestPrimaryReviewSource, activityStrategyId)
    ) {
      activityReviews = prependUniqueActivityItem(activityReviews, latestPrimaryReviewSource, (review) => review.id, 8)
    }
    if (
      latestActionableBacktestReviewSource &&
      activityStrategyId &&
      !isStrategyTrackingReview(latestActionableBacktestReviewSource.period) &&
      isReviewFocusedOnActivityStrategy(latestActionableBacktestReviewSource, activityStrategyId)
    ) {
      activityReviews = prependUniqueActivityItem(
        activityReviews,
        latestActionableBacktestReviewSource,
        (review) => review.id,
        8,
      )
    }
    if (
      latestActionablePrimaryReviewSource &&
      activityStrategyId &&
      !isStrategyTrackingReview(latestActionablePrimaryReviewSource.period) &&
      isReviewFocusedOnActivityStrategy(latestActionablePrimaryReviewSource, activityStrategyId)
    ) {
      activityReviews = prependUniqueActivityItem(
        activityReviews,
        latestActionablePrimaryReviewSource,
        (review) => review.id,
        8,
      )
    }
    if (
      !focusedReplayReview ||
      !activityStrategyId ||
      isStrategyTrackingReview(focusedReplayReview.period) ||
      !isReviewFocusedOnActivityStrategy(focusedReplayReview, selectedStrategy?.id ?? null)
    ) {
      return activityReviews
    }
    return prependUniqueActivityItem(activityReviews, focusedReplayReview, (review) => review.id, 8)
  })()

  const strategyActivityReviewRecords = (() => {
    const activityRecords = [
      latestBacktestReviewRecordSource,
      latestActionableBacktestReviewRecordSource,
      latestPrimaryReviewRecordSource,
      latestActionablePrimaryReviewRecordSource,
      latestTrackingReviewRecordSource,
    ].filter((review): review is ReviewDocument => Boolean(review))
    if (
      !focusedReplayReview ||
      !isReviewFocusedOnActivityStrategy(focusedReplayReview, selectedStrategy?.id ?? null)
    ) {
      return activityRecords
    }
    return prependUniqueActivityItem(activityRecords, focusedReplayReview, (review) => review.id, 12)
  })()

  return {
    strategyActivityTrackingReviews,
    strategyActivityPrimaryReviews,
    strategyActivityReviewRecords,
  }
}
