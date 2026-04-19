import type { AgentJob, ReviewDocument, StrategySummary } from '../types'
import ReplayWorkspaceTrackingSection from './ReplayWorkspaceTrackingSection'
import ReplayWorkspaceFocusSignalsSection from './ReplayWorkspaceFocusSignalsSection'
import ReplayWorkspaceFocusSummarySection from './ReplayWorkspaceFocusSummarySection'
import type { ReplayFocusReviewDecisionMeta, ReplayFocusReviewLineageMeta } from './replayWorkspaceFocusSectionTypes'

export type { ReplayFocusReviewDecisionMeta, ReplayFocusReviewLineageMeta } from './replayWorkspaceFocusSectionTypes'

type ReplayWorkspaceFocusSectionProps = {
  selectedStrategy: StrategySummary | null
  replayFocusReview: ReviewDocument
  replayFocusReviewDecisionMeta: ReplayFocusReviewDecisionMeta
  replayFocusReviewLineageMeta: ReplayFocusReviewLineageMeta
  replayTrackingScope: 'all' | 'selected'
  serviceAvailable: boolean
  agentJobMutationPending: boolean
  backtestMutationPending: boolean
  filteredReplayTrackingReviews: ReviewDocument[]
  filteredReplayTrackingJobs: AgentJob[]
  strategyNameMap: Map<string, string>
  onSetReplayTrackingScope: (scope: 'all' | 'selected') => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void
  onRetryAgentJob: (jobId: string, focusJob?: boolean) => void
}

export default function ReplayWorkspaceFocusSection({
  selectedStrategy,
  replayFocusReview,
  replayFocusReviewDecisionMeta,
  replayFocusReviewLineageMeta,
  replayTrackingScope,
  serviceAvailable,
  agentJobMutationPending,
  backtestMutationPending,
  filteredReplayTrackingReviews,
  filteredReplayTrackingJobs,
  strategyNameMap,
  onSetReplayTrackingScope,
  onOpenAiSchedulerJob,
  onOpenStrategyActivity,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onRerunBacktestFromReview,
  onRetryAgentJob,
}: ReplayWorkspaceFocusSectionProps) {
  return (
    <div className="replay-focus">
      <ReplayWorkspaceFocusSummarySection
        replayFocusReview={replayFocusReview}
        replayFocusReviewDecisionMeta={replayFocusReviewDecisionMeta}
        replayFocusReviewLineageMeta={replayFocusReviewLineageMeta}
        serviceAvailable={serviceAvailable}
        backtestMutationPending={backtestMutationPending}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
        onOpenStrategyActivity={onOpenStrategyActivity}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenSourceReview={onOpenSourceReview}
        onOpenStrategyProposal={onOpenStrategyProposal}
        onRerunBacktestFromReview={onRerunBacktestFromReview}
      />
      <ReplayWorkspaceFocusSignalsSection replayFocusReview={replayFocusReview} />
      <ReplayWorkspaceTrackingSection
        selectedStrategy={selectedStrategy}
        replayTrackingScope={replayTrackingScope}
        onSetReplayTrackingScope={onSetReplayTrackingScope}
        filteredReplayTrackingReviews={filteredReplayTrackingReviews}
        filteredReplayTrackingJobs={filteredReplayTrackingJobs}
        strategyNameMap={strategyNameMap}
        serviceAvailable={serviceAvailable}
        retryAgentJobMutationPending={agentJobMutationPending}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
        onOpenReviewInspector={onOpenReviewInspector}
        onOpenStrategyActivity={onOpenStrategyActivity}
        onRetryAgentJob={onRetryAgentJob}
      />
    </div>
  )
}
