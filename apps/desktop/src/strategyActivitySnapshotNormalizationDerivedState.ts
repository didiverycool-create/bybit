import { buildStrategyActivityLatestOpsSnapshot } from './strategyActivityLatestOpsSnapshot'
import { normalizeReviewDocument } from './strategyActivitySnapshotNormalizationDecision'
import type {
  StrategyActivitySnapshot,
  StrategyActivitySnapshotBacktestReviewFlatFields,
  StrategyActivitySnapshotChangeRequestFlatFields,
  StrategyActivitySnapshotLineageFields,
  StrategyActivitySnapshotProposalFlatFields,
} from './types'

export type StrategyActivityDerivedStateSections = NonNullable<StrategyActivitySnapshot['activity_sections']>
export type StrategyActivityDerivedStateDecisionContext = NonNullable<StrategyActivitySnapshot['decision_context']>
export type StrategyActivityNormalizedLatestOpsState = Pick<
  StrategyActivitySnapshot,
  'latest_runtime' | 'latest_ops'
>
export type StrategyActivityDerivedLineageFields = Partial<StrategyActivitySnapshotLineageFields>
export type StrategyActivityDerivedState = StrategyActivityDerivedLineageFields &
  StrategyActivityNormalizedLatestOpsState

type ProposalSection = StrategyActivityDerivedStateSections['proposal']
type ProposalDecisionContext = StrategyActivityDerivedStateDecisionContext['proposal']
type ChangeRequestSection = StrategyActivityDerivedStateSections['change_request']
type ChangeRequestDecisionContext = StrategyActivityDerivedStateDecisionContext['change_request']
type BacktestSection = StrategyActivityDerivedStateSections['backtest']
type BacktestDecisionContext = StrategyActivityDerivedStateDecisionContext['backtest']
type ReviewSection = StrategyActivityDerivedStateSections['review']
type ReviewDecisionContext = StrategyActivityDerivedStateDecisionContext['review']
type TrackingSection = StrategyActivityDerivedStateSections['tracking']
type TrackingDecisionContext = StrategyActivityDerivedStateDecisionContext['tracking']

function coalesceStrategyActivityField<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value
    }
  }
  return null
}

function normalizeStrategyActivityLatestOpsState(
  activity: StrategyActivitySnapshot,
): StrategyActivityNormalizedLatestOpsState {
  const latestOps = buildStrategyActivityLatestOpsSnapshot(
    activity.latest_ops ?? activity.latest_runtime?.latest_ops ?? null,
  )
  const latestRuntime =
    activity.latest_runtime ??
    (activity.runtime || latestOps
      ? {
          runtime: activity.runtime ?? null,
          latest_ops: latestOps,
        }
      : null)

  return {
    latest_runtime: latestRuntime,
    latest_ops: latestOps,
  }
}

function hydrateStrategyActivityProposalFlatFields(
  activity: StrategyActivitySnapshot,
  proposalSection: ProposalSection,
  proposalDecisionContext: ProposalDecisionContext,
): Partial<StrategyActivitySnapshotProposalFlatFields> {
  return {
    latest_proposal: coalesceStrategyActivityField(activity.latest_proposal, proposalSection?.latest),
    latest_actionable_proposal: coalesceStrategyActivityField(
      activity.latest_actionable_proposal,
      proposalSection?.latest_actionable,
    ),
    latest_proposal_change_request: coalesceStrategyActivityField(
      activity.latest_proposal_change_request,
      proposalSection?.latest_change_request,
    ),
    latest_proposal_backtest: coalesceStrategyActivityField(
      activity.latest_proposal_backtest,
      proposalSection?.latest_backtest,
    ),
    latest_proposal_review: coalesceStrategyActivityField(
      activity.latest_proposal_review,
      proposalSection?.latest_review,
    ),
    latest_proposal_job: coalesceStrategyActivityField(
      activity.latest_proposal_job,
      proposalSection?.latest_job,
    ),
    latest_proposal_backtest_record: coalesceStrategyActivityField(
      activity.latest_proposal_backtest_record,
      proposalSection?.latest_backtest_record,
      proposalDecisionContext?.latest_backtest_record,
    ),
    latest_proposal_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_proposal_review_record),
      proposalSection?.latest_review_record,
      proposalDecisionContext?.latest_review_record,
    ),
    latest_proposal_job_record: coalesceStrategyActivityField(
      activity.latest_proposal_job_record,
      proposalSection?.latest_job_record,
      proposalDecisionContext?.latest_job_record,
    ),
    latest_actionable_proposal_change_request: coalesceStrategyActivityField(
      activity.latest_actionable_proposal_change_request,
      proposalSection?.latest_actionable_change_request,
    ),
    latest_actionable_proposal_backtest: coalesceStrategyActivityField(
      activity.latest_actionable_proposal_backtest,
      proposalSection?.latest_actionable_backtest,
    ),
    latest_actionable_proposal_review: coalesceStrategyActivityField(
      activity.latest_actionable_proposal_review,
      proposalSection?.latest_actionable_review,
    ),
    latest_actionable_proposal_job: coalesceStrategyActivityField(
      activity.latest_actionable_proposal_job,
      proposalSection?.latest_actionable_job,
    ),
    latest_actionable_proposal_backtest_record: coalesceStrategyActivityField(
      activity.latest_actionable_proposal_backtest_record,
      proposalSection?.latest_actionable_backtest_record,
      proposalDecisionContext?.actionable_backtest_record,
    ),
    latest_actionable_proposal_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_actionable_proposal_review_record),
      proposalSection?.latest_actionable_review_record,
      proposalDecisionContext?.actionable_review_record,
    ),
    latest_actionable_proposal_job_record: coalesceStrategyActivityField(
      activity.latest_actionable_proposal_job_record,
      proposalSection?.latest_actionable_job_record,
      proposalDecisionContext?.actionable_job_record,
    ),
  }
}

