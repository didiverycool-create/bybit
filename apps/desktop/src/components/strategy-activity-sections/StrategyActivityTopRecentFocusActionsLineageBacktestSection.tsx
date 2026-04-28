import type { StrategyActivityTopRecentFocusActionsLineageBacktestSectionProps } from './strategyActivityTopRecentFocusActionsLineageTypes'

export default function StrategyActivityTopRecentFocusActionsLineageBacktestSection({
  activityLatestBacktest,
  activityLatestBacktestStrategyId,
  activityLatestBacktestReview,
  activityLatestActionableBacktestRecord,
  activityLatestActionableBacktestHasRecommendation,
  activityLatestActionableBacktestDiffersFromLatest,
  activityLatestActionableBacktestJobCanRetry,
  activityLatestBacktestSourceChangeRequestId,
  activityLatestBacktestSourceBacktestId,
  activityLatestBacktestSourceReviewId,
  activityLatestBacktestSourceProposalId,
  latestBacktestReviewOpenId,
  latestBacktestJobOpenId,
  latestActionableBacktestJobOpenId,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenReviewInspector,
  onOpenAiSchedulerJob,
  onRetryAgentJobWithFocus,
  onRerunBacktestFromRecommendation,
}: StrategyActivityTopRecentFocusActionsLineageBacktestSectionProps) {
  return (
    <>
      {latestBacktestReviewOpenId && activityLatestBacktestStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_backtest_review_open"
          onClick={() => onOpenReviewInspector(latestBacktestReviewOpenId, activityLatestBacktestStrategyId)}
        >
          回测结果
        </button>
      )}
      {latestBacktestJobOpenId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_backtest_job_open"
          onClick={() => onOpenAiSchedulerJob(latestBacktestJobOpenId)}
        >
          回测任务
        </button>
      )}
      {activityLatestActionableBacktestRecord && activityLatestActionableBacktestHasRecommendation && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="actionable_backtest_rerun"
          disabled={!serviceAvailable || backtestMutationPending}
          onClick={() => onRerunBacktestFromRecommendation(activityLatestActionableBacktestRecord)}
        >
          {activityLatestActionableBacktestDiffersFromLatest ? '当前可处理回测按建议重跑' : '回测按建议重跑'}
        </button>
      )}
      {activityLatestActionableBacktestJobCanRetry && latestActionableBacktestJobOpenId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="actionable_backtest_retry_job"
          disabled={!serviceAvailable || retryAgentJobMutationPending}
          onClick={() => onRetryAgentJobWithFocus(latestActionableBacktestJobOpenId)}
        >
          {activityLatestActionableBacktestDiffersFromLatest ? '重试当前可处理回测任务' : '重试回测任务'}
        </button>
      )}
      {activityLatestBacktestSourceChangeRequestId && activityLatestBacktestStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_backtest_source_change_request"
          onClick={() => onOpenChangeRequest(activityLatestBacktestSourceChangeRequestId, activityLatestBacktestStrategyId)}
        >
          回测来源变更
        </button>
      )}
      {activityLatestBacktestSourceBacktestId &&
        activityLatestBacktestStrategyId &&
        activityLatestBacktestSourceBacktestId !== activityLatestBacktest?.id && (
          <button
            type="button"
            className="micro-action"
            data-strategy-activity-top-action-key="latest_backtest_source_backtest"
            onClick={() => onOpenBacktestDetail(activityLatestBacktestSourceBacktestId, activityLatestBacktestStrategyId)}
          >
            回测来源回测
          </button>
        )}
      {activityLatestBacktestSourceReviewId &&
        activityLatestBacktestStrategyId &&
        activityLatestBacktestSourceReviewId !== activityLatestBacktestReview?.id && (
          <button
            type="button"
            className="micro-action"
            data-strategy-activity-top-action-key="latest_backtest_source_review"
            onClick={() => onOpenSourceReview(activityLatestBacktestSourceReviewId, activityLatestBacktestStrategyId)}
          >
            回测来源复盘
          </button>
        )}
      {activityLatestBacktestSourceProposalId && activityLatestBacktestStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_backtest_source_proposal"
          onClick={() => onOpenStrategyProposal(activityLatestBacktestSourceProposalId, activityLatestBacktestStrategyId)}
        >
          回测来源提案
        </button>
      )}
    </>
  )
}
