import type { AgentJob, ExecutionEvent } from '../../types'

import SchedulerWorkspaceActivityRow from './SchedulerWorkspaceActivityRow'
import SchedulerWorkspaceJobRow from './SchedulerWorkspaceJobRow'

type SchedulerWorkspaceActivityPanelProps = {
  schedulerJobs: AgentJob[]
  aiActivityFeed: ExecutionEvent[]
  aiSchedulerFocusedJobId?: string | null
  serviceAvailable: boolean
  retryAgentJobPending: boolean
  agentJobMutationPending: boolean
  onSubmitReviewJob: () => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onOpenAiSchedulerJob: (jobId: string) => void
}

export default function SchedulerWorkspaceActivityPanel({
  schedulerJobs,
  aiActivityFeed,
  aiSchedulerFocusedJobId,
  serviceAvailable,
  retryAgentJobPending,
  agentJobMutationPending,
  onSubmitReviewJob,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
  onRetryAgentJob,
  onOpenAiSchedulerJob,
}: SchedulerWorkspaceActivityPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <span className="section-label">队列与实时轨迹</span>
          <h3>当前任务与 AI 操作日志</h3>
        </div>
        <button
          type="button"
          className="ghost-button"
          disabled={!serviceAvailable || agentJobMutationPending}
          onClick={onSubmitReviewJob}
        >
          生成复盘任务
        </button>
      </div>
      <div className="record-stack record-stack--terminal">
        <div className="console-panel console-panel--stream">
          <div className="watchlist-module__header">
            <span className="section-label">任务队列</span>
            <strong>{schedulerJobs.length} 条</strong>
          </div>
          <div className="job-list">
            {schedulerJobs.map((job, index) => (
              <SchedulerWorkspaceJobRow
                key={job.id}
                job={job}
                index={index}
                active={aiSchedulerFocusedJobId === job.id}
                serviceAvailable={serviceAvailable}
                retryAgentJobPending={retryAgentJobPending}
                onOpenReviewInspector={onOpenReviewInspector}
                onOpenChangeRequest={onOpenChangeRequest}
                onOpenBacktestDetail={onOpenBacktestDetail}
                onOpenSourceReview={onOpenSourceReview}
                onOpenStrategyProposal={onOpenStrategyProposal}
                onOpenStrategyActivity={onOpenStrategyActivity}
                onRetryAgentJob={onRetryAgentJob}
              />
            ))}
            {!schedulerJobs.length && <div className="empty-state empty-state--inline">当前没有排队任务</div>}
          </div>
        </div>
        <div className="console-panel console-panel--stream">
          <div className="watchlist-module__header">
            <span className="section-label">AI 实时操作</span>
            <strong>{aiActivityFeed.length} 条</strong>
          </div>
          <div className="job-list">
            {aiActivityFeed.map((event, index) => (
              <SchedulerWorkspaceActivityRow
                key={event.id}
                event={event}
                index={index}
                onOpenAiSchedulerJob={onOpenAiSchedulerJob}
                onOpenReviewInspector={onOpenReviewInspector}
                onOpenChangeRequest={onOpenChangeRequest}
                onOpenBacktestDetail={onOpenBacktestDetail}
                onOpenSourceReview={onOpenSourceReview}
                onOpenStrategyProposal={onOpenStrategyProposal}
                onOpenStrategyActivity={onOpenStrategyActivity}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
