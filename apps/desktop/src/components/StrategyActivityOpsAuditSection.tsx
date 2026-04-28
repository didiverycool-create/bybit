import type { StrategyActivityOpsAuditSectionProps } from './strategyActivityOpsSectionTypes'
import {
  auditImpactMeta,
  formatDateTime,
  getAuditBacktestId,
  getAuditChangeRequestId,
  getAuditJobId,
  getAuditLinkedReviewId,
  getAuditSourceBacktestId,
  getAuditSourceProposalId,
  getAuditSourceReviewId,
  getAuditStrategyId,
  summarizeAuditEvent,
} from '../utils/app-helpers'

export default function StrategyActivityOpsAuditSection({
  strategyId,
  strategyActivityLatestAuditSupplemented,
  strategyActivityAuditEvents,
  activityLatestAuditEvent,
  onOpenAuditSection,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
}: StrategyActivityOpsAuditSectionProps) {
  return (
    <>
      {strategyActivityLatestAuditSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_audit_supplemented_hint">
          顶部最新审计事件不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一审计链路排障。
        </p>
      )}
      <div className="trade-list trade-list--dense" data-strategy-activity-action-group="audit">
        {strategyActivityAuditEvents.map((event) => {
          const auditJobId = getAuditJobId(event.payload)
          const auditChangeRequestId = getAuditChangeRequestId(event.payload)
          const auditLinkedReviewId = getAuditLinkedReviewId(event.payload)
          const auditStrategyId = getAuditStrategyId(event.payload) ?? strategyId
          const auditBacktestId = getAuditBacktestId(event.payload)
          const auditSourceBacktestId = getAuditSourceBacktestId(event.payload)
          const auditSourceReviewId = getAuditSourceReviewId(event.payload)
          const auditSourceProposalId = getAuditSourceProposalId(event.payload)
          const impactMeta = auditImpactMeta(event)
          return (
            <div key={event.id} className="trade-row trade-row--fade" data-strategy-activity-row-id={event.id}>
              <div className="console-row__main">
                <strong>{event.event_type}</strong>
                <p>{summarizeAuditEvent(event)}</p>
                {impactMeta && <p>{impactMeta.detail}</p>}
              </div>
              <div className="trade-meta">
                {activityLatestAuditEvent?.id === event.id && (
                  <span className="console-tag console-tag--warn">当前最新</span>
                )}
                <span className="console-tag">{event.severity}</span>
                <button type="button" className="micro-action" onClick={() => onOpenAuditSection(event.symbol ?? null)}>
                  审计页
                </button>
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
                {auditChangeRequestId && auditStrategyId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenChangeRequest(auditChangeRequestId, auditStrategyId)}
                  >
                    查看变更
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
                <small>{formatDateTime(event.occurred_at)}</small>
              </div>
            </div>
          )
        })}
        {!strategyActivityAuditEvents.length && (
          <div className="empty-state empty-state--inline">当前没有可展示的策略审计事件。</div>
        )}
      </div>
    </>
  )
}
