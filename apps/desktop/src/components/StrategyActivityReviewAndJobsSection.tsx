import type { AgentJob, ReviewDocument } from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  formatDateTime,
  getAgentJobBacktestId,
  getAgentJobChangeRequestId,
  getAgentJobSourceBacktestId,
  getAgentJobSourceProposalId,
  getAgentJobSourceReviewId,
  getAgentJobStrategyId,
  getReviewFocusStrategyId,
  isStrategyTrackingReview,
  reviewPeriodChipClass,
  reviewPeriodLabel,
  strategyAgentJobSummary,
} from '../utils/app-helpers'

export type StrategyActivityReviewAndJobsSectionProps = {
  strategyId: string
  selectedStrategyId: string | null
  replayFocusReview: ReviewDocument | null
  recentTrackingReviewIds: string[]
  recentPrimaryReviewIds: string[]
  recentAgentJobIds: string[]
  strategyActivityLatestTrackingReviewSupplemented: boolean
  strategyActivityTrackingReviews: ReviewDocument[]
  activityLatestTrackingReview: ReviewDocument | null
  strategyActivityLatestPrimaryReviewSupplemented: boolean
  strategyActivityLatestActionablePrimaryReviewSupplemented: boolean
  strategyActivityLatestActionableBacktestReviewSupplemented: boolean
  strategyActivityPrimaryReviews: ReviewDocument[]
  activityLatestPrimaryReview: ReviewDocument | null
  activityLatestActionablePrimaryReview: ReviewDocument | null
  activityLatestActionableBacktestReview: ReviewDocument | null
  aiSchedulerFocusedJobId: string | null
  strategyActivityLatestTrackingJobSupplemented: boolean
  strategyActivityLatestRetryableTrackingJobSupplemented: boolean
  strategyActivityLatestActionableBacktestJobSupplemented: boolean
  strategyActivityAgentJobs: AgentJob[]
  activityLatestTrackingJob: AgentJob | null
  activityLatestRetryableTrackingJob: AgentJob | null
  activityLatestActionableBacktestJob: AgentJob | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenStrategyReplay: (strategyId: string) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void
  onRetryAgentJob: (jobId: string) => void
}

