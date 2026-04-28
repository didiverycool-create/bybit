import { Bot } from 'lucide-react'

import type { AgentJob } from '../../types'
import {
  canRetryAgentJob,
  formatTime,
  getAgentJobBacktestId,
  getAgentJobChangeRequestId,
  getAgentJobLinkedReviewId,
  getAgentJobLinkedReviewPeriod,
  getAgentJobRetryCount,
  getAgentJobRetriedFrom,
  getAgentJobSourceBacktestId,
  getAgentJobSourceProposalId,
  getAgentJobSourceReviewId,
  getAgentJobStrategyId,
  jobStatusLabel,
  jobStatusToneClass,
  reviewPeriodChipClass,
  reviewPeriodLabel,
} from '../../utils/app-helpers'

type SchedulerWorkspaceJobRowProps = {
  job: AgentJob
  index: number
  active: boolean
  serviceAvailable: boolean
  retryAgentJobPending: boolean
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
}

export default function SchedulerWorkspaceJobRow({
  job,
  index,
  active,
  serviceAvailable,
  retryAgentJobPending,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
  onRetryAgentJob,
}: SchedulerWorkspaceJobRowProps) {
  const jobStrategyId = getAgentJobStrategyId(job)
  const jobBacktestId = getAgentJobBacktestId(job)
  const jobChangeRequestId = getAgentJobChangeRequestId(job)
  const sourceBacktestId = getAgentJobSourceBacktestId(job)
  const sourceReviewId = getAgentJobSourceReviewId(job)
  const sourceProposalId = getAgentJobSourceProposalId(job)

  return (
    <div className={`job-row job-row--fade${active ? ' job-row--active' : ''}`} style={{ animationDelay: `${index * 26}ms` }}>
      <div className="console-row__main">
        <strong>
          <Bot size={13} />
          任务 · {job.job_type}
        </strong>
        <p>
          {job.result_summary || Object.keys(job.context).join(' · ') || '上下文待写入'}
          {getAgentJobRetryCount(job) > 0 ? ` · 第 ${getAgentJobRetryCount(job)} 次重试` : ''}
          {getAgentJobRetriedFrom(job) ? ` · 源任务 ${getAgentJobRetriedFrom(job)}` : ''}
        </p>
      </div>
      <div className="job-meta">
        <span className={jobStatusToneClass(job.status)}>{jobStatusLabel(job.status)}</span>
        {getAgentJobLinkedReviewPeriod(job) && (
          <span className={reviewPeriodChipClass(getAgentJobLinkedReviewPeriod(job))}>
            {reviewPeriodLabel(getAgentJobLinkedReviewPeriod(job))}
          </span>
        )}
        {getAgentJobLinkedReviewId(job) && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenReviewInspector(getAgentJobLinkedReviewId(job), jobStrategyId)}
          >
            查看结果
          </button>
        )}
        {jobChangeRequestId && jobStrategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenChangeRequest(jobChangeRequestId, jobStrategyId)}>
            查看变更
          </button>
        )}
        {jobBacktestId && jobStrategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenBacktestDetail(jobBacktestId, jobStrategyId)}>
            打开回测
          </button>
        )}
        {sourceBacktestId && jobStrategyId && sourceBacktestId !== jobBacktestId && (
          <button type="button" className="micro-action" onClick={() => onOpenBacktestDetail(sourceBacktestId, jobStrategyId)}>
            来源回测
          </button>
        )}
        {sourceReviewId && jobStrategyId && sourceReviewId !== getAgentJobLinkedReviewId(job) && (
          <button type="button" className="micro-action" onClick={() => onOpenSourceReview(sourceReviewId, jobStrategyId)}>
            来源复盘
          </button>
        )}
        {sourceProposalId && jobStrategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenStrategyProposal(sourceProposalId, jobStrategyId)}>
            来源提案
          </button>
        )}
        {jobStrategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenStrategyActivity(jobStrategyId)}>
            打开策略
          </button>
        )}
        {canRetryAgentJob(job.status) && (
          <button
            type="button"
            className="micro-action"
            disabled={!serviceAvailable || retryAgentJobPending}
            onClick={() => onRetryAgentJob(job.id)}
          >
            重试
          </button>
        )}
        <small>{formatTime(job.updated_at)}</small>
      </div>
    </div>
  )
}
