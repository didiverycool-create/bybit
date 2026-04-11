import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument, StrategyProposal } from '../../types'
import {
  formatTime,
  getChangeRequestStrategyId,
  proposalManualFollowupMeta,
  proposalOutcomeDetails,
  proposalStatusLabel,
  proposalTypeLabel,
  proposalAcceptBlockedReason,
} from '../../utils/app-helpers'

export type BacktestProposalListItemProps = {
  proposal: StrategyProposal
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedChangeRequest: ChangeRequest | null
  linkedJob: AgentJob | null
  selectedProposalId: string | null
  schedulerState?: { status?: string; freeze_publish?: boolean } | null
  serviceAvailable: boolean
  proposalMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}

export default function BacktestProposalListItem({
  proposal,
  linkedBacktest,
  linkedReview,
  linkedChangeRequest,
  linkedJob,
  selectedProposalId,
  schedulerState,
  serviceAvailable,
  proposalMutationPending,
  retryAgentJobMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenAiSchedulerJob,
  onOpenReplayReview,
  onOpenReviewInspector,
  onRetryAgentJob,
  onHandleProposalAction,
}: BacktestProposalListItemProps) {
  const proposalStrategyId = getChangeRequestStrategyId(linkedChangeRequest, proposal.strategy_id)
  const manualFollowupMeta = proposalManualFollowupMeta(proposal, linkedChangeRequest)
  const outcomeDetails = proposalOutcomeDetails(
    proposal,
    linkedChangeRequest,
    linkedBacktest,
    linkedReview,
    linkedJob,
  )
  const blockedReason = proposalAcceptBlockedReason(proposal.proposal_type, schedulerState)
  const linkedChangeRequestJobId = linkedChangeRequest?.follow_up_job_id ?? null
  const linkedChangeRequestReviewId = linkedChangeRequest?.linked_review_id ?? null

  return (
    <div
      className={`job-row job-row--fade ${selectedProposalId === proposal.id ? 'job-row--active' : ''}`}
    >
      <div className="console-row__main">
        <strong>{proposal.title}</strong>
        <p>
          {proposalTypeLabel(proposal.proposal_type)} · {proposal.expected_impact}
        </p>
        {outcomeDetails.map((detail, detailIndex) => (
          <p key={`${proposal.id}-backtest-outcome-${detailIndex}`}>{detail}</p>
        ))}
      </div>
      <div className="job-meta">
        <span className="console-tag">{proposalStatusLabel(proposal.status)}</span>
        {manualFollowupMeta && (
          <span className="console-tag console-tag--warn">{manualFollowupMeta.label}</span>
        )}
        {selectedProposalId === proposal.id && (
          <span className="console-tag console-tag--warn">来源提案</span>
        )}
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
            onClick={() => onOpenReplayReview(linkedReview.id, proposal.strategy_id, 'selected')}
          >
            生成复盘
          </button>
        )}
        {linkedChangeRequestJobId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenAiSchedulerJob(linkedChangeRequestJobId)}
          >
            打开任务
          </button>
        )}
        {linkedChangeRequestReviewId &&
          proposalStrategyId &&
          (!linkedReview || linkedReview.id !== linkedChangeRequestReviewId) && (
            <button
              type="button"
              className="micro-action"
              onClick={() => onOpenReviewInspector(linkedChangeRequestReviewId, proposalStrategyId)}
            >
              查看结果
            </button>
          )}
        {linkedChangeRequestJobId &&
          (linkedChangeRequest?.follow_up_job_status === 'failed' ||
            linkedChangeRequest?.follow_up_job_status === 'cancelled') && (
            <button
              type="button"
              className="micro-action"
              disabled={!serviceAvailable || retryAgentJobMutationPending}
              onClick={() => onRetryAgentJob(linkedChangeRequestJobId)}
            >
              重试跟踪
            </button>
          )}
        {linkedJob && (!linkedChangeRequestJobId || linkedChangeRequestJobId !== linkedJob.id) && (
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
          (!linkedChangeRequestJobId || linkedChangeRequestJobId !== linkedJob.id) &&
          (linkedJob.status === 'failed' || linkedJob.status === 'cancelled') && (
            <button
              type="button"
              className="micro-action"
              disabled={!serviceAvailable || retryAgentJobMutationPending}
              onClick={() => onRetryAgentJob(linkedJob.id)}
            >
              重试跟踪
            </button>
          )}
        <small>{formatTime(proposal.created_at)}</small>
      </div>
      {(proposal.status === 'pending' || proposal.status === 'testing') && (
        <div className="toggle-card__actions">
          <button
            type="button"
            title={
              blockedReason ??
              manualFollowupMeta?.detail ??
              `接受 ${proposalTypeLabel(proposal.proposal_type)}`
            }
            disabled={!serviceAvailable || proposalMutationPending || Boolean(blockedReason)}
            onClick={() => onHandleProposalAction(proposal.id, 'accept')}
          >
            接受 {proposalTypeLabel(proposal.proposal_type)}
          </button>
          <button
            type="button"
            disabled={!serviceAvailable || proposalMutationPending}
            onClick={() => onHandleProposalAction(proposal.id, 'reject')}
          >
            拒绝
          </button>
        </div>
      )}
    </div>
  )
}
