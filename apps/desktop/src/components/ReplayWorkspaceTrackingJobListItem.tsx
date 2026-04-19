import { Bot } from 'lucide-react'

import type { AgentJob } from '../types'
import { getAgentJobStrategyId, jobStatusLabel, reviewPeriodChipClass, reviewPeriodLabel, strategyAgentJobSummary, formatTime } from '../utils/app-helpers'

type ReplayWorkspaceTrackingJobListItemProps = {
  job: AgentJob
  index: number
  replayTrackingScope: 'all' | 'selected'
  strategyNameMap: Map<string, string>
  serviceAvailable: boolean
  retryAgentJobMutationPending: boolean
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string, focusJob?: boolean) => void
}

export default function ReplayWorkspaceTrackingJobListItem({
  job,
  index,
  replayTrackingScope,
  strategyNameMap,
  serviceAvailable,
  retryAgentJobMutationPending,
  onOpenReviewInspector,
  onOpenStrategyActivity,
  onRetryAgentJob,
}: ReplayWorkspaceTrackingJobListItemProps) {
  return (
    <div className="job-row job-row--fade" style={{ animationDelay: `${index * 22}ms` }}>
      <div className="console-row__main">
        <strong>
          <Bot size={13} />
          {strategyAgentJobSummary(job)}
        </strong>
        <p>
          {(() => {
            const strategyId = getAgentJobStrategyId(job)
            const strategyPrefix =
              replayTrackingScope === 'all' && strategyId ? `${strategyNameMap.get(strategyId) ?? strategyId} · ` : ''
            return `${strategyPrefix}${job.result_summary || `${job.writeback_target} · ${jobStatusLabel(job.status)}`}`
          })()}
        </p>
      </div>
      <div className="job-meta">
        <span className="console-tag">{jobStatusLabel(job.status)}</span>
        {job.linked_review_period && (
          <span className={reviewPeriodChipClass(job.linked_review_period)}>
            {reviewPeriodLabel(job.linked_review_period)}
          </span>
        )}
        {job.linked_review_id && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenReviewInspector(job.linked_review_id, getAgentJobStrategyId(job))}
          >
            查看结果
          </button>
        )}
        {getAgentJobStrategyId(job) && (
          <button type="button" className="micro-action" onClick={() => onOpenStrategyActivity(getAgentJobStrategyId(job))}>
            打开策略
          </button>
        )}
        {(job.status === 'failed' || job.status === 'cancelled') && (
          <button
            type="button"
            className="micro-action"
            disabled={!serviceAvailable || retryAgentJobMutationPending}
            onClick={() => onRetryAgentJob(job.id)}
          >
            重试
          </button>
        )}
        <small>{formatTime(job.updated_at || job.created_at)}</small>
      </div>
    </div>
  )
}
