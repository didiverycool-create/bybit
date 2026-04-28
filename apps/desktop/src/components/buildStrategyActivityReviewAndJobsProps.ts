import { isStrategyTrackingReview } from '../utils/app-helpers'
import type { StrategyActivityReviewAndJobsSectionProps } from './StrategyActivityReviewAndJobsSection'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'
import type {
  StrategyActivityDecisionActions,
  StrategyActivityDecisionServiceState,
  StrategyActivityReviewAndJobsState,
} from './buildStrategyActivityDecisionSectionProps'

type BuildStrategyActivityReviewAndJobsPropsArgs = {
  strategyId: string
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  reviewAndJobsState: StrategyActivityReviewAndJobsState
  serviceState: StrategyActivityDecisionServiceState
  actions: StrategyActivityDecisionActions
}

export function buildStrategyActivityReviewAndJobsProps({
  strategyId,
  strategyActivitySnapshotModel,
  reviewAndJobsState,
  serviceState,
  actions,
}: BuildStrategyActivityReviewAndJobsPropsArgs): StrategyActivityReviewAndJobsSectionProps {
  const recentTrackingReviewIds = strategyActivitySnapshotModel.collections.recentReviews
    .filter((review) => isStrategyTrackingReview(review.period))
    .map((review) => review.id)
  const recentPrimaryReviewIds = strategyActivitySnapshotModel.collections.recentReviews
    .filter((review) => !isStrategyTrackingReview(review.period))
    .map((review) => review.id)

  return {
    strategyId,
    selectedStrategyId: reviewAndJobsState.selectedStrategyId,
    replayFocusReview: reviewAndJobsState.replayFocusReview,
    recentTrackingReviewIds,
    recentPrimaryReviewIds,
    recentAgentJobIds: strategyActivitySnapshotModel.collections.recentAgentJobs.map((job) => job.id),
    strategyActivityLatestTrackingReviewSupplemented:
      reviewAndJobsState.strategyActivityLatestTrackingReviewSupplemented,
    strategyActivityTrackingReviews: reviewAndJobsState.strategyActivityTrackingReviews,
    activityLatestTrackingReview: reviewAndJobsState.activityLatestTrackingReview,
    strategyActivityLatestPrimaryReviewSupplemented:
      reviewAndJobsState.strategyActivityLatestPrimaryReviewSupplemented,
    strategyActivityLatestActionablePrimaryReviewSupplemented:
      reviewAndJobsState.strategyActivityLatestActionablePrimaryReviewSupplemented,
    strategyActivityLatestActionableBacktestReviewSupplemented:
      reviewAndJobsState.strategyActivityLatestActionableBacktestReviewSupplemented,
    strategyActivityPrimaryReviews: reviewAndJobsState.strategyActivityPrimaryReviews,
    activityLatestPrimaryReview: reviewAndJobsState.activityLatestPrimaryReview,
    activityLatestActionablePrimaryReview: reviewAndJobsState.activityLatestActionablePrimaryReview,
    activityLatestActionableBacktestReview:
      reviewAndJobsState.activityLatestActionableBacktestReview,
    aiSchedulerFocusedJobId: reviewAndJobsState.aiSchedulerFocusedJobId,
    strategyActivityLatestTrackingJobSupplemented:
      reviewAndJobsState.strategyActivityLatestTrackingJobSupplemented,
    strategyActivityLatestRetryableTrackingJobSupplemented:
      reviewAndJobsState.strategyActivityLatestRetryableTrackingJobSupplemented,
    strategyActivityLatestActionableBacktestJobSupplemented:
      reviewAndJobsState.strategyActivityLatestActionableBacktestJobSupplemented,
    strategyActivityAgentJobs: reviewAndJobsState.strategyActivityAgentJobs,
    activityLatestTrackingJob: reviewAndJobsState.activityLatestTrackingJob,
    activityLatestRetryableTrackingJob: reviewAndJobsState.activityLatestRetryableTrackingJob,
    activityLatestActionableBacktestJob:
      reviewAndJobsState.activityLatestActionableBacktestJob,
    serviceAvailable: serviceState.serviceAvailable,
    backtestMutationPending: serviceState.backtestMutationPending,
    retryAgentJobMutationPending: serviceState.retryAgentJobMutationPending,
    onOpenChangeRequest: actions.onOpenChangeRequest,
    onOpenBacktestDetail: actions.onOpenBacktestDetail,
    onOpenSourceReview: actions.onOpenSourceReview,
    onOpenStrategyProposal: actions.onOpenStrategyProposal,
    onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
    onOpenReviewInspector: actions.onOpenReviewInspector,
    onOpenReplayReview: actions.onOpenReplayReview,
    onOpenStrategyReplay: actions.onOpenStrategyReplay,
    onRerunBacktestFromReview: actions.onRerunBacktestFromReview,
    onRetryAgentJob: actions.onRetryAgentJob,
  }
}
