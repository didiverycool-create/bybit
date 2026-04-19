import type { ReplayWorkspaceProposalFeedListItemProps } from './replayWorkspaceProposalFeedListItemTypes'
import {
  formatTime,
  getChangeRequestStrategyId,
  proposalAcceptBlockedReason,
  proposalManualFollowupMeta,
  proposalStatusLabel,
} from '../utils/app-helpers'

type ReplayWorkspaceProposalFeedListItemMetaSectionProps = Pick<
  ReplayWorkspaceProposalFeedListItemProps,
  | 'item'
  | 'selectedProposalId'
  | 'selectedChangeRequestId'
  | 'selectedBacktestId'
  | 'focusedReviewId'
  | 'aiSchedulerFocusedJobId'
  | 'linkedBacktest'
  | 'linkedReview'
  | 'linkedChangeRequest'
  | 'linkedJob'
  | 'schedulerState'
  | 'serviceAvailable'
  | 'proposalMutationPending'
  | 'retryAgentJobMutationPending'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenAiSchedulerJob'
  | 'onOpenReviewInspector'
  | 'onOpenReplayReview'
  | 'onRetryAgentJob'
  | 'onHandleProposalAction'
>

export default function ReplayWorkspaceProposalFeedListItemMetaSection({
  item,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  focusedReviewId,
  aiSchedulerFocusedJobId,
  linkedBacktest,
  linkedReview,
  linkedChangeRequest,
  linkedJob,
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
}: ReplayWorkspaceProposalFeedListItemMetaSectionProps) {
  const proposalStrategyId = getChangeRequestStrategyId(linkedChangeRequest, item.proposal.strategy_id)
  const manualFollowupMeta = proposalManualFollowupMeta(item.proposal, linkedChangeRequest)
  const focusLabels: string[] = []
  if (selectedProposalId === item.proposal.id) {
    focusLabels.push('当前提案')
  }
  if (selectedChangeRequestId === linkedChangeRequest?.id) {
    focusLabels.push('当前变更')
  }
  if (selectedBacktestId === linkedBacktest?.id) {
    focusLabels.push('当前回测')
  }
  if (focusedReviewId && focusedReviewId === linkedReview?.id) {
    focusLabels.push('当前复盘')
  }
  if (aiSchedulerFocusedJobId === linkedJob?.id) {
    focusLabels.push('当前任务')
  }
  const blockedReason = proposalAcceptBlockedReason(item.proposal.proposal_type, schedulerState)

  return (
    <div className="job-meta">
      <span className="console-tag">{proposalStatusLabel(item.proposal.status)}</span>
      {manualFollowupMeta && <span className="console-tag console-tag--warn">{manualFollowupMeta.label}</span>}
      {focusLabels.map((label) => (
        <span key={`${item.proposal.id}-${label}`} className="console-tag console-tag--warn">
          {label}
        </span>
      ))}
      {linkedChangeRequest && (
        <button
          type="button"
          className="micro-action"
          onClick={() =>
            onOpenChangeRequest(linkedChangeRequest.id, getChangeRequestStrategyId(linkedChangeRequest, item.proposal.strategy_id))
          }
        >
          生成变更
        </button>
      )}
      {linkedBacktest && (
        <button type="button" className="micro-action" onClick={() => onOpenBacktestDetail(linkedBacktest.id, item.proposal.strategy_id)}>
          生成回测
        </button>
      )}
      {linkedReview && (
        <button type="button" className="micro-action" onClick={() => onOpenReplayReview(linkedReview.id, item.proposal.strategy_id, 'selected')}>
          生成复盘
        </button>
      )}
      {linkedChangeRequest?.follow_up_job_id && (
        <button type="button" className="micro-action" onClick={() => onOpenAiSchedulerJob(linkedChangeRequest.follow_up_job_id)}>
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
        (linkedChangeRequest.follow_up_job_status === 'failed' || linkedChangeRequest.follow_up_job_status === 'cancelled') && (
          <button
            type="button"
            className="micro-action"
            disabled={!serviceAvailable || retryAgentJobMutationPending}
            onClick={() => onRetryAgentJob(linkedChangeRequest.follow_up_job_id!, true)}
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
            onClick={() => onRetryAgentJob(linkedJob.id, true)}
          >
            重试跟踪
          </button>
        )}
      <small>{formatTime(item.proposal.created_at)}</small>
      {(item.proposal.status === 'pending' || item.proposal.status === 'testing') && (
        <div className="inline-actions">
          <button
            type="button"
            className="ghost-button ghost-button--inline"
            title={blockedReason ?? manualFollowupMeta?.detail ?? '接受当前提案'}
            disabled={!serviceAvailable || proposalMutationPending || Boolean(blockedReason)}
            onClick={() => onHandleProposalAction(item.proposal.id, 'accept')}
          >
            接受
          </button>
          <button
            type="button"
            className="ghost-button ghost-button--inline"
            disabled={!serviceAvailable || proposalMutationPending}
            onClick={() => onHandleProposalAction(item.proposal.id, 'reject')}
          >
            拒绝
          </button>
        </div>
      )}
    </div>
  )
}

