import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
} from '../../types'
import { proposalTypeLabel } from '../../utils/app-helpers'

export type TopActionableDecisionActionsProps = {
  showProposalChangeActions: boolean
  showActionableActions: boolean
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestChangeRequestStrategyId: string | null
  activityLatestChangeRequestLinkedBacktestId: string | null
  activityLatestChangeRequestLinkedReviewId: string | null
  activityLatestChangeRequestSourceBacktestId: string | null
  activityLatestChangeRequestSourceBacktestStrategyId: string | null
  activityLatestChangeRequestSourceReviewId: string | null
  activityLatestChangeRequestSourceReviewStrategyId: string | null
  activityLatestChangeRequestSourceProposalId: string | null
  activityLatestChangeRequestSourceProposalStrategyId: string | null
  activityLatestProposalLinkedChangeRequest: ChangeRequest | null
  activityLatestProposalLinkedBacktest: BacktestRun | null
  activityLatestProposalLinkedReview: ReviewDocument | null
  activityLatestActionableProposal: StrategyProposal | null
  activityLatestActionableProposalDiffersFromLatest: boolean
  activityLatestActionableProposalAcceptTitle: string | null
  activityLatestActionableProposalAcceptDisabled: boolean
  activityLatestActionableChangeRequest: ChangeRequest | null
  activityLatestActionableChangeRequestDiffersFromLatest: boolean
  activityLatestActionableChangeRequestHasRerunRecommendation: boolean
  activityLatestRetryableTrackingJob: AgentJob | null
  activityLatestRetryableTrackingJobDiffersFromLatest: boolean
  latestProposalChangeRequestStrategyId: string | null
  latestProposalReviewStrategyId: string
  latestProposalJobId: string | null
  latestChangeRequestJobId: string | null
  actionableChangeRequestRetryJobId: string | null
  actionableChangeRequestCanRetry: boolean
  retryableTrackingJobOpenId: string | null
  serviceAvailable: boolean
  proposalMutationPending: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
  onRetryAgentJobWithFocus: (jobId: string) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

export default function TopActionableDecisionActions({
  showProposalChangeActions,
  showActionableActions,
  activityLatestChangeRequest,
  activityLatestChangeRequestStrategyId,
  activityLatestChangeRequestLinkedBacktestId,
  activityLatestChangeRequestLinkedReviewId,
  activityLatestChangeRequestSourceBacktestId,
  activityLatestChangeRequestSourceBacktestStrategyId,
  activityLatestChangeRequestSourceReviewId,
  activityLatestChangeRequestSourceReviewStrategyId,
  activityLatestChangeRequestSourceProposalId,
  activityLatestChangeRequestSourceProposalStrategyId,
  activityLatestProposalLinkedChangeRequest,
  activityLatestProposalLinkedBacktest,
  activityLatestProposalLinkedReview,
  activityLatestActionableProposal,
  activityLatestActionableProposalDiffersFromLatest,
  activityLatestActionableProposalAcceptTitle,
  activityLatestActionableProposalAcceptDisabled,
  activityLatestActionableChangeRequest,
  activityLatestActionableChangeRequestDiffersFromLatest,
  activityLatestActionableChangeRequestHasRerunRecommendation,
  activityLatestRetryableTrackingJob,
  activityLatestRetryableTrackingJobDiffersFromLatest,
  latestProposalChangeRequestStrategyId,
  latestProposalReviewStrategyId,
  latestProposalJobId,
  latestChangeRequestJobId,
  actionableChangeRequestRetryJobId,
  actionableChangeRequestCanRetry,
  retryableTrackingJobOpenId,
  serviceAvailable,
  proposalMutationPending,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenReplayReview,
  onOpenReviewInspector,
  onOpenSourceReview,
  onOpenAiSchedulerJob,
  onHandleProposalAction,
  onRetryAgentJobWithFocus,
  onRerunBacktestFromChangeRequest,
}: TopActionableDecisionActionsProps) {
  return (
    <>
      {showProposalChangeActions && (
        <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="proposal-change">
          {activityLatestProposalLinkedChangeRequest && latestProposalChangeRequestStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_proposal_change_request"
              onClick={() =>
                onOpenChangeRequest(activityLatestProposalLinkedChangeRequest.id, latestProposalChangeRequestStrategyId)
              }
            >
              提案变更
            </button>
          )}
          {activityLatestProposalLinkedBacktest && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_proposal_backtest"
              onClick={() => onOpenBacktestDetail(activityLatestProposalLinkedBacktest.id, activityLatestProposalLinkedBacktest.strategy_id)}
            >
              提案回测
            </button>
          )}
          {activityLatestProposalLinkedReview && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_proposal_review"
              onClick={() => onOpenReplayReview(activityLatestProposalLinkedReview.id, latestProposalReviewStrategyId, 'selected')}
            >
              提案复盘
            </button>
          )}
          {latestProposalJobId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_proposal_job"
              onClick={() => onOpenAiSchedulerJob(latestProposalJobId)}
            >
              提案任务
            </button>
          )}
          {activityLatestChangeRequest && activityLatestChangeRequestStrategyId && activityLatestChangeRequestLinkedBacktestId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_change_request_backtest"
              onClick={() => onOpenBacktestDetail(activityLatestChangeRequestLinkedBacktestId, activityLatestChangeRequestStrategyId)}
            >
              变更回测
            </button>
          )}
          {activityLatestChangeRequest && activityLatestChangeRequestStrategyId && activityLatestChangeRequestLinkedReviewId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_change_request_review"
              onClick={() => onOpenReviewInspector(activityLatestChangeRequestLinkedReviewId, activityLatestChangeRequestStrategyId)}
            >
              变更结果
            </button>
          )}
          {latestChangeRequestJobId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_change_request_job"
              onClick={() => onOpenAiSchedulerJob(latestChangeRequestJobId)}
            >
              变更任务
            </button>
          )}
          {activityLatestChangeRequestSourceBacktestStrategyId && activityLatestChangeRequestSourceBacktestId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_change_request_source_backtest"
              onClick={() =>
                onOpenBacktestDetail(
                  activityLatestChangeRequestSourceBacktestId,
                  activityLatestChangeRequestSourceBacktestStrategyId,
                )
              }
            >
              变更来源回测
            </button>
          )}
          {activityLatestChangeRequestSourceReviewStrategyId && activityLatestChangeRequestSourceReviewId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_change_request_source_review"
              onClick={() =>
                onOpenSourceReview(
                  activityLatestChangeRequestSourceReviewId,
                  activityLatestChangeRequestSourceReviewStrategyId,
                )
              }
            >
              变更来源复盘
            </button>
          )}
          {activityLatestChangeRequestSourceProposalStrategyId && activityLatestChangeRequestSourceProposalId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_change_request_source_proposal"
              onClick={() =>
                onOpenStrategyProposal(
                  activityLatestChangeRequestSourceProposalId,
                  activityLatestChangeRequestSourceProposalStrategyId,
                )
              }
            >
              变更来源提案
            </button>
          )}
        </div>
      )}

      {showActionableActions && (
        <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="actionable">
          {activityLatestActionableProposal && (
            <>
              <button
                type="button"
                className="micro-action"
                data-strategy-activity-top-action-key="actionable_proposal_accept"
                title={
                  activityLatestActionableProposalAcceptTitle ??
                  `接受 ${proposalTypeLabel(activityLatestActionableProposal.proposal_type)}`
                }
                disabled={activityLatestActionableProposalAcceptDisabled}
                onClick={() => onHandleProposalAction(activityLatestActionableProposal.id, 'accept')}
              >
                {activityLatestActionableProposalDiffersFromLatest ? '接受当前可处理提案' : '接受最近提案'}
              </button>
              <button
                type="button"
                className="micro-action"
                data-strategy-activity-top-action-key="actionable_proposal_reject"
                disabled={!serviceAvailable || proposalMutationPending}
                onClick={() => onHandleProposalAction(activityLatestActionableProposal.id, 'reject')}
              >
                {activityLatestActionableProposalDiffersFromLatest ? '拒绝当前可处理提案' : '拒绝最近提案'}
              </button>
            </>
          )}
          {actionableChangeRequestCanRetry && actionableChangeRequestRetryJobId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="actionable_change_request_retry"
              disabled={!serviceAvailable || retryAgentJobMutationPending}
              onClick={() => onRetryAgentJobWithFocus(actionableChangeRequestRetryJobId)}
            >
              {activityLatestActionableChangeRequestDiffersFromLatest ? '重试当前可处理变更' : '重试最近变更'}
            </button>
          )}
          {activityLatestActionableChangeRequest && activityLatestActionableChangeRequestHasRerunRecommendation && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="actionable_change_request_rerun"
              disabled={!serviceAvailable || backtestMutationPending}
              onClick={() => onRerunBacktestFromChangeRequest(activityLatestActionableChangeRequest)}
            >
              {activityLatestActionableChangeRequestDiffersFromLatest ? '当前可处理变更按建议重跑' : '最近变更按建议重跑'}
            </button>
          )}
          {retryableTrackingJobOpenId &&
            (activityLatestRetryableTrackingJob?.status === 'failed' ||
              activityLatestRetryableTrackingJob?.status === 'cancelled') && (
              <button
                type="button"
                className="micro-action"
                data-strategy-activity-top-action-key="retryable_tracking_job_retry"
                disabled={!serviceAvailable || retryAgentJobMutationPending}
                onClick={() => onRetryAgentJobWithFocus(retryableTrackingJobOpenId)}
              >
                {activityLatestRetryableTrackingJobDiffersFromLatest ? '重试当前可重试任务' : '重试最近任务'}
              </button>
            )}
        </div>
      )}
    </>
  )
}
