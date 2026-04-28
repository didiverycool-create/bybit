import type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection.types'
import type { StrategyActivityTopDecisionActionsSectionLinkState } from './buildStrategyActivityTopDecisionActionsSectionLinks'

export type StrategyActivityTopDecisionActionsSectionVisibilityState = {
  showLatestFocusActions: boolean
  showLineageActions: boolean
  showProposalChangeActions: boolean
  showActionableActions: boolean
}

export function buildStrategyActivityTopDecisionActionsSectionVisibilityState(
  {
    activityLatestProposal,
    activityLatestChangeRequest,
    activityLatestChangeRequestStrategyId,
    activityLatestBacktest,
    activityLatestPrimaryReviewStrategyId,
    activityLatestTrackingReviewStrategyId,
    activityLatestBacktestStrategyId,
    activityLatestBacktestReview,
    activityLatestActionableBacktestRecord,
    activityLatestActionableBacktestHasRecommendation,
    activityLatestActionableBacktestJobCanRetry,
    activityLatestBacktestSourceChangeRequestId,
    activityLatestBacktestSourceBacktestId,
    activityLatestBacktestSourceReviewId,
    activityLatestBacktestSourceProposalId,
    activityLatestActionablePrimaryReviewStrategyId,
    activityLatestActionablePrimaryReviewHasRecommendation,
    activityLatestTrackingJobLinkedReviewId,
    activityLatestTrackingJobChangeRequestId,
    activityLatestTrackingJobBacktestId,
    activityLatestTrackingJobSourceChangeRequestId,
    activityLatestTrackingJobSourceBacktestId,
    activityLatestTrackingJobSourceReviewId,
    activityLatestTrackingJobSourceProposalId,
    activityLatestTrackingJobStrategyId,
    activityLatestProposalLinkedChangeRequest,
    activityLatestProposalLinkedBacktest,
    activityLatestProposalLinkedReview,
    activityLatestChangeRequestLinkedBacktestId,
    activityLatestChangeRequestLinkedReviewId,
    activityLatestChangeRequestSourceBacktestId,
    activityLatestChangeRequestSourceBacktestStrategyId,
    activityLatestChangeRequestSourceReviewId,
    activityLatestChangeRequestSourceReviewStrategyId,
    activityLatestChangeRequestSourceProposalId,
    activityLatestChangeRequestSourceProposalStrategyId,
    activityLatestActionableProposal,
    activityLatestActionableChangeRequest,
    activityLatestActionableChangeRequestHasRerunRecommendation,
    activityLatestRetryableTrackingJob,
  }: StrategyActivityTopDecisionActionsSectionProps,
  {
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
    latestProposalJobId,
    latestChangeRequestJobId,
    actionableChangeRequestCanRetry,
    retryableTrackingJobOpenId,
  }: StrategyActivityTopDecisionActionsSectionLinkState,
): StrategyActivityTopDecisionActionsSectionVisibilityState {
  const showLatestFocusActions = Boolean(
    activityLatestProposal ||
      (activityLatestChangeRequest && activityLatestChangeRequestStrategyId) ||
      activityLatestBacktest ||
      (latestPrimaryReviewOpenId && activityLatestPrimaryReviewStrategyId) ||
      (latestTrackingReviewOpenId && activityLatestTrackingReviewStrategyId) ||
      latestTrackingJobOpenId,
  )
  const showLineageActions = Boolean(
    (latestBacktestReviewOpenId && activityLatestBacktestStrategyId) ||
      latestBacktestJobOpenId ||
      (activityLatestActionableBacktestRecord && activityLatestActionableBacktestHasRecommendation) ||
      (activityLatestActionableBacktestJobCanRetry && latestActionableBacktestJobOpenId) ||
      (activityLatestBacktestSourceChangeRequestId && activityLatestBacktestStrategyId) ||
      (activityLatestBacktestSourceBacktestId &&
        activityLatestBacktestStrategyId &&
        activityLatestBacktestSourceBacktestId !== activityLatestBacktest?.id) ||
      (activityLatestBacktestSourceReviewId &&
        activityLatestBacktestStrategyId &&
        activityLatestBacktestSourceReviewId !== activityLatestBacktestReview?.id) ||
      (activityLatestBacktestSourceProposalId && activityLatestBacktestStrategyId) ||
      latestPrimaryReviewSourceJobId ||
      (latestPrimaryReviewSourceChangeRequestId && activityLatestPrimaryReviewStrategyId) ||
      (latestPrimaryReviewSourceBacktestId && activityLatestPrimaryReviewStrategyId) ||
      (latestPrimaryReviewSourceReviewId && activityLatestPrimaryReviewStrategyId) ||
      (latestPrimaryReviewSourceProposalId && activityLatestPrimaryReviewStrategyId) ||
      (latestActionablePrimaryReviewOpenId &&
        activityLatestActionablePrimaryReviewStrategyId &&
        activityLatestActionablePrimaryReviewHasRecommendation) ||
      latestTrackingReviewSourceJobId ||
      (latestTrackingReviewSourceChangeRequestId && activityLatestTrackingReviewStrategyId) ||
      (latestTrackingReviewSourceBacktestId && activityLatestTrackingReviewStrategyId) ||
      (latestTrackingReviewSourceReviewId && activityLatestTrackingReviewStrategyId) ||
      (latestTrackingReviewSourceProposalId && activityLatestTrackingReviewStrategyId) ||
      (activityLatestTrackingJobLinkedReviewId && activityLatestTrackingJobStrategyId) ||
      (activityLatestTrackingJobChangeRequestId && activityLatestTrackingJobStrategyId) ||
      (activityLatestTrackingJobBacktestId && activityLatestTrackingJobStrategyId) ||
      (activityLatestTrackingJobSourceChangeRequestId &&
        activityLatestTrackingJobStrategyId &&
        activityLatestTrackingJobSourceChangeRequestId !== activityLatestTrackingJobChangeRequestId) ||
      (activityLatestTrackingJobSourceBacktestId &&
        activityLatestTrackingJobStrategyId &&
        activityLatestTrackingJobSourceBacktestId !== activityLatestTrackingJobBacktestId) ||
      (activityLatestTrackingJobSourceReviewId &&
        activityLatestTrackingJobStrategyId &&
        activityLatestTrackingJobSourceReviewId !== activityLatestTrackingJobLinkedReviewId) ||
      (activityLatestTrackingJobSourceProposalId && activityLatestTrackingJobStrategyId),
  )
  const showProposalChangeActions = Boolean(
    activityLatestProposalLinkedChangeRequest ||
      activityLatestProposalLinkedBacktest ||
      activityLatestProposalLinkedReview ||
      latestProposalJobId ||
      (activityLatestChangeRequest && activityLatestChangeRequestStrategyId && activityLatestChangeRequestLinkedBacktestId) ||
      (activityLatestChangeRequest && activityLatestChangeRequestStrategyId && activityLatestChangeRequestLinkedReviewId) ||
      latestChangeRequestJobId ||
      (activityLatestChangeRequestSourceBacktestStrategyId && activityLatestChangeRequestSourceBacktestId) ||
      (activityLatestChangeRequestSourceReviewStrategyId && activityLatestChangeRequestSourceReviewId) ||
      (activityLatestChangeRequestSourceProposalStrategyId && activityLatestChangeRequestSourceProposalId),
  )
  const showActionableActions = Boolean(
    activityLatestActionableProposal ||
      actionableChangeRequestCanRetry ||
      (activityLatestActionableChangeRequest && activityLatestActionableChangeRequestHasRerunRecommendation) ||
      (retryableTrackingJobOpenId &&
        (activityLatestRetryableTrackingJob?.status === 'failed' ||
          activityLatestRetryableTrackingJob?.status === 'cancelled')),
  )

  return {
    showLatestFocusActions,
    showLineageActions,
    showProposalChangeActions,
    showActionableActions,
  }
}
