import type { ActivityBacktestListProps } from './ActivityBacktestList.types'
import ActivityBacktestListItem from './ActivityBacktestListItem'

export default function ActivityBacktestList({
  strategyId,
  focusedBacktestSupplemented,
  strategyActivityLatestBacktestSupplemented,
  strategyActivityLatestActionableBacktestSupplemented,
  strategyActivityBacktests,
  activityLatestBacktest,
  activityLatestActionableBacktest,
  activityLatestActionableBacktestReview,
  activityLatestBacktestReview,
  activityLatestActionableBacktestJob,
  activityLatestBacktestJob,
  backtests,
  reviewCatalog,
  backtestReviewJobs,
  serviceAvailable,
  retryAgentJobMutationPending,
  backtestFocusLabels,
  onOpenBacktestDetail,
  onOpenReviewInspector,
  onOpenAiSchedulerJob,
  onOpenChangeRequest,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onRetryAgentJob,
}: ActivityBacktestListProps) {
  return (
    <>
      <span className="section-label" data-strategy-activity-section-label="backtests">
        最近回测
      </span>
      {focusedBacktestSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="focused_backtest_hint">
          当前聚焦的回测不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一轮回测排障和复盘。
        </p>
      )}
      {strategyActivityLatestBacktestSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_backtest_supplemented_hint">
          顶部最近回测不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿当前最新回测排障和复盘。
        </p>
      )}
      {strategyActivityLatestActionableBacktestSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_backtest_supplemented_hint">
          顶部当前可处理回测不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿这轮仍可处理的回测推进。
        </p>
      )}
      <div
        className="trade-list trade-list--dense"
        data-strategy-activity-section="backtests"
        data-strategy-activity-action-group="backtests"
      >
        {strategyActivityBacktests.map((backtest) => (
          <ActivityBacktestListItem
            key={backtest.id}
            strategyId={strategyId}
            backtest={backtest}
            activityLatestBacktest={activityLatestBacktest}
            activityLatestActionableBacktest={activityLatestActionableBacktest}
            activityLatestActionableBacktestReview={activityLatestActionableBacktestReview}
            activityLatestBacktestReview={activityLatestBacktestReview}
            activityLatestActionableBacktestJob={activityLatestActionableBacktestJob}
            activityLatestBacktestJob={activityLatestBacktestJob}
            backtests={backtests}
            reviewCatalog={reviewCatalog}
            backtestReviewJobs={backtestReviewJobs}
            serviceAvailable={serviceAvailable}
            retryAgentJobMutationPending={retryAgentJobMutationPending}
            backtestFocusLabels={backtestFocusLabels}
            onOpenBacktestDetail={onOpenBacktestDetail}
            onOpenReviewInspector={onOpenReviewInspector}
            onOpenAiSchedulerJob={onOpenAiSchedulerJob}
            onOpenChangeRequest={onOpenChangeRequest}
            onOpenSourceReview={onOpenSourceReview}
            onOpenStrategyProposal={onOpenStrategyProposal}
            onRetryAgentJob={onRetryAgentJob}
          />
        ))}
        {!strategyActivityBacktests.length && (
          <div className="empty-state empty-state--inline">当前没有最近回测活动。</div>
        )}
      </div>
    </>
  )
}
