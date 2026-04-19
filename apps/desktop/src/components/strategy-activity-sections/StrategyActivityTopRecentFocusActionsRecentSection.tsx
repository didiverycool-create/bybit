import type { StrategyActivityTopRecentFocusActionsRecentSectionProps } from './strategyActivityTopRecentFocusActionsTypes'

export default function StrategyActivityTopRecentFocusActionsRecentSection({
  showLatestFocusActions,
  strategyId,
  activityLatestProposal,
  activityLatestChangeRequest,
  activityLatestChangeRequestStrategyId,
  activityLatestBacktest,
  activityLatestPrimaryReviewStrategyId,
  activityLatestTrackingReviewStrategyId,
  latestPrimaryReviewOpenId,
  latestTrackingReviewOpenId,
  latestTrackingJobOpenId,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenReplayReview,
  onOpenReviewInspector,
  onOpenAiSchedulerJob,
}: StrategyActivityTopRecentFocusActionsRecentSectionProps) {
  if (!showLatestFocusActions) {
    return null
  }

  return (
    <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="latest-focus">
      {activityLatestProposal && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_proposal_open"
          onClick={() => onOpenStrategyProposal(activityLatestProposal.id, activityLatestProposal.strategy_id)}
        >
          最近提案
        </button>
      )}
      {activityLatestChangeRequest && activityLatestChangeRequestStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_change_request_open"
          onClick={() => onOpenChangeRequest(activityLatestChangeRequest.id, activityLatestChangeRequestStrategyId)}
        >
          最近变更
        </button>
      )}
      {activityLatestBacktest && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_backtest_open"
          onClick={() => onOpenBacktestDetail(activityLatestBacktest.id, strategyId)}
        >
          最近回测
        </button>
      )}
      {latestPrimaryReviewOpenId && activityLatestPrimaryReviewStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_primary_review_open"
          onClick={() => onOpenReplayReview(latestPrimaryReviewOpenId, activityLatestPrimaryReviewStrategyId, 'selected')}
        >
          最近复盘
        </button>
      )}
      {latestTrackingReviewOpenId && activityLatestTrackingReviewStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_review_open"
          onClick={() => onOpenReviewInspector(latestTrackingReviewOpenId, activityLatestTrackingReviewStrategyId)}
        >
          最近跟踪
        </button>
      )}
      {latestTrackingJobOpenId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_job_open"
          onClick={() => onOpenAiSchedulerJob(latestTrackingJobOpenId)}
        >
          最近任务
        </button>
      )}
    </div>
  )
}
