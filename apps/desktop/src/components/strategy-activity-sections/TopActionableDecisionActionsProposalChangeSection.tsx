import type { TopActionableDecisionActionsProposalChangeSectionProps } from './TopActionableDecisionActions.types'

export default function TopActionableDecisionActionsProposalChangeSection({
  showProposalChangeActions,
  activityLatestChangeRequest,
  activityLatestChangeRequestStrategyId,
  activityLatestChangeRequestLinkedBacktestId,
  activityLatestChangeRequestLinkedReviewId,
  activityLatestChangeRequestSourceBacktestId,
  activityLatestChangeRequestSourceBacktestStrategyId,
  activityLatestChangeRequestSourceReviewId,
  activityLatestChangeRequestSourceReviewStrategyId,
  activityLatestChangeRequestSourceProposalId,
  activityLatestChangeRequestSourceProposalStrategyId,
  activityLatestProposalLinkedChangeRequest,
  activityLatestProposalLinkedBacktest,
  activityLatestProposalLinkedReview,
  latestProposalChangeRequestStrategyId,
  latestProposalReviewStrategyId,
  latestProposalJobId,
  latestChangeRequestJobId,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenReplayReview,
  onOpenReviewInspector,
  onOpenSourceReview,
  onOpenAiSchedulerJob,
}: TopActionableDecisionActionsProposalChangeSectionProps) {
  if (!showProposalChangeActions) {
    return null
  }

  return (
    <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="proposal-change">
      {activityLatestProposalLinkedChangeRequest && latestProposalChangeRequestStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_proposal_change_request"
          onClick={() =>
            onOpenChangeRequest(activityLatestProposalLinkedChangeRequest.id, latestProposalChangeRequestStrategyId)
          }
        >
          提案变更
        </button>
      )}
      {activityLatestProposalLinkedBacktest && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_proposal_backtest"
          onClick={() => onOpenBacktestDetail(activityLatestProposalLinkedBacktest.id, activityLatestProposalLinkedBacktest.strategy_id)}
        >
          提案回测
        </button>
      )}
      {activityLatestProposalLinkedReview && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_proposal_review"
          onClick={() => onOpenReplayReview(activityLatestProposalLinkedReview.id, latestProposalReviewStrategyId, 'selected')}
        >
          提案复盘
        </button>
      )}
      {latestProposalJobId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_proposal_job"
          onClick={() => onOpenAiSchedulerJob(latestProposalJobId)}
        >
          提案任务
        </button>
      )}
      {activityLatestChangeRequest && activityLatestChangeRequestStrategyId && activityLatestChangeRequestLinkedBacktestId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_change_request_backtest"
          onClick={() => onOpenBacktestDetail(activityLatestChangeRequestLinkedBacktestId, activityLatestChangeRequestStrategyId)}
        >
          变更回测
        </button>
      )}
      {activityLatestChangeRequest && activityLatestChangeRequestStrategyId && activityLatestChangeRequestLinkedReviewId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_change_request_review"
          onClick={() => onOpenReviewInspector(activityLatestChangeRequestLinkedReviewId, activityLatestChangeRequestStrategyId)}
        >
          变更结果
        </button>
      )}
      {latestChangeRequestJobId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_change_request_job"
          onClick={() => onOpenAiSchedulerJob(latestChangeRequestJobId)}
        >
          变更任务
        </button>
      )}
      {activityLatestChangeRequestSourceBacktestStrategyId && activityLatestChangeRequestSourceBacktestId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_change_request_source_backtest"
          onClick={() =>
            onOpenBacktestDetail(activityLatestChangeRequestSourceBacktestId, activityLatestChangeRequestSourceBacktestStrategyId)
          }
        >
          变更来源回测
        </button>
      )}
      {activityLatestChangeRequestSourceReviewStrategyId && activityLatestChangeRequestSourceReviewId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_change_request_source_review"
          onClick={() =>
            onOpenSourceReview(activityLatestChangeRequestSourceReviewId, activityLatestChangeRequestSourceReviewStrategyId)
          }
        >
          变更来源复盘
        </button>
      )}
      {activityLatestChangeRequestSourceProposalStrategyId && activityLatestChangeRequestSourceProposalId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_change_request_source_proposal"
          onClick={() =>
            onOpenStrategyProposal(
              activityLatestChangeRequestSourceProposalId,
              activityLatestChangeRequestSourceProposalStrategyId,
            )
          }
        >
          变更来源提案
        </button>
      )}
    </div>
  )
}
