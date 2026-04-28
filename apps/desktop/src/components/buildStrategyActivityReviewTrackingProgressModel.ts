import {
  backtestDecisionReadinessMeta,
  getAgentJobBacktestId,
  getAgentJobChangeRequestId,
  getAgentJobLinkedReviewId,
  getAgentJobSourceBacktestId,
  getAgentJobSourceChangeRequestId,
  getAgentJobSourceProposalId,
  getAgentJobSourceReviewId,
  getAgentJobStrategyId,
  getReviewFocusStrategyId,
  strategyAgentJobSummary,
} from '../utils/app-helpers'
import type { StrategyActivityProgressLookupContext } from './strategyActivityProgressShared'

export function buildStrategyActivityReviewTrackingProgressModel(
  context: StrategyActivityProgressLookupContext,
) {
  const { activityStrategyId, reviewSources, trackingSources, resolveReviewRecord, resolveJobRecord } = context
  const {
    latestPrimaryReview: latestPrimaryReviewSource,
    latestPrimaryReviewRecord: latestPrimaryReviewRecordSource,
    latestActionablePrimaryReview: latestActionablePrimaryReviewSource,
    latestActionablePrimaryReviewRecord: latestActionablePrimaryReviewRecordSource,
  } = reviewSources
  const {
    latestTrackingReview: latestTrackingReviewSource,
    latestTrackingReviewRecord: latestTrackingReviewRecordSource,
    latestTrackingJob: latestTrackingJobSource,
    latestTrackingJobRecord: latestTrackingJobRecordSource,
    latestRetryableTrackingJob: latestRetryableTrackingJobSource,
    latestRetryableTrackingJobRecord: latestRetryableTrackingJobRecordSource,
  } = trackingSources

  const activityLatestPrimaryReview = latestPrimaryReviewSource
  const activityLatestPrimaryReviewRecord =
    latestPrimaryReviewRecordSource ?? resolveReviewRecord(activityLatestPrimaryReview)
  const activityLatestPrimaryReviewStrategyId = getReviewFocusStrategyId(
    activityLatestPrimaryReviewRecord,
    activityStrategyId,
  )
  const activityLatestActionablePrimaryReview = latestActionablePrimaryReviewSource
  const activityLatestActionablePrimaryReviewRecord =
    latestActionablePrimaryReviewRecordSource ??
    resolveReviewRecord(activityLatestActionablePrimaryReview)
  const activityLatestActionablePrimaryReviewStrategyId = getReviewFocusStrategyId(
    activityLatestActionablePrimaryReviewRecord,
    activityStrategyId,
  )
  const activityLatestActionablePrimaryReviewDecisionMeta =
    (activityLatestActionablePrimaryReviewRecord ?? activityLatestActionablePrimaryReview)?.period === 'backtest'
      ? backtestDecisionReadinessMeta(
          activityLatestActionablePrimaryReviewRecord ?? activityLatestActionablePrimaryReview,
        )
      : null
  const activityLatestActionablePrimaryReviewSummary = activityLatestActionablePrimaryReview
    ? `${activityLatestActionablePrimaryReview.title} · ${activityLatestActionablePrimaryReview.summary}`
    : null
  const activityLatestActionablePrimaryReviewDiffersFromLatest = Boolean(
    activityLatestActionablePrimaryReview && activityLatestActionablePrimaryReview.id !== activityLatestPrimaryReview?.id,
  )

  const activityLatestTrackingReview = latestTrackingReviewSource
  const activityLatestTrackingReviewRecord =
    latestTrackingReviewRecordSource ?? resolveReviewRecord(activityLatestTrackingReview)
  const activityLatestTrackingReviewStrategyId = getReviewFocusStrategyId(
    activityLatestTrackingReviewRecord,
    activityStrategyId,
  )
  const activityLatestTrackingJob = latestTrackingJobSource
  const activityLatestTrackingJobRecord =
    latestTrackingJobRecordSource ?? resolveJobRecord(activityLatestTrackingJob)
  const activityLatestTrackingJobStrategyId =
    (activityLatestTrackingJobRecord
      ? getAgentJobStrategyId(activityLatestTrackingJobRecord)
      : activityLatestTrackingJob
        ? getAgentJobStrategyId(activityLatestTrackingJob)
        : null) ??
    activityStrategyId ??
    null
  const activityLatestTrackingJobLinkedReviewId = activityLatestTrackingJobRecord
    ? getAgentJobLinkedReviewId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobLinkedReviewId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobChangeRequestId = activityLatestTrackingJobRecord
    ? getAgentJobChangeRequestId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobChangeRequestId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobBacktestId = activityLatestTrackingJobRecord
    ? getAgentJobBacktestId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobBacktestId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobSourceChangeRequestId = activityLatestTrackingJobRecord
    ? getAgentJobSourceChangeRequestId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobSourceChangeRequestId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobSourceBacktestId = activityLatestTrackingJobRecord
    ? getAgentJobSourceBacktestId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobSourceBacktestId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobSourceReviewId = activityLatestTrackingJobRecord
    ? getAgentJobSourceReviewId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobSourceReviewId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobSourceProposalId = activityLatestTrackingJobRecord
    ? getAgentJobSourceProposalId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobSourceProposalId(activityLatestTrackingJob)
      : null
  const activityLatestRetryableTrackingJob = latestRetryableTrackingJobSource
  const activityLatestRetryableTrackingJobRecord =
    latestRetryableTrackingJobRecordSource ??
    resolveJobRecord(activityLatestRetryableTrackingJob)
  const activityLatestRetryableTrackingJobSummary = activityLatestRetryableTrackingJob
    ? strategyAgentJobSummary(activityLatestRetryableTrackingJobRecord ?? activityLatestRetryableTrackingJob)
    : null
  const activityLatestRetryableTrackingJobDiffersFromLatest = Boolean(
    activityLatestRetryableTrackingJob && activityLatestRetryableTrackingJob.id !== activityLatestTrackingJob?.id,
  )

  return {
    activityLatestPrimaryReview,
    activityLatestPrimaryReviewRecord,
    activityLatestPrimaryReviewStrategyId,
    activityLatestActionablePrimaryReview,
    activityLatestActionablePrimaryReviewRecord,
    activityLatestActionablePrimaryReviewStrategyId,
    activityLatestActionablePrimaryReviewDecisionMeta,
    activityLatestActionablePrimaryReviewSummary,
    activityLatestActionablePrimaryReviewDiffersFromLatest,
    activityLatestTrackingReview,
    activityLatestTrackingReviewRecord,
    activityLatestTrackingReviewStrategyId,
    activityLatestTrackingJob,
    activityLatestTrackingJobRecord,
    activityLatestTrackingJobStrategyId,
    activityLatestTrackingJobLinkedReviewId,
    activityLatestTrackingJobChangeRequestId,
    activityLatestTrackingJobBacktestId,
    activityLatestTrackingJobSourceChangeRequestId,
    activityLatestTrackingJobSourceBacktestId,
    activityLatestTrackingJobSourceReviewId,
    activityLatestTrackingJobSourceProposalId,
    activityLatestRetryableTrackingJob,
    activityLatestRetryableTrackingJobRecord,
    activityLatestRetryableTrackingJobSummary,
    activityLatestRetryableTrackingJobDiffersFromLatest,
  }
}