function hydrateStrategyActivityChangeRequestFlatFields(
  activity: StrategyActivitySnapshot,
  changeRequestSection: ChangeRequestSection,
  changeRequestDecisionContext: ChangeRequestDecisionContext,
): Partial<StrategyActivitySnapshotChangeRequestFlatFields> {
  return {
    latest_change_request: coalesceStrategyActivityField(
      activity.latest_change_request,
      changeRequestSection?.latest,
    ),
    latest_actionable_change_request: coalesceStrategyActivityField(
      activity.latest_actionable_change_request,
      changeRequestSection?.latest_actionable,
    ),
    latest_change_request_backtest_record: coalesceStrategyActivityField(
      activity.latest_change_request_backtest_record,
      changeRequestSection?.latest_backtest_record,
      changeRequestDecisionContext?.latest_backtest_record,
    ),
    latest_change_request_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_change_request_review_record),
      changeRequestSection?.latest_review_record,
      changeRequestDecisionContext?.latest_review_record,
    ),
    latest_change_request_job_record: coalesceStrategyActivityField(
      activity.latest_change_request_job_record,
      changeRequestSection?.latest_job_record,
      changeRequestDecisionContext?.latest_job_record,
    ),
    latest_change_request_source_backtest_record: coalesceStrategyActivityField(
      activity.latest_change_request_source_backtest_record,
      changeRequestSection?.latest_source_backtest_record,
      changeRequestDecisionContext?.latest_source_backtest_record,
    ),
    latest_change_request_source_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_change_request_source_review_record),
      changeRequestSection?.latest_source_review_record,
      changeRequestDecisionContext?.latest_source_review_record,
    ),
    latest_change_request_source_proposal_record: coalesceStrategyActivityField(
      activity.latest_change_request_source_proposal_record,
      changeRequestSection?.latest_source_proposal_record,
      changeRequestDecisionContext?.latest_source_proposal_record,
    ),
    latest_actionable_change_request_backtest_record: coalesceStrategyActivityField(
      activity.latest_actionable_change_request_backtest_record,
      changeRequestSection?.latest_actionable_backtest_record,
      changeRequestDecisionContext?.actionable_backtest_record,
    ),
    latest_actionable_change_request_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_actionable_change_request_review_record),
      changeRequestSection?.latest_actionable_review_record,
      changeRequestDecisionContext?.actionable_review_record,
    ),
    latest_actionable_change_request_job_record: coalesceStrategyActivityField(
      activity.latest_actionable_change_request_job_record,
      changeRequestSection?.latest_actionable_job_record,
      changeRequestDecisionContext?.actionable_job_record,
    ),
    latest_actionable_change_request_source_backtest_record: coalesceStrategyActivityField(
      activity.latest_actionable_change_request_source_backtest_record,
      changeRequestSection?.latest_actionable_source_backtest_record,
      changeRequestDecisionContext?.actionable_source_backtest_record,
    ),
    latest_actionable_change_request_source_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_actionable_change_request_source_review_record),
      changeRequestSection?.latest_actionable_source_review_record,
      changeRequestDecisionContext?.actionable_source_review_record,
    ),
    latest_actionable_change_request_source_proposal_record: coalesceStrategyActivityField(
      activity.latest_actionable_change_request_source_proposal_record,
      changeRequestSection?.latest_actionable_source_proposal_record,
      changeRequestDecisionContext?.actionable_source_proposal_record,
    ),
  }
}

