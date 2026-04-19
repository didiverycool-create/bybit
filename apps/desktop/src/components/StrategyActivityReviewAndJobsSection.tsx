import type { AgentJob, ReviewDocument } from '../types'
import StrategyActivityReviewJobsSection from './StrategyActivityReviewJobsSection'
import StrategyActivityReviewPrimarySection from './StrategyActivityReviewPrimarySection'
import StrategyActivityReviewTrackingSection from './StrategyActivityReviewTrackingSection'

export type StrategyActivityReviewAndJobsSectionProps = {
  strategyId: string
  selectedStrategyId: string | null
  replayFocusReview: ReviewDocument | null
  recentTrackingReviewIds: string[]
  recentPrimaryReviewIds: string[]
  recentAgentJobIds: string[]
  strategyActivityLatestTrackingReviewSupplemented: boolean
  strategyActivityTrackingReviews: ReviewDocument[]
  activityLatestTrackingReview: ReviewDocument | null
  strategyActivityLatestPrimaryReviewSupplemented: boolean
  strategyActivityLatestActionablePrimaryReviewSupplemented: boolean
  strategyActivityLatestActionableBacktestReviewSupplemented: boolean
  strategyActivityPrimaryReviews: ReviewDocument[]
  activityLatestPrimaryReview: ReviewDocument | null
  activityLatestActionablePrimaryReview: ReviewDocument | null
  activityLatestActionableBacktestReview: ReviewDocument | null
  aiSchedulerFocusedJobId: string | null
  strategyActivityLatestTrackingJobSupplemented: boolean
  strategyActivityLatestRetryableTrackingJobSupplemented: boolean
  strategyActivityLatestActionableBacktestJobSupplemented: boolean
  strategyActivityAgentJobs: AgentJob[]
  activityLatestTrackingJob: AgentJob | null
  activityLatestRetryableTrackingJob: AgentJob | null
  activityLatestActionableBacktestJob: AgentJob | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenStrategyReplay: (strategyId: string) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void
  onRetryAgentJob: (jobId: string) => void
}

export default function StrategyActivityReviewAndJobsSection({
  strategyId,
  selectedStrategyId,
  replayFocusReview,
  recentTrackingReviewIds,
  recentPrimaryReviewIds,
  recentAgentJobIds,
  strategyActivityLatestTrackingReviewSupplemented,
  strategyActivityTrackingReviews,
  activityLatestTrackingReview,
  strategyActivityLatestPrimaryReviewSupplemented,
  strategyActivityLatestActionablePrimaryReviewSupplemented,
  strategyActivityLatestActionableBacktestReviewSupplemented,
  strategyActivityPrimaryReviews,
  activityLatestPrimaryReview,
  activityLatestActionablePrimaryReview,
  activityLatestActionableBacktestReview,
  aiSchedulerFocusedJobId,
  strategyActivityLatestTrackingJobSupplemented,
  strategyActivityLatestRetryableTrackingJobSupplemented,
  strategyActivityLatestActionableBacktestJobSupplemented,
  strategyActivityAgentJobs,
  activityLatestTrackingJob,
  activityLatestRetryableTrackingJob,
  activityLatestActionableBacktestJob,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenReplayReview,
  onOpenStrategyReplay,
  onRerunBacktestFromReview,
  onRetryAgentJob,
}: StrategyActivityReviewAndJobsSectionProps) {
  return (
    <>
      <StrategyActivityReviewTrackingSection
        strategyId={strategyId}
        selectedStrategyId={selectedStrategyId}
        replayFocusReview={replayFocusReview}
        recentTrackingReviewIds={recentTrackingReviewIds}
        strategyActivityLatestTrackingReviewSupplemented={strategyActivityLatestTrackingReviewSupplemented}
        strategyActivityTrackingReviews={strategyActivityTrackingReviews}
        activityLatestTrackingReview={activityLatestTrackingReview}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenSourceReview={onOpenSourceReview}
        onOpenStrategyProposal={onOpenStrategyProposal}
      />

      <StrategyActivityReviewPrimarySection
        strategyId={strategyId}
        selectedStrategyId={selectedStrategyId}
        replayFocusReview={replayFocusReview}
        recentPrimaryReviewIds={recentPrimaryReviewIds}
        strategyActivityLatestPrimaryReviewSupplemented={strategyActivityLatestPrimaryReviewSupplemented}
        strategyActivityLatestActionablePrimaryReviewSupplemented={strategyActivityLatestActionablePrimaryReviewSupplemented}
        strategyActivityLatestActionableBacktestReviewSupplemented={strategyActivityLatestActionableBacktestReviewSupplemented}
        strategyActivityPrimaryReviews={strategyActivityPrimaryReviews}
        activityLatestPrimaryReview={activityLatestPrimaryReview}
        activityLatestActionablePrimaryReview={activityLatestActionablePrimaryReview}
        activityLatestActionableBacktestReview={activityLatestActionableBacktestReview}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenSourceReview={onOpenSourceReview}
        onOpenStrategyProposal={onOpenStrategyProposal}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
        onOpenReplayReview={onOpenReplayReview}
        onRerunBacktestFromReview={onRerunBacktestFromReview}
        serviceAvailable={serviceAvailable}
        backtestMutationPending={backtestMutationPending}
      />

      <StrategyActivityReviewJobsSection
        strategyId={strategyId}
        selectedStrategyId={selectedStrategyId}
        replayFocusReview={replayFocusReview}
        recentAgentJobIds={recentAgentJobIds}
        strategyActivityLatestTrackingJobSupplemented={strategyActivityLatestTrackingJobSupplemented}
        strategyActivityLatestRetryableTrackingJobSupplemented={strategyActivityLatestRetryableTrackingJobSupplemented}
        strategyActivityLatestActionableBacktestJobSupplemented={strategyActivityLatestActionableBacktestJobSupplemented}
        strategyActivityAgentJobs={strategyActivityAgentJobs}
        activityLatestTrackingJob={activityLatestTrackingJob}
        activityLatestRetryableTrackingJob={activityLatestRetryableTrackingJob}
        activityLatestActionableBacktestJob={activityLatestActionableBacktestJob}
        aiSchedulerFocusedJobId={aiSchedulerFocusedJobId}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenSourceReview={onOpenSourceReview}
        onOpenStrategyProposal={onOpenStrategyProposal}
        onOpenReviewInspector={onOpenReviewInspector}
        onOpenStrategyReplay={onOpenStrategyReplay}
        onRetryAgentJob={onRetryAgentJob}
        serviceAvailable={serviceAvailable}
        retryAgentJobMutationPending={retryAgentJobMutationPending}
      />
    </>
  )
}
