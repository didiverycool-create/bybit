import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument } from '../types'
import ReplayWorkspaceProposalFeedListItem from './ReplayWorkspaceProposalFeedListItem'
import type { ReplayProposalFeedItem } from './replayWorkspaceSectionTypes'

type ReplayWorkspaceProposalFeedSectionProps = {
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  focusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  replayProposalFeed: ReplayProposalFeedItem[]
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  schedulerState?: { status?: string; freeze_publish?: boolean } | null
  serviceAvailable: boolean
  proposalMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onRetryAgentJob: (jobId: string, focusJob?: boolean) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}

export default function ReplayWorkspaceProposalFeedSection({
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  focusedReviewId,
  aiSchedulerFocusedJobId,
  replayProposalFeed,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  schedulerState,
  serviceAvailable,
  proposalMutationPending,
  retryAgentJobMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenReplayReview,
  onRetryAgentJob,
  onHandleProposalAction,
}: ReplayWorkspaceProposalFeedSectionProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <span className="section-label">提案流</span>
          <h3>按时间查看待处理策略建议</h3>
        </div>
        <span className="chip chip--muted">{replayProposalFeed.length} 条</span>
      </div>
      <div className="job-list">
        {replayProposalFeed.map((item, index) => {
          const linkedBacktest = proposalBacktestMap.get(item.proposal.id) ?? null
          const linkedReview = proposalReviewMap.get(item.proposal.id) ?? null
          const linkedChangeRequest = proposalChangeRequestMap.get(item.proposal.id) ?? null
          const linkedJob = proposalAgentJobMap.get(item.proposal.id) ?? null
          return (
            <ReplayWorkspaceProposalFeedListItem
              key={item.proposal.id}
              item={item}
              index={index}
              selectedProposalId={selectedProposalId}
              selectedChangeRequestId={selectedChangeRequestId}
              selectedBacktestId={selectedBacktestId}
              focusedReviewId={focusedReviewId}
              aiSchedulerFocusedJobId={aiSchedulerFocusedJobId}
              linkedBacktest={linkedBacktest}
              linkedReview={linkedReview}
              linkedChangeRequest={linkedChangeRequest}
              linkedJob={linkedJob}
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
          )
        })}
        {!replayProposalFeed.length && <div className="empty-state empty-state--inline">当前没有可处理的提案</div>}
      </div>
    </article>
  )
}
