import { Sparkles } from 'lucide-react'

import type { ReviewInspectorProposalItem } from './types'
import { formatDateTime, proposalStatusLabel, proposalTypeLabel } from '../../utils/app-helpers'

type ReviewInspectorProposalListItemProps = {
  item: ReviewInspectorProposalItem
  index: number
  serviceAvailable: boolean
  retryPending: boolean
  proposalMutationPending: boolean
  onOpenReviewInspector: (reviewId: string, strategyId: string) => void
  onOpenChangeRequest: (changeRequestId: string, strategyId: string) => void
  onOpenBacktest: (backtestId: string, strategyId: string) => void
  onOpenJob: (jobId: string) => void
  onRetryJob: (jobId: string) => void
  onProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}

export default function ReviewInspectorProposalListItem({
  item,
  index,
  serviceAvailable,
  retryPending,
  proposalMutationPending,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktest,
  onOpenJob,
  onRetryJob,
  onProposalAction,
}: ReviewInspectorProposalListItemProps) {
  return (
    <div
      className={`job-row job-row--fade ${item.focusLabels.length ? 'job-row--active' : ''}`}
      style={{ animationDelay: `${index * 24}ms` }}
    >
      <div className="console-row__main">
        <strong>
          <Sparkles size={13} />
          {item.proposal.title}
        </strong>
        <p>
          {proposalTypeLabel(item.proposal.proposal_type)} · {item.proposal.expected_impact}
        </p>
        {item.outcomeDetails.map((detail, detailIndex) => (
          <p key={`${item.proposal.id}-review-inspector-outcome-${detailIndex}`}>{detail}</p>
        ))}
      </div>
      <div className="job-meta">
        <span className="console-tag">{proposalStatusLabel(item.proposal.status)}</span>
        {item.manualFollowupMeta && <span className="console-tag console-tag--warn">{item.manualFollowupMeta.label}</span>}
        {item.isLatestActionable && <span className="console-tag console-tag--warn">当前可处理</span>}
        {item.focusLabels.map((label) => (
          <span key={`${item.proposal.id}-${label}`} className="console-tag console-tag--warn">
            {label}
          </span>
        ))}
        {item.linkedChangeRequest && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenChangeRequest(item.linkedChangeRequest!.id, item.proposalStrategyId)}
          >
            生成变更
          </button>
        )}
        {item.linkedBacktest && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenBacktest(item.linkedBacktest!.id, item.proposal.strategy_id)}
          >
            生成回测
          </button>
        )}
        {item.linkedReview && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenReviewInspector(item.linkedReview!.id, item.proposal.strategy_id)}
          >
            生成复盘
          </button>
        )}
        {item.linkedChangeRequest?.follow_up_job_id && (
          <button type="button" className="micro-action" onClick={() => onOpenJob(item.linkedChangeRequest!.follow_up_job_id!)}>
            打开任务
          </button>
        )}
        {item.linkedChangeRequest?.linked_review_id &&
          item.proposalStrategyId &&
          (!item.linkedReview || item.linkedReview.id !== item.linkedChangeRequest.linked_review_id) && (
            <button
              type="button"
              className="micro-action"
              onClick={() => onOpenReviewInspector(item.linkedChangeRequest!.linked_review_id!, item.proposalStrategyId)}
            >
              查看结果
            </button>
          )}
        {item.linkedChangeRequest?.follow_up_job_id &&
          (item.linkedChangeRequest.follow_up_job_status === 'failed' ||
            item.linkedChangeRequest.follow_up_job_status === 'cancelled') && (
            <button
              type="button"
              className="micro-action"
              disabled={!serviceAvailable || retryPending}
              onClick={() => onRetryJob(item.linkedChangeRequest!.follow_up_job_id!)}
            >
              重试跟踪
            </button>
          )}
        {item.linkedJob &&
          (!item.linkedChangeRequest?.follow_up_job_id || item.linkedChangeRequest.follow_up_job_id !== item.linkedJob.id) && (
            <button type="button" className="micro-action" onClick={() => onOpenJob(item.linkedJob!.id)}>
              打开任务
            </button>
          )}
        {item.linkedJob?.linked_review_id &&
          item.proposalStrategyId &&
          (!item.linkedReview || item.linkedReview.id !== item.linkedJob.linked_review_id) && (
            <button
              type="button"
              className="micro-action"
              onClick={() => onOpenReviewInspector(item.linkedJob!.linked_review_id!, item.proposalStrategyId)}
            >
              查看结果
            </button>
          )}
        {item.linkedJob &&
          (!item.linkedChangeRequest?.follow_up_job_id || item.linkedChangeRequest.follow_up_job_id !== item.linkedJob.id) &&
          (item.linkedJob.status === 'failed' || item.linkedJob.status === 'cancelled') && (
            <button
              type="button"
              className="micro-action"
              disabled={!serviceAvailable || retryPending}
              onClick={() => onRetryJob(item.linkedJob!.id)}
            >
              重试跟踪
            </button>
          )}
        <small>{formatDateTime(item.proposal.created_at)}</small>
      </div>
      {(item.proposal.status === 'pending' || item.proposal.status === 'testing') && (
        <div className="toggle-card__actions">
          <button
            type="button"
            title={item.blockedReason ?? item.manualFollowupMeta?.detail ?? `接受 ${proposalTypeLabel(item.proposal.proposal_type)}`}
            disabled={!serviceAvailable || proposalMutationPending || Boolean(item.blockedReason)}
            onClick={() => onProposalAction(item.proposal.id, 'accept')}
          >
            接受 {proposalTypeLabel(item.proposal.proposal_type)}
          </button>
          <button
            type="button"
            disabled={!serviceAvailable || proposalMutationPending}
            onClick={() => onProposalAction(item.proposal.id, 'reject')}
          >
            拒绝
          </button>
        </div>
      )}
    </div>
  )
}
