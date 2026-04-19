import type {
  AgentJob,
  ReviewDocument,
  StrategyActivityReviewSummary,
  StrategyActivitySnapshot,
  StrategyActivityJobSummary,
} from '../types'
import {
  resolveStrategyActivityDecisionSection,
  resolveStrategyActivitySection,
} from './strategyActivitySelectorStructure'
import { preferStrategyActivitySectionPriority } from './strategyActivitySelectorPriority'

export function resolveStrategyActivityTrackingSources(activity?: StrategyActivitySnapshot | null) {
  const trackingSection = resolveStrategyActivitySection(activity, 'tracking')
  const trackingDecisionContext = resolveStrategyActivityDecisionSection(activity, 'tracking')
  return {
    latestTrackingReview: preferStrategyActivitySectionPriority(
      trackingSection?.latest_review,
      undefined,
    ),
    latestTrackingJob: preferStrategyActivitySectionPriority(
      trackingSection?.latest_job,
      undefined,
    ),
    latestRetryableTrackingJob: preferStrategyActivitySectionPriority(
      trackingSection?.latest_retryable_job,
      undefined,
    ),
    latestTrackingReviewRecord: preferStrategyActivitySectionPriority(
      trackingSection?.latest_review_record,
      trackingDecisionContext?.latest_review_record,
    ),
    latestTrackingJobRecord: preferStrategyActivitySectionPriority(
      trackingSection?.latest_job_record,
      trackingDecisionContext?.latest_job_record,
    ),
    latestRetryableTrackingJobRecord: preferStrategyActivitySectionPriority(
      trackingSection?.latest_retryable_job_record,
      trackingDecisionContext?.latest_retryable_job_record,
    ),
  } satisfies {
    latestTrackingReview: StrategyActivityReviewSummary | null
    latestTrackingJob: StrategyActivityJobSummary | null
    latestRetryableTrackingJob: StrategyActivityJobSummary | null
    latestTrackingReviewRecord: ReviewDocument | null
    latestTrackingJobRecord: AgentJob | null
    latestRetryableTrackingJobRecord: AgentJob | null
  }
}
