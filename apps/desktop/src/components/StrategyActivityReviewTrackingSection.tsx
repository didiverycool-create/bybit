import {
  backtestLineageMeta,
  formatDateTime,
  getReviewFocusStrategyId,
  isStrategyTrackingReview,
  reviewPeriodLabel,
} from '../utils/app-helpers'
import type { StrategyActivityTrackingReviewsSectionProps } from './strategyActivityReviewAndJobsTypes'

export default function StrategyActivityReviewTrackingSection({
  strategyId,
  selectedStrategyId,
  replayFocusReview,
  recentTrackingReviewIds,
  strategyActivityLatestTrackingReviewSupplemented,
  strategyActivityTrackingReviews,
  activityLatestTrackingReview,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
}: StrategyActivityTrackingReviewsSectionProps) {
  const focusedTrackingReviewSupplemented = Boolean(
    replayFocusReview &&
      isStrategyTrackingReview(replayFocusReview.period) &&
      getReviewFocusStrategyId(replayFocusReview, selectedStrategyId) === strategyId &&
      !recentTrackingReviewIds.includes(replayFocusReview.id),
  )

  return (
    <>
      <span className="section-label" data-strategy-activity-section-label="tracking-reviews">
        AI 跟踪
      </span>
      {focusedTrackingReviewSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="focused_tracking_review_hint">
          当前聚焦的跟踪结果不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一结果排障。
        </p>
      )}
      {strategyActivityLatestTrackingReviewSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_tracking_review_supplemented_hint">
          顶部最近跟踪结果不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿当前最新结果排障。
        </p>
      )}
      <div
        className="trade-list trade-list--dense"
        data-strategy-activity-section="tracking-reviews"
        data-strategy-activity-action-group="tracking-reviews"
      >
        {strategyActivityTrackingReviews.map((review) => {
          const reviewLineageMeta = backtestLineageMeta(review)
          return (
            <div key={review.id} className="trade-row trade-row--fade" data-strategy-activity-row-id={review.id}>
              <div className="console-row__main">
                <strong>{review.title}</strong>
                <p>{review.summary}</p>
                {reviewLineageMeta && <p className="panel-note">来源链路: {reviewLineageMeta.detail}</p>}
              </div>
              <div className="trade-meta">
                <span className="console-tag">{reviewPeriodLabel(review.period)}</span>
                {activityLatestTrackingReview?.id === review.id && (
                  <span className="console-tag console-tag--warn">当前最新</span>
                )}
                {replayFocusReview?.id === review.id && <span className="console-tag console-tag--warn">当前聚焦</span>}
                {review.source_change_request_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenChangeRequest(review.source_change_request_id, strategyId)}
                  >
                    来源变更
                  </button>
                )}
                {review.source_backtest_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenBacktestDetail(review.source_backtest_id, strategyId)}
                  >
                    来源回测
                  </button>
                )}
                {review.source_review_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenSourceReview(review.source_review_id, strategyId)}
                  >
                    来源复盘
                  </button>
                )}
                {review.source_proposal_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenStrategyProposal(review.source_proposal_id, strategyId)}
                  >
                    来源提案
                  </button>
                )}
                {review.source_job_id && (
                  <button type="button" className="micro-action" onClick={() => onOpenAiSchedulerJob(review.source_job_id)}>
                    打开任务
                  </button>
                )}
                {selectedStrategyId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenReviewInspector(review.id, selectedStrategyId)}
                  >
                    查看结果
                  </button>
                )}
                <small>{formatDateTime(review.created_at)}</small>
              </div>
            </div>
          )
        })}
        {!strategyActivityTrackingReviews.length && (
          <div className="empty-state empty-state--inline">当前没有策略问题或变更跟踪。</div>
        )}
      </div>
    </>
  )
}
