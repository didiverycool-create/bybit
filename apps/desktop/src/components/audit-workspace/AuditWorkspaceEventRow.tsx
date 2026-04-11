import type { ExecutionEvent } from '../../types'
import {
  auditImpactMeta,
  eventCategoryMeta,
  formatTime,
  getAuditBacktestId,
  getAuditJobId,
  getAuditLinkedReviewId,
  getAuditSourceBacktestId,
  getAuditSourceProposalId,
  getAuditSourceReviewId,
  getAuditStrategyId,
  summarizeAuditEvent,
} from '../../utils/app-helpers'

type AuditWorkspaceEventRowProps = {
  item: ExecutionEvent
  index: number
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
}

export default function AuditWorkspaceEventRow({
  item,
  index,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
}: AuditWorkspaceEventRowProps) {
  const meta = eventCategoryMeta(item.event_type)
  const MetaIcon = meta.icon
  const auditLinkedReviewId = getAuditLinkedReviewId(item.payload)
  const auditJobId = getAuditJobId(item.payload)
  const auditStrategyId = getAuditStrategyId(item.payload)
  const auditBacktestId = getAuditBacktestId(item.payload)
  const auditSourceBacktestId = getAuditSourceBacktestId(item.payload)
  const auditSourceReviewId = getAuditSourceReviewId(item.payload)
  const auditSourceProposalId = getAuditSourceProposalId(item.payload)
  const impactMeta = auditImpactMeta(item)

  return (
    <div key={item.id} className="audit-row audit-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
      <div className="console-row__main">
        <strong>
          <MetaIcon size={13} />
          {meta.label} · {item.event_type}
        </strong>
        <p>
          {item.source} · {item.symbol ?? '全局'} · {summarizeAuditEvent(item)}
        </p>
        {impactMeta && <p>{impactMeta.detail}</p>}
      </div>
      <div className="trade-meta">
        <span className={`status-chip status-${item.severity}`}>{item.severity}</span>
        {auditJobId && (
          <button type="button" className="micro-action" onClick={() => onOpenAiSchedulerJob(auditJobId)}>
            打开任务
          </button>
        )}
        {auditLinkedReviewId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenReviewInspector(auditLinkedReviewId, auditStrategyId)}
          >
            查看结果
          </button>
        )}
        {auditBacktestId && auditStrategyId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenBacktestDetail(auditBacktestId, auditStrategyId)}
          >
            打开回测
          </button>
        )}
        {auditSourceBacktestId && auditStrategyId && auditSourceBacktestId !== auditBacktestId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenBacktestDetail(auditSourceBacktestId, auditStrategyId)}
          >
            来源回测
          </button>
        )}
        {auditSourceReviewId && auditStrategyId && auditSourceReviewId !== auditLinkedReviewId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenSourceReview(auditSourceReviewId, auditStrategyId)}
          >
            来源复盘
          </button>
        )}
        {auditSourceProposalId && auditStrategyId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenStrategyProposal(auditSourceProposalId, auditStrategyId)}
          >
            来源提案
          </button>
        )}
        {!auditLinkedReviewId && auditStrategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenStrategyActivity(auditStrategyId)}>
            打开策略
          </button>
        )}
        <small>{formatTime(item.occurred_at)}</small>
      </div>
    </div>
  )
}
