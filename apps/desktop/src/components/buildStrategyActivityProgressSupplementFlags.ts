import type {
  StrategyActivityProgressLookupContext,
  UseStrategyActivityProgressModelArgs,
} from './strategyActivityProgressShared'

type SupplementFlagArgs = Pick<
  UseStrategyActivityProgressModelArgs,
  | 'selectedStrategyProposal'
  | 'selectedStrategyChangeRequest'
  | 'selectedBacktest'
  | 'focusedPrimaryReviewId'
  | 'focusedTrackingReviewId'
  | 'aiSchedulerFocusedJobId'
>

export function buildStrategyActivityProgressSupplementFlags(
  {
    selectedStrategyProposal,
    selectedStrategyChangeRequest,
    selectedBacktest,
    focusedPrimaryReviewId,
    focusedTrackingReviewId,
    aiSchedulerFocusedJobId,
  }: SupplementFlagArgs,
  context: StrategyActivityProgressLookupContext,
) {
  const {
    proposalSources,
    changeRequestSources,
    backtestSources,
    reviewSources,
    trackingSources,
    recentProposalIds,
    recentChangeRequestIds,
    recentBacktestIds,
    recentPrimaryReviewIds,
    recentTrackingReviewIds,
    recentAgentJobIds,
  } = context
  const { latestProposal: latestProposalSource, latestActionableProposal: latestActionableProposalSource } =
    proposalSources
  const {
    latestChangeRequest: latestChangeRequestSource,
    latestActionableChangeRequest: latestActionableChangeRequestSource,
  } = changeRequestSources
  const {
    latestBacktest: latestBacktestSource,
    latestActionableBacktest: latestActionableBacktestSource,
    latestActionableBacktestReview: latestActionableBacktestReviewSource,
    latestActionableBacktestJob: latestActionableBacktestJobSource,
  } = backtestSources
  const {
    latestPrimaryReview: latestPrimaryReviewSource,
    latestActionablePrimaryReview: latestActionablePrimaryReviewSource,
  } = reviewSources
  const {
    latestTrackingReview: latestTrackingReviewSource,
    latestTrackingJob: latestTrackingJobSource,
    latestRetryableTrackingJob: latestRetryableTrackingJobSource,
  } = trackingSources

  const strategyActivityLatestProposalSupplemented = Boolean(
    latestProposalSource &&
      !recentProposalIds.has(latestProposalSource.id) &&
      latestProposalSource.id !== selectedStrategyProposal?.id,
  )
  const strategyActivityLatestActionableProposalSupplemented = Boolean(
    latestActionableProposalSource &&
      !recentProposalIds.has(latestActionableProposalSource.id) &&
      latestActionableProposalSource.id !== selectedStrategyProposal?.id,
  )
  const strategyActivityLatestChangeRequestSupplemented = Boolean(
    latestChangeRequestSource &&
      !recentChangeRequestIds.has(latestChangeRequestSource.id) &&
      latestChangeRequestSource.id !== selectedStrategyChangeRequest?.id,
  )
  const strategyActivityLatestActionableChangeRequestSupplemented = Boolean(
    latestActionableChangeRequestSource &&
      !recentChangeRequestIds.has(latestActionableChangeRequestSource.id) &&
      latestActionableChangeRequestSource.id !== selectedStrategyChangeRequest?.id,
  )
  const strategyActivityLatestBacktestSupplemented = Boolean(
    latestBacktestSource &&
      !recentBacktestIds.has(latestBacktestSource.id) &&
      latestBacktestSource.id !== selectedBacktest?.id,
  )
  const strategyActivityLatestActionableBacktestSupplemented = Boolean(
    latestActionableBacktestSource &&
      !recentBacktestIds.has(latestActionableBacktestSource.id) &&
      latestActionableBacktestSource.id !== selectedBacktest?.id,
  )
  const strategyActivityLatestActionableBacktestReviewSupplemented = Boolean(
    latestActionableBacktestReviewSource &&
      !recentPrimaryReviewIds.has(latestActionableBacktestReviewSource.id) &&
      latestActionableBacktestReviewSource.id !== focusedPrimaryReviewId,
  )
  const strategyActivityLatestTrackingReviewSupplemented = Boolean(
    latestTrackingReviewSource &&
      !recentTrackingReviewIds.has(latestTrackingReviewSource.id) &&
      latestTrackingReviewSource.id !== focusedTrackingReviewId,
  )
  const strategyActivityLatestPrimaryReviewSupplemented = Boolean(
    latestPrimaryReviewSource &&
      !recentPrimaryReviewIds.has(latestPrimaryReviewSource.id) &&
      latestPrimaryReviewSource.id !== focusedPrimaryReviewId,
  )
  const strategyActivityLatestActionablePrimaryReviewSupplemented = Boolean(
    latestActionablePrimaryReviewSource &&
      !recentPrimaryReviewIds.has(latestActionablePrimaryReviewSource.id) &&
      latestActionablePrimaryReviewSource.id !== focusedPrimaryReviewId,
  )
  const strategyActivityLatestTrackingJobSupplemented = Boolean(
    latestTrackingJobSource &&
      !recentAgentJobIds.has(latestTrackingJobSource.id) &&
      latestTrackingJobSource.id !== aiSchedulerFocusedJobId,
  )
  const strategyActivityLatestRetryableTrackingJobSupplemented = Boolean(
    latestRetryableTrackingJobSource &&
      !recentAgentJobIds.has(latestRetryableTrackingJobSource.id) &&
      latestRetryableTrackingJobSource.id !== aiSchedulerFocusedJobId,
  )
  const strategyActivityLatestActionableBacktestJobSupplemented = Boolean(
    latestActionableBacktestJobSource &&
      !recentAgentJobIds.has(latestActionableBacktestJobSource.id) &&
      latestActionableBacktestJobSource.id !== aiSchedulerFocusedJobId,
  )

  return {
    strategyActivityLatestProposalSupplemented,
    strategyActivityLatestActionableProposalSupplemented,
    strategyActivityLatestChangeRequestSupplemented,
    strategyActivityLatestActionableChangeRequestSupplemented,
    strategyActivityLatestBacktestSupplemented,
    strategyActivityLatestActionableBacktestSupplemented,
    strategyActivityLatestActionableBacktestReviewSupplemented,
    strategyActivityLatestTrackingReviewSupplemented,
    strategyActivityLatestPrimaryReviewSupplemented,
    strategyActivityLatestActionablePrimaryReviewSupplemented,
    strategyActivityLatestTrackingJobSupplemented,
    strategyActivityLatestRetryableTrackingJobSupplemented,
    strategyActivityLatestActionableBacktestJobSupplemented,
  }
}
