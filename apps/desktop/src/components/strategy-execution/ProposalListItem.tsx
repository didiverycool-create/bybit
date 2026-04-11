import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
} from '../../types'
import {
  formatTime,
  getChangeRequestStrategyId,
  proposalManualFollowupMeta,
  proposalOutcomeDetails,
  proposalStatusLabel,
  proposalTypeLabel,
} from '../../utils/app-helpers'

export type ProposalListItemProps = {
  proposal: StrategyProposal
  index: number
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedChangeRequest: ChangeRequest | null
  linkedJob: AgentJob | null
  focusLabels: string[]
  serviceAvailable: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string, options?: { focusJob?: boolean }) => void
}

export default function ProposalListItem({
  proposal,
  index,
  linkedBacktest,
  linkedReview,
  linkedChangeRequest,
  linkedJob,
  focusLabels,
  serviceAvailable,
  retryAgentJobMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onRetryAgentJob,
}: ProposalListItemProps) {
  const proposalStrategyId = getChangeRequestStrategyId(linkedChangeRequest, proposal.strategy_id)
  const manualFollowupMeta = proposalManualFollowupMeta(proposal, linkedChangeRequest)
  const outcomeDetails = proposalOutcomeDetails(
    proposal,
    linkedChangeRequest,
    linkedBacktest,
    linkedReview,
    linkedJob,
  )

  return (
    <div
      className={`job-row job-row--fade ${focusLabels.length ? 'job-row--active' : ''}`}
      style={{ animationDelay: `${index * 28}ms` }}
    >
      <div className="console-row__main">
        <strong>{proposal.title}</strong>
        <p>{proposalTypeLabel(proposal.proposal_type)} · {proposal.expected_impact}</p>
        {outcomeDetails.map((detail, detailIndex) => (
          <p key={`${proposal.id}-strategy-outcome-${detailIndex}`}>{detail}</p>
        ))}
      </div>
      <div className="job-meta">
        <span className="console-tag">{proposalStatusLabel(proposal.status)}</span>
        {manualFollowupMeta && (
          <span className="console-tag console-tag--warn">{manualFollowupMeta.label}</span>
        )}
        {focusLabels.map((label) => (
          <span key={`${proposal.id}-${label}`} className="console-tag console-tag--warn">
            {label}
          </span>
        ))}
        {linkedChangeRequest && (
          <button
            type="button"
            className="micro-action"
            onClick={() =>
              onOpenChangeRequest(
                linkedChangeRequest.id,
                getChangeRequestStrategyId(linkedChangeRequest, proposal.strategy_id),
              )
            }
          >
            生成变更
          </button>
        )}
        {linkedBacktest && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenBacktestDetail(linkedBacktest.id, proposal.strategy_id)}
          >
            生成回测
          </button>
        )}
        {linkedReview && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenReviewInspector(linkedReview.id, proposal.strategy_id)}
          >
            生成复盘
          </button>
        )}
        {linkedChangeRequest?.follow_up_job_id && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenAiSchedulerJob(linkedChangeRequest.follow_up_job_id)}
          >
            打开任务
          </button>
        )}
        {linkedChangeRequest?.linked_review_id &&
          proposalStrategyId &&
          (!linkedReview || linkedReview.id !== linkedChangeRequest.linked_review_id) && (
            <button
              type="button"
              className="micro-action"
              onClick={() => onOpenReviewInspector(linkedChangeRequest.linked_review_id, proposalStrategyId)}
            >
              查看结果
            </button>
          )}
        {linkedChangeRequest?.follow_up_job_id &&
          (linkedChangeRequest.follow_up_job_status === 'failed' ||
            linkedChangeRequest.follow_up_job_status === 'cancelled') && (
            <button
              type="button"
              className="micro-action"
              disabled={!serviceAvailable || retryAgentJobMutationPending}
              onClick={() => {
                void onRetryAgentJob(linkedChangeRequest.follow_up_job_id, {
                  focusJob: true,
                })
              }}
            >
              重试跟踪
            </button>
          )}
        {linkedJob &&
          (!linkedChangeRequest?.follow_up_job_id || linkedChangeRequest.follow_up_job_id !== linkedJob.id) && (
            <button
              type="button"
              className="micro-action"
              onClick={() => onOpenAiSchedulerJob(linkedJob.id)}
            >
              打开任务
            </button>
          )}
        {linkedJob?.linked_review_id &&
          proposalStrategyId &&
          (!linkedReview || linkedReview.id !== linkedJob.linked_review_id) && (
            <button
              type="button"
              className="micro-action"
              onClick={() => onOpenReviewInspector(linkedJob.linked_review_id, proposalStrategyId)}
            >
              查看结果
            </button>
          )}
        {linkedJob &&
          (!linkedChangeRequest?.follow_up_job_id || linkedChangeRequest.follow_up_job_id !== linkedJob.id) &&
          (linkedJob.status === 'failed' || linkedJob.status === 'cancelled') && (
            <button
              type="button"
              className="micro-action"
              disabled={!serviceAvailable || retryAgentJobMutationPending}
              onClick={() => {
                void onRetryAgentJob(linkedJob.id, { focusJob: true })
              }}
            >
              重试跟踪
            </button>
          )}
        <small>{formatTime(proposal.created_at)}</small>
      </div>
    </div>
  )
}