export default function StrategyActivityReviewAndJobsSection({
  strategyId,
  selectedStrategyId,
  replayFocusReview,
  recentTrackingReviewIds,
  recentPrimaryReviewIds,
  recentAgentJobIds,
  strategyActivityLatestTrackingReviewSupplemented,
  strategyActivityTrackingReviews,
  activityLatestTrackingReview,
  strategyActivityLatestPrimaryReviewSupplemented,
  strategyActivityLatestActionablePrimaryReviewSupplemented,
  strategyActivityLatestActionableBacktestReviewSupplemented,
  strategyActivityPrimaryReviews,
  activityLatestPrimaryReview,
  activityLatestActionablePrimaryReview,
  activityLatestActionableBacktestReview,
  aiSchedulerFocusedJobId,
  strategyActivityLatestTrackingJobSupplemented,
  strategyActivityLatestRetryableTrackingJobSupplemented,
  strategyActivityLatestActionableBacktestJobSupplemented,
  strategyActivityAgentJobs,
  activityLatestTrackingJob,
  activityLatestRetryableTrackingJob,
  activityLatestActionableBacktestJob,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenReplayReview,
  onOpenStrategyReplay,
  onRerunBacktestFromReview,
  onRetryAgentJob,
}: StrategyActivityReviewAndJobsSectionProps) {
  const focusedTrackingReviewSupplemented = Boolean(
    replayFocusReview &&
      isStrategyTrackingReview(replayFocusReview.period) &&
      getReviewFocusStrategyId(replayFocusReview, selectedStrategyId) === strategyId &&
      !recentTrackingReviewIds.includes(replayFocusReview.id),
  )
  const focusedPrimaryReviewSupplemented = Boolean(
    replayFocusReview &&
      !isStrategyTrackingReview(replayFocusReview.period) &&
      getReviewFocusStrategyId(replayFocusReview, selectedStrategyId) === strategyId &&
      !recentPrimaryReviewIds.includes(replayFocusReview.id),
  )
  const focusedTrackingJobSupplemented = Boolean(
    aiSchedulerFocusedJobId &&
      strategyActivityAgentJobs.some((job) => job.id === aiSchedulerFocusedJobId) &&
      !recentAgentJobIds.includes(aiSchedulerFocusedJobId),
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

      <span className="section-label" data-strategy-activity-section-label="jobs">
        跟踪任务
      </span>
      {focusedTrackingJobSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="focused_tracking_job_hint">
          当前聚焦的调度任务不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一任务排障。
        </p>
      )}
      {strategyActivityLatestTrackingJobSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_tracking_job_supplemented_hint">
          顶部最近任务不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿当前最新任务排障。
        </p>
      )}
      {strategyActivityLatestRetryableTrackingJobSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="retryable_tracking_job_supplemented_hint">
          顶部当前可重试任务不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿这条仍可重试的任务处理。
        </p>
      )}
      {strategyActivityLatestActionableBacktestJobSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_backtest_job_supplemented_hint">
          顶部当前可处理回测对应的复盘任务不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一任务重试或追踪。
        </p>
      )}
      <div
        className="trade-list trade-list--dense"
        data-strategy-activity-section="jobs"
        data-strategy-activity-action-group="jobs"
      >
        {strategyActivityAgentJobs.map((job) => {
          const jobStrategyId = getAgentJobStrategyId(job) ?? strategyId
          const jobBacktestId = getAgentJobBacktestId(job)
          const jobChangeRequestId = getAgentJobChangeRequestId(job)
          const sourceBacktestId = getAgentJobSourceBacktestId(job)
          const sourceReviewId = getAgentJobSourceReviewId(job)
          const sourceProposalId = getAgentJobSourceProposalId(job)
          return (
            <div key={job.id} className="trade-row trade-row--fade" data-strategy-activity-row-id={job.id}>
              <div className="console-row__main">
                <strong>{strategyAgentJobSummary(job)}</strong>
                <p>
                  {job.result_summary || `${job.writeback_target} · ${job.requested_by || 'system'}`}
                  {job.linked_review_title ? ` · 结果 ${job.linked_review_title}` : ''}
                </p>
              </div>
              <div className="trade-meta">
                <span className="console-tag">{job.writeback_target}</span>
                {activityLatestTrackingJob?.id === job.id && <span className="console-tag console-tag--warn">当前最新</span>}
                {activityLatestRetryableTrackingJob?.id === job.id && (
                  <span className="console-tag console-tag--warn">当前可重试</span>
                )}
                {activityLatestActionableBacktestJob?.id === job.id &&
                  activityLatestRetryableTrackingJob?.id !== job.id && (
                    <span className="console-tag console-tag--warn">当前回测任务</span>
                  )}
                {aiSchedulerFocusedJobId === job.id && <span className="console-tag console-tag--warn">当前聚焦</span>}
                {job.linked_review_period && (
                  <span className={reviewPeriodChipClass(job.linked_review_period)}>
                    {reviewPeriodLabel(job.linked_review_period)}
                  </span>
                )}
                {job.linked_review_id && selectedStrategyId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenReviewInspector(job.linked_review_id, selectedStrategyId)}
                  >
                    查看结果
                  </button>
                )}
                {jobChangeRequestId && jobStrategyId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenChangeRequest(jobChangeRequestId, jobStrategyId)}
                  >
                    查看变更
                  </button>
                )}
                {jobBacktestId && jobStrategyId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenBacktestDetail(jobBacktestId, jobStrategyId)}
                  >
                    打开回测
                  </button>
                )}
                {sourceBacktestId && jobStrategyId && sourceBacktestId !== jobBacktestId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenBacktestDetail(sourceBacktestId, jobStrategyId)}
                  >
                    来源回测
                  </button>
                )}
                {sourceReviewId && jobStrategyId && sourceReviewId !== job.linked_review_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenSourceReview(sourceReviewId, jobStrategyId)}
                  >
                    来源复盘
                  </button>
                )}
                {sourceProposalId && jobStrategyId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenStrategyProposal(sourceProposalId, jobStrategyId)}
                  >
                    来源提案
                  </button>
                )}
                {!job.linked_review_id &&
                  (job.job_type === 'review_strategy_issue' || job.job_type === 'review_strategy_change') &&
                  selectedStrategyId && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenStrategyReplay(selectedStrategyId)}
                    >
                      打开复盘
                    </button>
                  )}
                {(job.status === 'failed' || job.status === 'cancelled') && (
                  <button
                    type="button"
                    className="micro-action"
                    disabled={!serviceAvailable || retryAgentJobMutationPending}
                    onClick={() => onRetryAgentJob(job.id)}
                  >
                    重试
                  </button>
                )}
                <small>{formatDateTime(job.updated_at || job.created_at)}</small>
              </div>
            </div>
          )
        })}
        {!strategyActivityAgentJobs.length && (
          <div className="empty-state empty-state--inline">当前没有策略关联的 AI 跟踪任务。</div>
        )}
      </div>
    </>
  )
}
