import type { AgentJob, ReviewDocument, StrategySummary } from '../types'
import ReplayWorkspaceTrackingJobListItem from './ReplayWorkspaceTrackingJobListItem'
import ReplayWorkspaceTrackingReviewListItem from './ReplayWorkspaceTrackingReviewListItem'

type ReplayWorkspaceTrackingSectionProps = {
  selectedStrategy: StrategySummary | null
  replayTrackingScope: 'all' | 'selected'
  onSetReplayTrackingScope: (scope: 'all' | 'selected') => void
  filteredReplayTrackingReviews: ReviewDocument[]
  filteredReplayTrackingJobs: AgentJob[]
  strategyNameMap: Map<string, string>
  serviceAvailable: boolean
  retryAgentJobMutationPending: boolean
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string, focusJob?: boolean) => void
}

export default function ReplayWorkspaceTrackingSection({
  selectedStrategy,
  replayTrackingScope,
  onSetReplayTrackingScope,
  filteredReplayTrackingReviews,
  filteredReplayTrackingJobs,
  strategyNameMap,
  serviceAvailable,
  retryAgentJobMutationPending,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenStrategyActivity,
  onRetryAgentJob,
}: ReplayWorkspaceTrackingSectionProps) {
  return (
    <div className="replay-tracking-section">
      <div className="panel-head panel-head--compact">
        <div>
          <span className="section-label">策略跟踪</span>
          <h3>问题与变更的后续追踪</h3>
        </div>
        <span className="chip chip--muted">{filteredReplayTrackingReviews.length} 条</span>
      </div>
      <div className="chip-row">
        <button
          type="button"
          className={`pill pill--compact ${replayTrackingScope === 'all' ? 'active' : ''}`}
          onClick={() => onSetReplayTrackingScope('all')}
        >
          全部策略
        </button>
        {selectedStrategy && (
          <button
            type="button"
            className={`pill pill--compact ${replayTrackingScope === 'selected' ? 'active' : ''}`}
            onClick={() => onSetReplayTrackingScope('selected')}
          >
            当前策略
          </button>
        )}
      </div>
      <div className="job-list">
        {filteredReplayTrackingReviews.slice(0, 6).map((review, index) => (
          <ReplayWorkspaceTrackingReviewListItem
            key={review.id}
            review={review}
            index={index}
            replayTrackingScope={replayTrackingScope}
            strategyNameMap={strategyNameMap}
            onOpenAiSchedulerJob={onOpenAiSchedulerJob}
            onOpenReviewInspector={onOpenReviewInspector}
            onOpenStrategyActivity={onOpenStrategyActivity}
          />
        ))}
        {!filteredReplayTrackingReviews.length && (
          <div className="empty-state empty-state--inline">当前还没有策略问题或变更跟踪记录</div>
        )}
      </div>
      <div className="panel-head panel-head--compact">
        <div>
          <span className="section-label">跟踪任务</span>
          <h3>最近排队或执行过的 AI 跟踪任务</h3>
        </div>
        <span className="chip chip--muted">{filteredReplayTrackingJobs.length} 条</span>
      </div>
      <div className="job-list">
        {filteredReplayTrackingJobs.slice(0, 6).map((job, index) => (
          <ReplayWorkspaceTrackingJobListItem
            key={job.id}
            job={job}
            index={index}
            replayTrackingScope={replayTrackingScope}
            strategyNameMap={strategyNameMap}
            serviceAvailable={serviceAvailable}
            retryAgentJobMutationPending={retryAgentJobMutationPending}
            onOpenReviewInspector={onOpenReviewInspector}
            onOpenStrategyActivity={onOpenStrategyActivity}
            onRetryAgentJob={onRetryAgentJob}
          />
        ))}
        {!filteredReplayTrackingJobs.length && <div className="empty-state empty-state--inline">当前还没有策略跟踪任务</div>}
      </div>
    </div>
  )
}
