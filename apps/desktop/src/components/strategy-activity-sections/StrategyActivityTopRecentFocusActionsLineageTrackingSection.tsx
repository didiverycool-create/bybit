import type { StrategyActivityTopRecentFocusActionsLineageTrackingSectionProps } from './strategyActivityTopRecentFocusActionsLineageTypes'

export default function StrategyActivityTopRecentFocusActionsLineageTrackingSection({
  activityLatestTrackingJobLinkedReviewId,
  activityLatestTrackingJobChangeRequestId,
  activityLatestTrackingJobBacktestId,
  activityLatestTrackingJobSourceChangeRequestId,
  activityLatestTrackingJobSourceBacktestId,
  activityLatestTrackingJobSourceReviewId,
  activityLatestTrackingJobSourceProposalId,
  activityLatestTrackingJobStrategyId,
  latestTrackingReviewSourceJobId,
  latestTrackingReviewSourceChangeRequestId,
  latestTrackingReviewSourceBacktestId,
  latestTrackingReviewSourceReviewId,
  latestTrackingReviewSourceProposalId,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
}: StrategyActivityTopRecentFocusActionsLineageTrackingSectionProps) {
  return (
    <>
      {latestTrackingReviewSourceJobId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_review_source_job"
          onClick={() => onOpenAiSchedulerJob(latestTrackingReviewSourceJobId)}
        >
          跟踪来源任务
        </button>
      )}
      {latestTrackingReviewSourceChangeRequestId && activityLatestTrackingJobStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_review_source_change_request"
          onClick={() => onOpenChangeRequest(latestTrackingReviewSourceChangeRequestId, activityLatestTrackingJobStrategyId)}
        >
          跟踪来源变更
        </button>
      )}
      {latestTrackingReviewSourceBacktestId && activityLatestTrackingJobStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_review_source_backtest"
          onClick={() => onOpenBacktestDetail(latestTrackingReviewSourceBacktestId, activityLatestTrackingJobStrategyId)}
        >
          跟踪来源回测
        </button>
      )}
      {latestTrackingReviewSourceReviewId && activityLatestTrackingJobStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_review_source_review"
          onClick={() => onOpenSourceReview(latestTrackingReviewSourceReviewId, activityLatestTrackingJobStrategyId)}
        >
          跟踪来源复盘
        </button>
      )}
      {latestTrackingReviewSourceProposalId && activityLatestTrackingJobStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_review_source_proposal"
          onClick={() => onOpenStrategyProposal(latestTrackingReviewSourceProposalId, activityLatestTrackingJobStrategyId)}
        >
          跟踪来源提案
        </button>
      )}
      {activityLatestTrackingJobLinkedReviewId && activityLatestTrackingJobStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_job_result"
          onClick={() => onOpenReviewInspector(activityLatestTrackingJobLinkedReviewId, activityLatestTrackingJobStrategyId)}
        >
          任务结果
        </button>
      )}
      {activityLatestTrackingJobChangeRequestId && activityLatestTrackingJobStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_job_change_request"
          onClick={() => onOpenChangeRequest(activityLatestTrackingJobChangeRequestId, activityLatestTrackingJobStrategyId)}
        >
          任务变更
        </button>
      )}
      {activityLatestTrackingJobBacktestId && activityLatestTrackingJobStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_job_backtest"
          onClick={() => onOpenBacktestDetail(activityLatestTrackingJobBacktestId, activityLatestTrackingJobStrategyId)}
        >
          任务回测
        </button>
      )}
      {activityLatestTrackingJobSourceChangeRequestId &&
        activityLatestTrackingJobStrategyId &&
        activityLatestTrackingJobSourceChangeRequestId !== activityLatestTrackingJobChangeRequestId && (
          <button
            type="button"
            className="micro-action"
            data-strategy-activity-top-action-key="latest_tracking_job_source_change_request"
            onClick={() =>
              onOpenChangeRequest(activityLatestTrackingJobSourceChangeRequestId, activityLatestTrackingJobStrategyId)
            }
          >
            任务来源变更
          </button>
        )}
      {activityLatestTrackingJobSourceBacktestId &&
        activityLatestTrackingJobStrategyId &&
        activityLatestTrackingJobSourceBacktestId !== activityLatestTrackingJobBacktestId && (
          <button
            type="button"
            className="micro-action"
            data-strategy-activity-top-action-key="latest_tracking_job_source_backtest"
            onClick={() => onOpenBacktestDetail(activityLatestTrackingJobSourceBacktestId, activityLatestTrackingJobStrategyId)}
          >
            任务来源回测
          </button>
        )}
      {activityLatestTrackingJobSourceReviewId &&
        activityLatestTrackingJobStrategyId &&
        activityLatestTrackingJobSourceReviewId !== activityLatestTrackingJobLinkedReviewId && (
          <button
            type="button"
            className="micro-action"
            data-strategy-activity-top-action-key="latest_tracking_job_source_review"
            onClick={() => onOpenSourceReview(activityLatestTrackingJobSourceReviewId, activityLatestTrackingJobStrategyId)}
          >
            任务来源复盘
          </button>
        )}
      {activityLatestTrackingJobSourceProposalId && activityLatestTrackingJobStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_tracking_job_source_proposal"
          onClick={() => onOpenStrategyProposal(activityLatestTrackingJobSourceProposalId, activityLatestTrackingJobStrategyId)}
        >
          任务来源提案
        </button>
      )}
    </>
  )
}
