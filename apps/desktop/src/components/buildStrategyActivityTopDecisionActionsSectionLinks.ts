import { getChangeRequestStrategyId } from '../utils/app-helpers'

import type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection.types'

export type StrategyActivityTopDecisionActionsSectionLinkState = {
  latestPrimaryReviewOpenId: string | null
  latestTrackingReviewOpenId: string | null
  latestTrackingJobOpenId: string | null
  latestBacktestReviewOpenId: string | null
  latestBacktestJobOpenId: string | null
  latestActionableBacktestJobOpenId: string | null
  latestActionablePrimaryReviewOpenId: string | null
  latestPrimaryReviewSourceJobId: string | null
  latestPrimaryReviewSourceChangeRequestId: string | null
  latestPrimaryReviewSourceBacktestId: string | null
  latestPrimaryReviewSourceReviewId: string | null
  latestPrimaryReviewSourceProposalId: string | null
  latestTrackingReviewSourceJobId: string | null
  latestTrackingReviewSourceChangeRequestId: string | null
  latestTrackingReviewSourceBacktestId: string | null
  latestTrackingReviewSourceReviewId: string | null
  latestTrackingReviewSourceProposalId: string | null
  latestProposalChangeRequestStrategyId: string | null
  latestProposalReviewStrategyId: string | null
  latestProposalJobId: string | null
  latestChangeRequestJobId: string | null
  actionableChangeRequestRetryJobId: string | null
  actionableChangeRequestCanRetry: boolean
  retryableTrackingJobOpenId: string | null
}

export function buildStrategyActivityTopDecisionActionsSectionLinkState({
  strategyId,
  activityLatestProposal,
  activityLatestChangeRequest,
  activityLatestPrimaryReview,
  activityLatestPrimaryReviewRecord,
  activityLatestTrackingReview,
  activityLatestTrackingReviewRecord,
  activityLatestTrackingJob,
  activityLatestTrackingJobRecord,
  activityLatestBacktestReview,
  activityLatestBacktestReviewRecord,
  activityLatestBacktestJob,
  activityLatestBacktestJobRecord,
  activityLatestActionableBacktestJob,
  activityLatestActionableBacktestJobRecord,
  activityLatestActionablePrimaryReview,
  activityLatestActionablePrimaryReviewRecord,
  activityLatestProposalLinkedChangeRequest,
  activityLatestProposalLinkedReview,
  activityLatestProposalLinkedJob,
  activityLatestChangeRequestLinkedJob,
  activityLatestActionableChangeRequest,
  activityLatestActionableChangeRequestLinkedJobId,
  activityLatestRetryableTrackingJob,
  activityLatestRetryableTrackingJobRecord,
}: StrategyActivityTopDecisionActionsSectionProps): StrategyActivityTopDecisionActionsSectionLinkState {
  const latestPrimaryReviewOpenId = activityLatestPrimaryReviewRecord?.id ?? activityLatestPrimaryReview?.id ?? null
  const latestTrackingReviewOpenId =
    activityLatestTrackingReviewRecord?.id ?? activityLatestTrackingReview?.id ?? null
  const latestTrackingJobOpenId = activityLatestTrackingJobRecord?.id ?? activityLatestTrackingJob?.id ?? null
  const latestBacktestReviewOpenId = activityLatestBacktestReviewRecord?.id ?? activityLatestBacktestReview?.id ?? null
  const latestBacktestJobOpenId = activityLatestBacktestJobRecord?.id ?? activityLatestBacktestJob?.id ?? null
  const latestActionableBacktestJobOpenId =
    activityLatestActionableBacktestJobRecord?.id ?? activityLatestActionableBacktestJob?.id ?? null
  const latestActionablePrimaryReviewOpenId =
    activityLatestActionablePrimaryReviewRecord?.id ?? activityLatestActionablePrimaryReview?.id ?? null
  const latestPrimaryReviewSourceJobId = activityLatestPrimaryReview?.source_job_id ?? null
  const latestPrimaryReviewSourceChangeRequestId =
    activityLatestPrimaryReview?.source_change_request_id ?? null
  const latestPrimaryReviewSourceBacktestId = activityLatestPrimaryReview?.source_backtest_id ?? null
  const latestPrimaryReviewSourceReviewId = activityLatestPrimaryReview?.source_review_id ?? null
  const latestPrimaryReviewSourceProposalId = activityLatestPrimaryReview?.source_proposal_id ?? null
  const latestTrackingReviewSourceJobId = activityLatestTrackingReview?.source_job_id ?? null
  const latestTrackingReviewSourceChangeRequestId =
    activityLatestTrackingReview?.source_change_request_id ?? null
  const latestTrackingReviewSourceBacktestId = activityLatestTrackingReview?.source_backtest_id ?? null
  const latestTrackingReviewSourceReviewId = activityLatestTrackingReview?.source_review_id ?? null
  const latestTrackingReviewSourceProposalId = activityLatestTrackingReview?.source_proposal_id ?? null
  const latestProposalChangeRequestStrategyId = activityLatestProposalLinkedChangeRequest
    ? getChangeRequestStrategyId(activityLatestProposalLinkedChangeRequest, activityLatestProposal?.strategy_id ?? strategyId)
    : null
  const latestProposalReviewStrategyId =
    activityLatestProposal?.strategy_id ?? activityLatestProposalLinkedReview?.strategy_id ?? strategyId
  const latestProposalJobId =
    activityLatestProposalLinkedChangeRequest?.follow_up_job_id ?? activityLatestProposalLinkedJob?.id ?? null
  const latestChangeRequestJobId =
    activityLatestChangeRequest?.follow_up_job_id ?? activityLatestChangeRequestLinkedJob?.id ?? null
  const actionableChangeRequestRetryJobId =
    activityLatestActionableChangeRequest?.follow_up_job_id ?? activityLatestActionableChangeRequestLinkedJobId ?? null
  const actionableChangeRequestCanRetry = Boolean(
    activityLatestActionableChangeRequest &&
      actionableChangeRequestRetryJobId &&
      (activityLatestActionableChangeRequest.follow_up_job_status === 'failed' ||
        activityLatestActionableChangeRequest.follow_up_job_status === 'cancelled'),
  )
  const retryableTrackingJobOpenId =
    activityLatestRetryableTrackingJobRecord?.id ?? activityLatestRetryableTrackingJob?.id ?? null

  return {
    latestPrimaryReviewOpenId,
    latestTrackingReviewOpenId,
    latestTrackingJobOpenId,
    latestBacktestReviewOpenId,
    latestBacktestJobOpenId,
    latestActionableBacktestJobOpenId,
    latestActionablePrimaryReviewOpenId,
    latestPrimaryReviewSourceJobId,
    latestPrimaryReviewSourceChangeRequestId,
    latestPrimaryReviewSourceBacktestId,
    latestPrimaryReviewSourceReviewId,
    latestPrimaryReviewSourceProposalId,
    latestTrackingReviewSourceJobId,
    latestTrackingReviewSourceChangeRequestId,
    latestTrackingReviewSourceBacktestId,
    latestTrackingReviewSourceReviewId,
    latestTrackingReviewSourceProposalId,
    latestProposalChangeRequestStrategyId,
    latestProposalReviewStrategyId,
    latestProposalJobId,
    latestChangeRequestJobId,
    actionableChangeRequestRetryJobId,
    actionableChangeRequestCanRetry,
    retryableTrackingJobOpenId,
  }
}
