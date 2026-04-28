import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument, StrategySummary } from '../types'
import { isStrategyTrackingReview } from '../utils/app-helpers'
import ReplayWorkspaceFocusSection, {
  type ReplayFocusReviewDecisionMeta,
  type ReplayFocusReviewLineageMeta,
} from './ReplayWorkspaceFocusSection'
import ReplayWorkspaceProposalFeedSection from './ReplayWorkspaceProposalFeedSection'
import ReplayWorkspaceTrackingSection from './ReplayWorkspaceTrackingSection'
import type { ReplayProposalFeedItem } from './replayWorkspaceSectionTypes'

type ReplayWorkspaceSectionProps = {
  selectedStrategy: StrategySummary | null
  replayFocusReview: ReviewDocument | null
  replayFocusReviewDecisionMeta: ReplayFocusReviewDecisionMeta
  replayFocusReviewLineageMeta: ReplayFocusReviewLineageMeta
  hasLatestTrackingReview: boolean
  replayTrackingScope: 'all' | 'selected'
  onSetReplayTrackingScope: (scope: 'all' | 'selected') => void
  serviceAvailable: boolean
  agentJobMutationPending: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  proposalMutationPending: boolean
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  focusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  filteredReplayTrackingReviews: ReviewDocument[]
  filteredReplayTrackingJobs: AgentJob[]
  strategyNameMap: Map<string, string>
  replayProposalFeed: ReplayProposalFeedItem[]
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  schedulerState?: { status?: string; freeze_publish?: boolean } | null
  onSubmitReviewJob: () => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onRetryAgentJob: (jobId: string, focusJob?: boolean) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}

export default function ReplayWorkspaceSection({
  selectedStrategy,
  replayFocusReview,
  replayFocusReviewDecisionMeta,
  replayFocusReviewLineageMeta,
  hasLatestTrackingReview,
  replayTrackingScope,
  onSetReplayTrackingScope,
  serviceAvailable,
  agentJobMutationPending,
  backtestMutationPending,
  retryAgentJobMutationPending,
  proposalMutationPending,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  focusedReviewId,
  aiSchedulerFocusedJobId,
  filteredReplayTrackingReviews,
  filteredReplayTrackingJobs,
  strategyNameMap,
  replayProposalFeed,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  schedulerState,
  onSubmitReviewJob,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenStrategyActivity,
  onRerunBacktestFromReview,
  onOpenReviewInspector,
  onOpenReplayReview,
  onRetryAgentJob,
  onHandleProposalAction,
}: ReplayWorkspaceSectionProps) {
  return (
    <section className="two-column replay-layout section-entrance">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">AI 复盘</span>
            <h3>{replayFocusReview && isStrategyTrackingReview(replayFocusReview.period) ? '策略跟踪结果' : '每日总结与策略提案'}</h3>
          </div>
          <button
            type="button"
            className="ghost-button"
            disabled={!serviceAvailable || agentJobMutationPending}
            onClick={onSubmitReviewJob}
          >
            生成复盘
          </button>
        </div>
        {replayFocusReview ? (
          <ReplayWorkspaceFocusSection
            selectedStrategy={selectedStrategy}
            replayFocusReview={replayFocusReview}
            replayFocusReviewDecisionMeta={replayFocusReviewDecisionMeta}
            replayFocusReviewLineageMeta={replayFocusReviewLineageMeta}
            replayTrackingScope={replayTrackingScope}
            serviceAvailable={serviceAvailable}
            agentJobMutationPending={agentJobMutationPending}
            backtestMutationPending={backtestMutationPending}
            filteredReplayTrackingReviews={filteredReplayTrackingReviews}
            filteredReplayTrackingJobs={filteredReplayTrackingJobs}
            strategyNameMap={strategyNameMap}
            onSetReplayTrackingScope={onSetReplayTrackingScope}
            onOpenAiSchedulerJob={onOpenAiSchedulerJob}
            onOpenStrategyActivity={onOpenStrategyActivity}
            onOpenReviewInspector={onOpenReviewInspector}
            onOpenChangeRequest={onOpenChangeRequest}
            onOpenBacktestDetail={onOpenBacktestDetail}
            onOpenSourceReview={onOpenSourceReview}
            onOpenStrategyProposal={onOpenStrategyProposal}
            onRerunBacktestFromReview={onRerunBacktestFromReview}
            onRetryAgentJob={onRetryAgentJob}
          />
        ) : (
          <div className="empty-state">
            当前还没有{replayTrackingScope === 'selected' && selectedStrategy ? '该策略的' : ''}日报或回测复盘
            {hasLatestTrackingReview ? '，但已经生成策略跟踪记录。' : ''}
          </div>
        )}
        <ReplayWorkspaceTrackingSection
          selectedStrategy={selectedStrategy}
          replayTrackingScope={replayTrackingScope}
          onSetReplayTrackingScope={onSetReplayTrackingScope}
          filteredReplayTrackingReviews={filteredReplayTrackingReviews}
          filteredReplayTrackingJobs={filteredReplayTrackingJobs}
          strategyNameMap={strategyNameMap}
          serviceAvailable={serviceAvailable}
          retryAgentJobMutationPending={retryAgentJobMutationPending}
          onOpenAiSchedulerJob={onOpenAiSchedulerJob}
          onOpenReviewInspector={onOpenReviewInspector}
          onOpenStrategyActivity={onOpenStrategyActivity}
          onRetryAgentJob={onRetryAgentJob}
        />
      </article>

      <ReplayWorkspaceProposalFeedSection
        selectedProposalId={selectedProposalId}
        selectedChangeRequestId={selectedChangeRequestId}
        selectedBacktestId={selectedBacktestId}
        focusedReviewId={focusedReviewId}
        aiSchedulerFocusedJobId={aiSchedulerFocusedJobId}
        replayProposalFeed={replayProposalFeed}
        proposalBacktestMap={proposalBacktestMap}
        proposalReviewMap={proposalReviewMap}
        proposalChangeRequestMap={proposalChangeRequestMap}
        proposalAgentJobMap={proposalAgentJobMap}
        schedulerState={schedulerState}
        serviceAvailable={serviceAvailable}
        proposalMutationPending={proposalMutationPending}
        retryAgentJobMutationPending={retryAgentJobMutationPending}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
        onOpenReviewInspector={onOpenReviewInspector}
        onOpenReplayReview={onOpenReplayReview}
        onRetryAgentJob={onRetryAgentJob}
        onHandleProposalAction={onHandleProposalAction}
      />
    </section>
  )
}
