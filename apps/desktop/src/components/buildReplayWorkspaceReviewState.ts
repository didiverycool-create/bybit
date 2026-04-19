import type {
  AgentJob,
  ReviewDocument,
  StrategySummary,
} from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  getAgentJobStrategyId,
  isStrategyTrackingReview,
} from '../utils/app-helpers'

type BuildReplayWorkspaceReviewStateArgs = {
  reviews: ReviewDocument[]
  replayTrackingReviewsData?: ReviewDocument[]
  selectedStrategy: StrategySummary | null
  selectedStrategyPrimaryReviews: ReviewDocument[]
  selectedStrategyReviews: ReviewDocument[]
  schedulerJobs: AgentJob[]
  replayTrackingScope: 'all' | 'selected'
  replayFocusedReviewId: string | null
}

export type BuildReplayWorkspaceReviewStateResult = {
  replayPrimaryReviews: ReviewDocument[]
  replayTrackingReviews: ReviewDocument[]
  scopedReplayPrimaryReviews: ReviewDocument[]
  filteredReplayTrackingReviews: ReviewDocument[]
  latestReview: ReviewDocument | null
  latestTrackingReview: ReviewDocument | null
  replayTrackingJobs: AgentJob[]
  filteredReplayTrackingJobs: AgentJob[]
  replayVisibleReviews: ReviewDocument[]
  replayFocusReview: ReviewDocument | null
  replayFocusReviewLineageMeta: ReturnType<typeof backtestLineageMeta>
  replayFocusReviewDecisionMeta: ReturnType<typeof backtestDecisionReadinessMeta>
}

export function buildReplayWorkspaceReviewState({
  reviews,
  replayTrackingReviewsData,
  selectedStrategy,
  selectedStrategyPrimaryReviews,
  selectedStrategyReviews,
  schedulerJobs,
  replayTrackingScope,
  replayFocusedReviewId,
}: BuildReplayWorkspaceReviewStateArgs): BuildReplayWorkspaceReviewStateResult {
  const replayPrimaryReviews = reviews.filter((review) => !isStrategyTrackingReview(review.period))
  const replayTrackingReviews =
    replayTrackingReviewsData ?? reviews.filter((review) => isStrategyTrackingReview(review.period))
  const scopedReplayPrimaryReviews =
    replayTrackingScope === 'selected' && selectedStrategy ? selectedStrategyPrimaryReviews : replayPrimaryReviews
  const filteredReplayTrackingReviews =
    replayTrackingScope === 'selected' && selectedStrategy
      ? replayTrackingReviews.filter(
          (review) =>
            review.strategy_id === selectedStrategy.id ||
            review.proposals.some((proposal) => proposal.strategy_id === selectedStrategy.id),
        )
      : replayTrackingReviews
  const latestReview = scopedReplayPrimaryReviews[0] ?? null
  const latestTrackingReview = filteredReplayTrackingReviews[0] ?? null
  const replayTrackingJobs = schedulerJobs.filter(
    (job) => job.job_type === 'review_strategy_issue' || job.job_type === 'review_strategy_change',
  )
  const filteredReplayTrackingJobs =
    replayTrackingScope === 'selected' && selectedStrategy
      ? replayTrackingJobs.filter((job) => getAgentJobStrategyId(job) === selectedStrategy.id)
      : replayTrackingJobs
  const replayVisibleReviews =
    replayTrackingScope === 'selected' && selectedStrategy ? selectedStrategyReviews : reviews
  const replayFocusReview =
    replayVisibleReviews.find((review) => review.id === replayFocusedReviewId) ??
    latestReview ??
    latestTrackingReview ??
    null
  const replayFocusReviewLineageMeta =
    replayFocusReview?.period === 'backtest' ? backtestLineageMeta(replayFocusReview) : null
  const replayFocusReviewDecisionMeta =
    replayFocusReview?.period === 'backtest' &&
    (
      replayFocusReview.decision_readiness ||
      replayFocusReview.decision_readiness_detail ||
      replayFocusReview.decision_readiness_action ||
      replayFocusReview.decision_recommended_data_range ||
      replayFocusReview.decision_recommended_timeframe
    )
      ? backtestDecisionReadinessMeta(replayFocusReview)
      : null

  return {
    replayPrimaryReviews,
    replayTrackingReviews,
    scopedReplayPrimaryReviews,
    filteredReplayTrackingReviews,
    latestReview,
    latestTrackingReview,
    replayTrackingJobs,
    filteredReplayTrackingJobs,
    replayVisibleReviews,
    replayFocusReview,
    replayFocusReviewLineageMeta,
    replayFocusReviewDecisionMeta,
  }
}
