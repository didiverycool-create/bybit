import type { StrategyActivityTopRecentFocusActionsLineagePrimaryReviewSectionProps } from './strategyActivityTopRecentFocusActionsLineageTypes'

export default function StrategyActivityTopRecentFocusActionsLineagePrimaryReviewSection({
  activityLatestActionablePrimaryReviewStrategyId,
  activityLatestActionablePrimaryReviewHasRecommendation,
  activityLatestActionablePrimaryReviewRecord,
  activityLatestActionablePrimaryReviewDiffersFromLatest,
  latestActionablePrimaryReviewOpenId,
  latestPrimaryReviewSourceJobId,
  latestPrimaryReviewSourceChangeRequestId,
  latestPrimaryReviewSourceBacktestId,
  latestPrimaryReviewSourceReviewId,
  latestPrimaryReviewSourceProposalId,
  serviceAvailable,
  backtestMutationPending,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenAiSchedulerJob,
  onRerunBacktestFromReview,
}: StrategyActivityTopRecentFocusActionsLineagePrimaryReviewSectionProps) {
  return (
    <>
      {latestPrimaryReviewSourceJobId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_primary_review_job"
          onClick={() => onOpenAiSchedulerJob(latestPrimaryReviewSourceJobId)}
        >
          复盘任务
        </button>
      )}
      {latestPrimaryReviewSourceChangeRequestId && activityLatestActionablePrimaryReviewStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_primary_review_source_change_request"
          onClick={() => onOpenChangeRequest(latestPrimaryReviewSourceChangeRequestId, activityLatestActionablePrimaryReviewStrategyId)}
        >
          复盘来源变更
        </button>
      )}
      {latestPrimaryReviewSourceBacktestId && activityLatestActionablePrimaryReviewStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_primary_review_source_backtest"
          onClick={() => onOpenBacktestDetail(latestPrimaryReviewSourceBacktestId, activityLatestActionablePrimaryReviewStrategyId)}
        >
          复盘来源回测
        </button>
      )}
      {latestPrimaryReviewSourceReviewId && activityLatestActionablePrimaryReviewStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_primary_review_source_review"
          onClick={() => onOpenSourceReview(latestPrimaryReviewSourceReviewId, activityLatestActionablePrimaryReviewStrategyId)}
        >
          复盘来源复盘
        </button>
      )}
      {latestPrimaryReviewSourceProposalId && activityLatestActionablePrimaryReviewStrategyId && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_primary_review_source_proposal"
          onClick={() => onOpenStrategyProposal(latestPrimaryReviewSourceProposalId, activityLatestActionablePrimaryReviewStrategyId)}
        >
          复盘来源提案
        </button>
      )}
      {latestActionablePrimaryReviewOpenId &&
        activityLatestActionablePrimaryReviewStrategyId &&
        activityLatestActionablePrimaryReviewHasRecommendation && (
          <button
            type="button"
            className="micro-action"
            data-strategy-activity-top-action-key="actionable_primary_review_rerun"
            disabled={!serviceAvailable || backtestMutationPending}
            onClick={() => onRerunBacktestFromReview(activityLatestActionablePrimaryReviewRecord ?? null)}
          >
            {activityLatestActionablePrimaryReviewDiffersFromLatest ? '当前可处理复盘按建议重跑' : '复盘按建议重跑'}
          </button>
        )}
    </>
  )
}
