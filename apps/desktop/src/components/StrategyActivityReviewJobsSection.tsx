import {
  formatDateTime,
  getAgentJobBacktestId,
  getAgentJobChangeRequestId,
  getAgentJobSourceBacktestId,
  getAgentJobSourceProposalId,
  getAgentJobSourceReviewId,
  getAgentJobStrategyId,
  reviewPeriodChipClass,
  reviewPeriodLabel,
  strategyAgentJobSummary,
} from '../utils/app-helpers'
import type { StrategyActivityAgentJobsSectionProps } from './strategyActivityReviewAndJobsTypes'

export default function StrategyActivityReviewJobsSection({
  strategyId,
  selectedStrategyId,
  recentAgentJobIds,
  strategyActivityLatestTrackingJobSupplemented,
  strategyActivityLatestRetryableTrackingJobSupplemented,
  strategyActivityLatestActionableBacktestJobSupplemented,
  strategyActivityAgentJobs,
  activityLatestTrackingJob,
  activityLatestRetryableTrackingJob,
  activityLatestActionableBacktestJob,
  aiSchedulerFocusedJobId,
  serviceAvailable,
  retryAgentJobMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenReviewInspector,
  onOpenStrategyReplay,
  onRetryAgentJob,
}: StrategyActivityAgentJobsSectionProps) {
  const focusedTrackingJobSupplemented = Boolean(
    aiSchedulerFocusedJobId &&
      strategyActivityAgentJobs.some((job) => job.id === aiSchedulerFocusedJobId) &&
      !recentAgentJobIds.includes(aiSchedulerFocusedJobId),
  )

  return (
    <>
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
                    <button type="button" className="micro-action" onClick={() => onOpenStrategyReplay(selectedStrategyId)}>
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
