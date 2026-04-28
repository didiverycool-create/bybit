import type { ExecutionEvent } from '../../types'
import AuditWorkspaceEventRow from './AuditWorkspaceEventRow'

type AuditWorkspaceEventListProps = {
  filteredAuditEvents: ExecutionEvent[]
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
}

export default function AuditWorkspaceEventList({
  filteredAuditEvents,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
}: AuditWorkspaceEventListProps) {
  return (
    <div className="audit-list audit-list--compact">
      {filteredAuditEvents.map((item, index) => (
        <AuditWorkspaceEventRow
          key={item.id}
          item={item}
          index={index}
          onOpenAiSchedulerJob={onOpenAiSchedulerJob}
          onOpenReviewInspector={onOpenReviewInspector}
          onOpenBacktestDetail={onOpenBacktestDetail}
          onOpenSourceReview={onOpenSourceReview}
          onOpenStrategyProposal={onOpenStrategyProposal}
          onOpenStrategyActivity={onOpenStrategyActivity}
        />
      ))}
      {filteredAuditEvents.length === 0 && <div className="empty-state empty-state--inline">当前筛选下没有审计事件</div>}
    </div>
  )
}
