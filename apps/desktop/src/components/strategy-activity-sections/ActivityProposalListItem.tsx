import type { ActivityProposalListItemProps } from './ActivityProposalList.types'
import {
  formatDateTime,
  getChangeRequestStrategyId,
  proposalManualFollowupMeta,
  proposalOutcomeDetails,
  proposalStatusLabel,
  proposalTypeLabel,
} from '../../utils/app-helpers'

export default function ActivityProposalListItem({
  proposal,
  linkedState,
  activityLatestProposal,
  activityLatestActionableProposal,
  selectedProposalId,
  serviceAvailable,
  proposalMutationPending,
  retryAgentJobMutationPending,
  proposalFocusLabels,
  getProposalBlockedReason,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenReplayReview,
  onOpenReviewInspector,
  onOpenAiSchedulerJob,
  onRetryAgentJob,
  onHandleProposalAction,
}: ActivityProposalListItemProps) {
  const linkedBacktest = linkedState.linkedBacktest
  const linkedReview = linkedState.linkedReview
  const linkedChangeRequest = linkedState.linkedChangeRequest
  const linkedJob = linkedState.linkedJob
  const proposalStrategyId = getChangeRequestStrategyId(linkedChangeRequest, proposal.strategy_id)
  const manualFollowupMeta = proposalManualFollowupMeta(proposal, linkedChangeRequest)
  const outcomeDetails = proposalOutcomeDetails(
    proposal,
    linkedChangeRequest,
    linkedBacktest,
    linkedReview,
    linkedJob,
  )
  const focusLabels = proposalFocusLabels(proposal, linkedChangeRequest, linkedBacktest, linkedReview, linkedJob)
  const blockedReason = getProposalBlockedReason(proposal)

  return (
    <div
      key={proposal.id}
      className={`trade-row trade-row--fade ${focusLabels.length ? 'job-row--active' : ''}`}
      data-strategy-activity-row-id={proposal.id}
    >
      <div className="console-row__main">
        <strong>{proposal.title}</strong>
        <p>
          {proposalTypeLabel(proposal.proposal_type)} · {proposal.expected_impact}
        </p>
        {outcomeDetails.map((detail, detailIndex) => (
          <p key={`${proposal.id}-outcome-${detailIndex}`}>{detail}</p>
        ))}
      </div>
      <div className="trade-meta">
        <span className="console-tag">{proposalStatusLabel(proposal.status)}</span>
        {activityLatestProposal?.id === proposal.id && <span className="console-tag console-tag--warn">当前最新</span>}
        {activityLatestActionableProposal?.id === proposal.id && (
          <span className="console-tag console-tag--warn">当前可处理</span>
        )}
        {manualFollowupMeta && <span className="console-tag console-tag--warn">{manualFollowupMeta.label}</span>}
        {selectedProposalId === proposal.id && <span className="console-tag console-tag--warn">当前提案</span>}
        {focusLabels.map((label) => (
          <span key={`${proposal.id}-${label}`} className="console-tag console-tag--warn">
            {label}
          </span>
        ))}
        <button type="button" className="micro-action" onClick={() => onOpenStrategyProposal(proposal.id, proposal.strategy_id)}>
          打开提案
        </button>
        {linkedChangeRequest && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenChangeRequest(linkedChangeRequest.id, proposalStrategyId)}
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
        {linkedChangeRequest?.follow_up_job_id && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenAiSchedulerJob(linkedChangeRequest.follow_up_job_id!)}
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
              onClick={() => onRetryAgentJob(linkedChangeRequest.follow_up_job_id!)}
            >
              重试跟踪
            </button>
          )}
        {linkedJob &&
          (!linkedChangeRequest?.follow_up_job_id || linkedChangeRequest.follow_up_job_id !== linkedJob.id) && (
            <button type="button" className="micro-action" onClick={() => onOpenAiSchedulerJob(linkedJob.id)}>
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
              onClick={() => onRetryAgentJob(linkedJob.id)}
            >
              重试跟踪
            </button>
          )}
        <small>{formatDateTime(proposal.created_at)}</small>
      </div>
      {(proposal.status === 'pending' || proposal.status === 'testing') && (
        <div className="toggle-card__actions">
          <button
            type="button"
            className="ghost-button"
            title={blockedReason ?? manualFollowupMeta?.detail ?? '接受当前提案'}
            disabled={!serviceAvailable || proposalMutationPending || Boolean(blockedReason)}
            onClick={() => onHandleProposalAction(proposal.id, 'accept')}
          >
            接受
          </button>
          <button
            type="button"
            className="ghost-button"
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
