import type { ReviewDocument } from '../types'
import {
  ReviewInspectorHeader,
  ReviewInspectorProposalList,
  ReviewInspectorSummarySection,
  type ReviewInspectorDecisionMeta,
  type ReviewInspectorLineageMeta,
  type ReviewInspectorProposalItem,
} from './review-inspector'

type ReviewInspectorPanelProps = {
  open: boolean
  review: ReviewDocument | null
  strategyId: string | null
  strategyLabel: string | null
  lineageMeta: ReviewInspectorLineageMeta
  decisionMeta: ReviewInspectorDecisionMeta
  proposalItems: ReviewInspectorProposalItem[]
  serviceAvailable: boolean
  backtestPending: boolean
  retryPending: boolean
  proposalMutationPending: boolean
  onClose: () => void
  onOpenReplay: () => void
  onOpenReviewInspector: (reviewId: string, strategyId: string) => void
  onOpenStrategy: (strategyId: string) => void
  onOpenChangeRequest: (changeRequestId: string, strategyId: string) => void
  onOpenBacktest: (backtestId: string, strategyId: string) => void
  onOpenSourceReview: (reviewId: string, strategyId: string) => void
  onOpenProposal: (proposalId: string, strategyId: string) => void
  onOpenJob: (jobId: string) => void
  onRerunBacktest: (review: ReviewDocument) => void
  onRetryJob: (jobId: string) => void
  onProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}

export default function ReviewInspectorPanel({
  open,
  review,
  strategyId,
  strategyLabel,
  lineageMeta,
  decisionMeta,
  proposalItems,
  serviceAvailable,
  backtestPending,
  retryPending,
  proposalMutationPending,
  onClose,
  onOpenReplay,
  onOpenReviewInspector,
  onOpenStrategy,
  onOpenChangeRequest,
  onOpenBacktest,
  onOpenSourceReview,
  onOpenProposal,
  onOpenJob,
  onRerunBacktest,
  onRetryJob,
  onProposalAction,
}: ReviewInspectorPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel floating-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-label="复盘结果详情窗口"
        onClick={(event) => event.stopPropagation()}
      >
        <ReviewInspectorHeader
          review={review}
          strategyId={strategyId}
          strategyLabel={strategyLabel}
          onClose={onClose}
          onOpenReplay={onOpenReplay}
          onOpenStrategy={onOpenStrategy}
          onOpenChangeRequest={onOpenChangeRequest}
          onOpenBacktest={onOpenBacktest}
          onOpenSourceReview={onOpenSourceReview}
          onOpenProposal={onOpenProposal}
          onOpenJob={onOpenJob}
        />

        <div className="floating-panel__body">
          {!review && <div className="empty-state empty-state--inline">当前结果暂未加载完成，请稍后再试。</div>}
          {review && (
            <>
              <ReviewInspectorSummarySection
                review={review}
                lineageMeta={lineageMeta}
                decisionMeta={decisionMeta}
                serviceAvailable={serviceAvailable}
                backtestPending={backtestPending}
                onRerunBacktest={onRerunBacktest}
              />
              <ReviewInspectorProposalList
                review={review}
                proposalItems={proposalItems}
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
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
