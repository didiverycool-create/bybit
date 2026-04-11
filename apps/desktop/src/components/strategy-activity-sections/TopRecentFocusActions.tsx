import type {
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyActivityBacktestSummary,
  StrategyProposal,
} from '../../types'

export type TopRecentFocusActionsProps = {
  showLatestFocusActions: boolean
  showLineageActions: boolean
  strategyId: string
  activityLatestProposal: StrategyProposal | null
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestChangeRequestStrategyId: string | null
  activityLatestBacktest: StrategyActivityBacktestSummary | null
  activityLatestPrimaryReviewStrategyId: string | null
  activityLatestTrackingReviewStrategyId: string | null
  activityLatestBacktestStrategyId: string | null
  activityLatestBacktestReview: ReviewDocument | null
  activityLatestActionableBacktestRecord: BacktestRun | null
  activityLatestActionableBacktestHasRecommendation: boolean
  activityLatestActionableBacktestDiffersFromLatest: boolean
  activityLatestActionableBacktestJobCanRetry: boolean
  activityLatestBacktestSourceChangeRequestId: string | null
  activityLatestBacktestSourceBacktestId: string | null
  activityLatestBacktestSourceReviewId: string | null
  activityLatestBacktestSourceProposalId: string | null
  activityLatestActionablePrimaryReviewStrategyId: string | null
  activityLatestActionablePrimaryReviewHasRecommendation: boolean
  activityLatestActionablePrimaryReviewRecord: ReviewDocument | null
  activityLatestActionablePrimaryReviewDiffersFromLatest: boolean
  activityLatestTrackingJobLinkedReviewId: string | null
  activityLatestTrackingJobChangeRequestId: string | null
  activityLatestTrackingJobBacktestId: string | null
  activityLatestTrackingJobSourceChangeRequestId: string | null
  activityLatestTrackingJobSourceBacktestId: string | null
  activityLatestTrackingJobSourceReviewId: string | null
  activityLatestTrackingJobSourceProposalId: string | null
  activityLatestTrackingJobStrategyId: string | null
  latestPrimaryReviewOpenId: string | null
  latestTrackingReviewOpenId: string | null
  latestTrackingJobOpenId: string | null
  latestBacktestReviewOpenId: string | null
  latestBacktestJobOpenId: string | null
  latestActionableBacktestJobOpenId: string | null
  latestActionablePrimaryReviewOpenId: string | null
  latestPrimaryReviewSourceJobId: string | null
  latestPrimaryReviewSourceChangeRequestId: string | null
  latestPrimaryReviewSourceBacktestId: string | null
  latestPrimaryReviewSourceReviewId: string | null
  latestPrimaryReviewSourceProposalId: string | null
  latestTrackingReviewSourceJobId: string | null
  latestTrackingReviewSourceChangeRequestId: string | null
  latestTrackingReviewSourceBacktestId: string | null
  latestTrackingReviewSourceReviewId: string | null
  latestTrackingReviewSourceProposalId: string | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onRetryAgentJobWithFocus: (jobId: string) => void
  onRerunBacktestFromRecommendation: (backtest: BacktestRun) => void
  onRerunBacktestFromReview: (review: ReviewDocument | null) => void
}

