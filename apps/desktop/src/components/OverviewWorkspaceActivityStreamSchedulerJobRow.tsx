import { Bot } from 'lucide-react'

import {
  agentJobContextMeta,
  formatTime,
  getAgentJobBacktestId,
  getAgentJobLinkedReviewId,
  getAgentJobSourceBacktestId,
  getAgentJobSourceProposalId,
  getAgentJobSourceReviewId,
  getAgentJobStrategyId,
  jobStatusLabel,
} from '../utils/app-helpers'
import type { OverviewWorkspaceActivityStreamSchedulerJobRowProps } from './OverviewWorkspaceActivityStreamSection.types'

export default function OverviewWorkspaceActivityStreamSchedulerJobRow({
  job,
  onOpenReviewInspector,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
}: OverviewWorkspaceActivityStreamSchedulerJobRowProps) {
  const jobStrategyId = getAgentJobStrategyId(job)
  const jobBacktestId = getAgentJobBacktestId(job)
  const sourceBacktestId = getAgentJobSourceBacktestId(job)
  const sourceReviewId = getAgentJobSourceReviewId(job)
  const sourceProposalId = getAgentJobSourceProposalId(job)
  const linkedReviewId = getAgentJobLinkedReviewId(job)
  const contextMeta = agentJobContextMeta(job)

  return (
    <div className="console-row console-row--highlight">
      <div className="console-row__main">
        <strong>
          <Bot size={13} />
          任务 · {job.job_type}
        </strong>
        <p>{jobStatusLabel(job.status)} · 写回 {job.writeback_target}</p>
        {contextMeta && <p>{contextMeta}</p>}
      </div>
      <div className="console-row__meta">
        <span className="console-tag console-tag--warn">当前任务</span>
        {linkedReviewId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenReviewInspector(linkedReviewId, jobStrategyId)}
          >
            查看结果
          </button>
        )}
        {jobBacktestId && jobStrategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenBacktestDetail(jobBacktestId, jobStrategyId)}>
            打开回测
          </button>
        )}
        {sourceBacktestId && jobStrategyId && sourceBacktestId !== jobBacktestId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenBacktestDetail(sourceBacktestId, jobStrategyId)}
          >
            来源回测
          </button>
        )}
        {sourceReviewId && jobStrategyId && sourceReviewId !== linkedReviewId && (
          <button type="button" className="micro-action" onClick={() => onOpenSourceReview(sourceReviewId, jobStrategyId)}>
            来源复盘
          </button>
        )}
        {sourceProposalId && jobStrategyId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenStrategyProposal(sourceProposalId, jobStrategyId)}
          >
            来源提案
          </button>
        )}
        {jobStrategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenStrategyActivity(jobStrategyId)}>
            打开策略
          </button>
        )}
        <small>{formatTime(job.updated_at)}</small>
      </div>
    </div>
  )
}