function hydrateStrategyActivityBacktestReviewFlatFields(
  activity: StrategyActivitySnapshot,
  backtestSection: BacktestSection,
  backtestDecisionContext: BacktestDecisionContext,
  reviewSection: ReviewSection,
  reviewDecisionContext: ReviewDecisionContext,
  trackingSection: TrackingSection,
  trackingDecisionContext: TrackingDecisionContext,
): Partial<StrategyActivitySnapshotBacktestReviewFlatFields> {
  return {
    latest_backtest: coalesceStrategyActivityField(activity.latest_backtest, backtestSection?.latest),
    latest_actionable_backtest: coalesceStrategyActivityField(
      activity.latest_actionable_backtest,
      backtestSection?.latest_actionable,
    ),
    latest_backtest_record: coalesceStrategyActivityField(
      activity.latest_backtest_record,
      backtestSection?.latest_record,
      backtestDecisionContext?.latest_record,
    ),
    latest_actionable_backtest_record: coalesceStrategyActivityField(
      activity.latest_actionable_backtest_record,
      backtestSection?.latest_actionable_record,
      backtestDecisionContext?.actionable_record,
    ),
    latest_backtest_review: coalesceStrategyActivityField(
      activity.latest_backtest_review,
      backtestSection?.latest_review,
    ),
    latest_backtest_job: coalesceStrategyActivityField(
      activity.latest_backtest_job,
      backtestSection?.latest_job,
    ),
    latest_actionable_backtest_review: coalesceStrategyActivityField(
      activity.latest_actionable_backtest_review,
      backtestSection?.latest_actionable_review,
    ),
    latest_actionable_backtest_job: coalesceStrategyActivityField(
      activity.latest_actionable_backtest_job,
      backtestSection?.latest_actionable_job,
    ),
    latest_backtest_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_backtest_review_record),
      backtestSection?.latest_review_record,
      backtestDecisionContext?.latest_review_record,
    ),
    latest_backtest_job_record: coalesceStrategyActivityField(
      activity.latest_backtest_job_record,
      backtestSection?.latest_job_record,
      backtestDecisionContext?.latest_job_record,
    ),
    latest_actionable_backtest_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_actionable_backtest_review_record),
      backtestSection?.latest_actionable_review_record,
      backtestDecisionContext?.actionable_review_record,
    ),
    latest_actionable_backtest_job_record: coalesceStrategyActivityField(
      activity.latest_actionable_backtest_job_record,
      backtestSection?.latest_actionable_job_record,
      backtestDecisionContext?.actionable_job_record,
    ),
    latest_primary_review: coalesceStrategyActivityField(
      activity.latest_primary_review,
      reviewSection?.latest_primary,
    ),
    latest_actionable_primary_review: coalesceStrategyActivityField(
      activity.latest_actionable_primary_review,
      reviewSection?.latest_actionable_primary,
    ),
    latest_primary_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_primary_review_record),
      reviewSection?.latest_primary_record,
      reviewDecisionContext?.latest_primary_record,
    ),
    latest_actionable_primary_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_actionable_primary_review_record),
      reviewSection?.latest_actionable_primary_record,
      reviewDecisionContext?.latest_actionable_primary_record,
    ),
    latest_tracking_review: coalesceStrategyActivityField(
      activity.latest_tracking_review,
      reviewSection?.latest_tracking,
      trackingSection?.latest_review,
    ),
    latest_tracking_job: coalesceStrategyActivityField(
      activity.latest_tracking_job,
      trackingSection?.latest_job,
    ),
    latest_tracking_review_record: coalesceStrategyActivityField(
      normalizeReviewDocument(activity.latest_tracking_review_record),
      reviewSection?.latest_tracking_record,
      trackingSection?.latest_review_record,
      trackingDecisionContext?.latest_review_record,
    ),
    latest_tracking_job_record: coalesceStrategyActivityField(
      activity.latest_tracking_job_record,
      trackingSection?.latest_job_record,
      trackingDecisionContext?.latest_job_record,
    ),
    latest_retryable_tracking_job: coalesceStrategyActivityField(
      activity.latest_retryable_tracking_job,
      trackingSection?.latest_retryable_job,
    ),
    latest_retryable_tracking_job_record: coalesceStrategyActivityField(
      activity.latest_retryable_tracking_job_record,
      trackingSection?.latest_retryable_job_record,
      trackingDecisionContext?.latest_retryable_job_record,
    ),
  }
}

export function deriveStrategyActivityState(
  activity: StrategyActivitySnapshot,
  decisionContext: StrategyActivitySnapshot['decision_context'],
  activitySections: StrategyActivitySnapshot['activity_sections'],
): StrategyActivityDerivedState {
  return {
    ...hydrateStrategyActivityProposalFlatFields(
      activity,
      activitySections?.proposal ?? null,
      decisionContext?.proposal ?? null,
    ),
    ...hydrateStrategyActivityChangeRequestFlatFields(
      activity,
      activitySections?.change_request ?? null,
      decisionContext?.change_request ?? null,
    ),
    ...hydrateStrategyActivityBacktestReviewFlatFields(
      activity,
      activitySections?.backtest ?? null,
      decisionContext?.backtest ?? null,
      activitySections?.review ?? null,
      decisionContext?.review ?? null,
      activitySections?.tracking ?? null,
      decisionContext?.tracking ?? null,
    ),
    ...normalizeStrategyActivityLatestOpsState(activity),
  }
}
