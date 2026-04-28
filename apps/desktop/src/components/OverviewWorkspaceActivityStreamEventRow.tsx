import { eventCategoryMeta, formatTime, getAuditBacktestId, getAuditJobId, getAuditLinkedReviewId, getAuditSourceBacktestId, getAuditSourceProposalId, getAuditSourceReviewId, getAuditStrategyId, auditImpactMeta } from '../utils/app-helpers'
import type { OverviewWorkspaceActivityStreamEventRowProps } from './OverviewWorkspaceActivityStreamSection.types'

export default function OverviewWorkspaceActivityStreamEventRow({
  event,
  index,
  onOpenReviewInspector,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
  onOpenAiSchedulerJob,
}: OverviewWorkspaceActivityStreamEventRowProps) {
  const meta = eventCategoryMeta(event.event_type)
  const Icon = meta.icon
  const linkedReviewId = getAuditLinkedReviewId(event.payload)
  const auditJobId = getAuditJobId(event.payload)
  const eventStrategyId = event.strategy_id ?? getAuditStrategyId(event.payload)
  const backtestId = getAuditBacktestId(event.payload)
  const sourceBacktestId = getAuditSourceBacktestId(event.payload)
  const sourceReviewId = getAuditSourceReviewId(event.payload)
  const sourceProposalId = getAuditSourceProposalId(event.payload)
  const impactMeta = auditImpactMeta(event)

  return (
    <div className="console-row console-row--fade" style={{ animationDelay: `${index * 32}ms` }}>
      <div className="console-row__main">
        <strong>
          <Icon size={13} />
          {meta.label} · {event.event_type}
        </strong>
        <p>
          {event.source === 'openclaw' ? 'OpenClaw' : '桌面控制端'} · {event.symbol ?? '系统'} ·{' '}
          {event.strategy_id ?? '无策略'}
        </p>
        {impactMeta && <p>{impactMeta.detail}</p>}
      </div>
      <div className="console-row__meta">
        <span className="console-tag">{event.severity}</span>
        {auditJobId && (
          <button type="button" className="micro-action" onClick={() => onOpenAiSchedulerJob(auditJobId)}>
            打开任务
          </button>
        )}
        {linkedReviewId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenReviewInspector(linkedReviewId, eventStrategyId)}
          >
            查看结果
          </button>
        )}
        {backtestId && eventStrategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenBacktestDetail(backtestId, eventStrategyId)}>
            打开回测
          </button>
        )}
        {sourceBacktestId && eventStrategyId && sourceBacktestId !== backtestId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenBacktestDetail(sourceBacktestId, eventStrategyId)}
          >
            来源回测
          </button>
        )}
        {sourceReviewId && eventStrategyId && sourceReviewId !== linkedReviewId && (
          <button type="button" className="micro-action" onClick={() => onOpenSourceReview(sourceReviewId, eventStrategyId)}>
            来源复盘
          </button>
        )}
        {sourceProposalId && eventStrategyId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenStrategyProposal(sourceProposalId, eventStrategyId)}
          >
            来源提案
          </button>
        )}
        {!linkedReviewId && eventStrategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenStrategyActivity(eventStrategyId)}>
            打开策略
          </button>
        )}
        <small>{formatTime(event.occurred_at)}</small>
      </div>
    </div>
  )
}
