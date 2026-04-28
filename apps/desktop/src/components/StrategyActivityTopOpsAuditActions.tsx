import type { StrategyActivityTopOpsAuditActionsProps } from './strategyActivityTopOpsTypes'

export default function StrategyActivityTopOpsAuditActions({
  activityLatestAuditJobId,
  activityLatestAuditLinkedReviewId,
  activityLatestAuditChangeRequestId,
  activityLatestAuditBacktestId,
  activityLatestAuditSourceBacktestId,
  activityLatestAuditSourceReviewId,
  activityLatestAuditSourceProposalId,
  activityLatestAuditStrategyId,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
}: StrategyActivityTopOpsAuditActionsProps) {
  if (
    !(
      activityLatestAuditJobId ||
      activityLatestAuditLinkedReviewId ||
      activityLatestAuditChangeRequestId ||
      activityLatestAuditBacktestId ||
      activityLatestAuditSourceBacktestId ||
      activityLatestAuditSourceReviewId ||
      activityLatestAuditSourceProposalId
    )
  ) {
    return null
  }

  return (
    <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="audit">
      {activityLatestAuditJobId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_audit_job"
          onClick={() => onOpenAiSchedulerJob(activityLatestAuditJobId)}
        >
          最新审计任务
        </button>
      )}
      {activityLatestAuditLinkedReviewId && activityLatestAuditStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_audit_result"
          onClick={() => onOpenReviewInspector(activityLatestAuditLinkedReviewId, activityLatestAuditStrategyId)}
        >
          最新审计结果
        </button>
      )}
      {activityLatestAuditChangeRequestId && activityLatestAuditStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_audit_change_request"
          onClick={() => onOpenChangeRequest(activityLatestAuditChangeRequestId, activityLatestAuditStrategyId)}
        >
          最新审计变更
        </button>
      )}
      {activityLatestAuditBacktestId && activityLatestAuditStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_audit_backtest"
          onClick={() => onOpenBacktestDetail(activityLatestAuditBacktestId, activityLatestAuditStrategyId)}
        >
          最新审计回测
        </button>
      )}
      {activityLatestAuditSourceBacktestId &&
        activityLatestAuditStrategyId &&
        activityLatestAuditSourceBacktestId !== activityLatestAuditBacktestId && (
          <button
            type="button"
            className="micro-action"
            data-strategy-activity-top-action-key="latest_audit_source_backtest"
            onClick={() => onOpenBacktestDetail(activityLatestAuditSourceBacktestId, activityLatestAuditStrategyId)}
          >
            最新来源回测
          </button>
        )}
      {activityLatestAuditSourceReviewId &&
        activityLatestAuditStrategyId &&
        activityLatestAuditSourceReviewId !== activityLatestAuditLinkedReviewId && (
          <button
            type="button"
            className="micro-action"
            data-strategy-activity-top-action-key="latest_audit_source_review"
            onClick={() => onOpenSourceReview(activityLatestAuditSourceReviewId, activityLatestAuditStrategyId)}
          >
            最新来源复盘
          </button>
        )}
      {activityLatestAuditSourceProposalId && activityLatestAuditStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_audit_source_proposal"
          onClick={() => onOpenStrategyProposal(activityLatestAuditSourceProposalId, activityLatestAuditStrategyId)}
        >
          最新来源提案
        </button>
      )}
    </div>
  )
}