export default function TopRecentFocusActions({
  showLatestFocusActions,
  showLineageActions,
  strategyId,
  activityLatestProposal,
  activityLatestChangeRequest,
  activityLatestChangeRequestStrategyId,
  activityLatestBacktest,
  activityLatestPrimaryReviewStrategyId,
  activityLatestTrackingReviewStrategyId,
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
  activityLatestActionablePrimaryReviewStrategyId,
  activityLatestActionablePrimaryReviewHasRecommendation,
  activityLatestActionablePrimaryReviewRecord,
  activityLatestActionablePrimaryReviewDiffersFromLatest,
  activityLatestTrackingJobLinkedReviewId,
  activityLatestTrackingJobChangeRequestId,
  activityLatestTrackingJobBacktestId,
  activityLatestTrackingJobSourceChangeRequestId,
  activityLatestTrackingJobSourceBacktestId,
  activityLatestTrackingJobSourceReviewId,
  activityLatestTrackingJobSourceProposalId,
  activityLatestTrackingJobStrategyId,
  latestPrimaryReviewOpenId,
  latestTrackingReviewOpenId,
  latestTrackingJobOpenId,
  latestBacktestReviewOpenId,
  latestBacktestJobOpenId,
  latestActionableBacktestJobOpenId,
  latestActionablePrimaryReviewOpenId,
  latestPrimaryReviewSourceJobId,
  latestPrimaryReviewSourceChangeRequestId,
  latestPrimaryReviewSourceBacktestId,
  latestPrimaryReviewSourceReviewId,
  latestPrimaryReviewSourceProposalId,
  latestTrackingReviewSourceJobId,
  latestTrackingReviewSourceChangeRequestId,
  latestTrackingReviewSourceBacktestId,
  latestTrackingReviewSourceReviewId,
  latestTrackingReviewSourceProposalId,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenReplayReview,
  onOpenReviewInspector,
  onOpenSourceReview,
  onOpenAiSchedulerJob,
  onRetryAgentJobWithFocus,
  onRerunBacktestFromRecommendation,
  onRerunBacktestFromReview,
}: TopRecentFocusActionsProps) {
  return (
    <>
      {showLatestFocusActions && (
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
      )}

      {showLineageActions && (
        <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="lineage">
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
          {latestPrimaryReviewSourceChangeRequestId && activityLatestPrimaryReviewStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_primary_review_source_change_request"
              onClick={() => onOpenChangeRequest(latestPrimaryReviewSourceChangeRequestId, activityLatestPrimaryReviewStrategyId)}
            >
              复盘来源变更
            </button>
          )}
          {latestPrimaryReviewSourceBacktestId && activityLatestPrimaryReviewStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_primary_review_source_backtest"
              onClick={() => onOpenBacktestDetail(latestPrimaryReviewSourceBacktestId, activityLatestPrimaryReviewStrategyId)}
            >
              复盘来源回测
            </button>
          )}
          {latestPrimaryReviewSourceReviewId && activityLatestPrimaryReviewStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_primary_review_source_review"
              onClick={() => onOpenSourceReview(latestPrimaryReviewSourceReviewId, activityLatestPrimaryReviewStrategyId)}
            >
              复盘来源复盘
            </button>
          )}
          {latestPrimaryReviewSourceProposalId && activityLatestPrimaryReviewStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_primary_review_source_proposal"
              onClick={() => onOpenStrategyProposal(latestPrimaryReviewSourceProposalId, activityLatestPrimaryReviewStrategyId)}
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
          {latestTrackingReviewSourceChangeRequestId && activityLatestTrackingReviewStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_tracking_review_source_change_request"
              onClick={() => onOpenChangeRequest(latestTrackingReviewSourceChangeRequestId, activityLatestTrackingReviewStrategyId)}
            >
              跟踪来源变更
            </button>
          )}
          {latestTrackingReviewSourceBacktestId && activityLatestTrackingReviewStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_tracking_review_source_backtest"
              onClick={() => onOpenBacktestDetail(latestTrackingReviewSourceBacktestId, activityLatestTrackingReviewStrategyId)}
            >
              跟踪来源回测
            </button>
          )}
          {latestTrackingReviewSourceReviewId && activityLatestTrackingReviewStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_tracking_review_source_review"
              onClick={() => onOpenSourceReview(latestTrackingReviewSourceReviewId, activityLatestTrackingReviewStrategyId)}
            >
              跟踪来源复盘
            </button>
          )}
          {latestTrackingReviewSourceProposalId && activityLatestTrackingReviewStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_tracking_review_source_proposal"
              onClick={() => onOpenStrategyProposal(latestTrackingReviewSourceProposalId, activityLatestTrackingReviewStrategyId)}
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
        </div>
      )}
    </>
  )
}
