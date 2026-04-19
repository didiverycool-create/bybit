import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  formatDateTime,
  getReviewFocusStrategyId,
  isStrategyTrackingReview,
  reviewPeriodLabel,
} from '../utils/app-helpers'
import type { StrategyActivityPrimaryReviewsSectionProps } from './strategyActivityReviewAndJobsTypes'

export default function StrategyActivityReviewPrimarySection({
  strategyId,
  selectedStrategyId,
  replayFocusReview,
  recentPrimaryReviewIds,
  strategyActivityLatestPrimaryReviewSupplemented,
  strategyActivityLatestActionablePrimaryReviewSupplemented,
  strategyActivityLatestActionableBacktestReviewSupplemented,
  strategyActivityPrimaryReviews,
  activityLatestPrimaryReview,
  activityLatestActionablePrimaryReview,
  activityLatestActionableBacktestReview,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenReplayReview,
  onRerunBacktestFromReview,
  serviceAvailable,
  backtestMutationPending,
}: StrategyActivityPrimaryReviewsSectionProps) {
  const focusedPrimaryReviewSupplemented = Boolean(
    replayFocusReview &&
      !isStrategyTrackingReview(replayFocusReview.period) &&
      getReviewFocusStrategyId(replayFocusReview, selectedStrategyId) === strategyId &&
      !recentPrimaryReviewIds.includes(replayFocusReview.id),
  )

  return (
    <>
      <span className="section-label" data-strategy-activity-section-label="primary-reviews">
        复盘记录
      </span>
      {focusedPrimaryReviewSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="focused_primary_review_hint">
          当前聚焦的复盘结果不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一结果排障。
        </p>
      )}
      {strategyActivityLatestPrimaryReviewSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_primary_review_supplemented_hint">
          顶部最近复盘结果不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿当前最新结果排障。
        </p>
      )}
      {strategyActivityLatestActionablePrimaryReviewSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_primary_review_supplemented_hint">
          顶部当前可处理复盘不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿这条仍可处理的复盘推进。
        </p>
      )}
      {strategyActivityLatestActionableBacktestReviewSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_backtest_review_supplemented_hint">
          顶部当前可处理回测对应的复盘结果不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一回测结果排障。
        </p>
      )}
      <div
        className="trade-list trade-list--dense"
        data-strategy-activity-section="primary-reviews"
        data-strategy-activity-action-group="primary-reviews"
      >
        {strategyActivityPrimaryReviews.map((review) => {
          const reviewLineageMeta = backtestLineageMeta(review)
          const reviewDecisionMeta =
            review.period === 'backtest' &&
            (review.decision_readiness ||
              review.decision_readiness_detail ||
              review.decision_readiness_action ||
              review.decision_recommended_data_range ||
              review.decision_recommended_timeframe)
              ? backtestDecisionReadinessMeta(review)
              : null
          return (
            <div key={review.id} className="trade-row trade-row--fade" data-strategy-activity-row-id={review.id}>
              <div className="console-row__main">
                <strong>{review.title}</strong>
                <p>{review.summary}</p>
                {reviewDecisionMeta && (
                  <p className="panel-note">
                    结论门禁: {reviewDecisionMeta.description}
                    {reviewDecisionMeta.nextAction ? ` · 建议 ${reviewDecisionMeta.nextAction}` : ''}
                  </p>
                )}
                {reviewLineageMeta && <p className="panel-note">来源链路: {reviewLineageMeta.detail}</p>}
              </div>
              <div className="trade-meta">
                <span className="console-tag">{reviewPeriodLabel(review.period)}</span>
                {activityLatestPrimaryReview?.id === review.id && (
                  <span className="console-tag console-tag--warn">当前最新</span>
                )}
                {activityLatestActionablePrimaryReview?.id === review.id && (
                  <span className="console-tag console-tag--warn">当前可处理</span>
                )}
                {activityLatestActionableBacktestReview?.id === review.id &&
                  activityLatestActionablePrimaryReview?.id !== review.id && (
                    <span className="console-tag console-tag--warn">当前回测结果</span>
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
                    onClick={() => onOpenReplayReview(review.id, selectedStrategyId, 'selected')}
                  >
                    打开复盘
                  </button>
                )}
                {review.strategy_id && reviewDecisionMeta?.recommendedRange && reviewDecisionMeta?.recommendedTimeframe && (
                  <button
                    type="button"
                    className="micro-action"
                    disabled={!serviceAvailable || backtestMutationPending}
                    onClick={() => onRerunBacktestFromReview(review)}
                  >
                    按建议重跑
                  </button>
                )}
                <small>
                  {review.proposal_count > 0
                    ? `${review.proposal_count} 条提案 · ${formatDateTime(review.created_at)}`
                    : formatDateTime(review.created_at)}
                </small>
              </div>
            </div>
          )
        })}
        {!strategyActivityPrimaryReviews.length && (
          <div className="empty-state empty-state--inline">当前没有策略关联的 AI 复盘。</div>
        )}
      </div>
    </>
  )
}
