import type { ReviewDocument } from '../../types'
import type { ReviewInspectorProposalItem } from './types'
import ReviewInspectorProposalListItem from './ReviewInspectorProposalListItem'

type ReviewInspectorProposalListProps = {
  review: ReviewDocument
  proposalItems: ReviewInspectorProposalItem[]
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

export default function ReviewInspectorProposalList({
  review,
  proposalItems,
  serviceAvailable,
  retryPending,
  proposalMutationPending,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktest,
  onOpenJob,
  onRetryJob,
  onProposalAction,
}: ReviewInspectorProposalListProps) {
  return (
    <div className="review-inspector__section">
      <div className="panel-head panel-head--compact">
        <div>
          <span className="section-label">提案</span>
          <h3>本次结果关联的策略建议</h3>
        </div>
        <span className="chip chip--muted">{review.proposals.length} 条</span>
      </div>
      <div className="job-list">
        {proposalItems.map((item, index) => (
          <ReviewInspectorProposalListItem
            key={item.proposal.id}
            item={item}
            index={index}
            serviceAvailable={serviceAvailable}
            retryPending={retryPending}
            proposalMutationPending={proposalMutationPending}
            onOpenReviewInspector={onOpenReviewInspector}
            onOpenChangeRequest={onOpenChangeRequest}
            onOpenBacktest={onOpenBacktest}
            onOpenJob={onOpenJob}
            onRetryJob={onRetryJob}
            onProposalAction={onProposalAction}
          />
        ))}
        {!review.proposals.length && <div className="empty-state empty-state--inline">当前结果没有附带额外提案。</div>}
      </div>
    </div>
  )
}
