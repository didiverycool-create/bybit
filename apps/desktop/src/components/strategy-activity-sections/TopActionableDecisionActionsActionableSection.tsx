import type { TopActionableDecisionActionsActionableSectionProps } from './TopActionableDecisionActions.types'
import { proposalTypeLabel } from '../../utils/app-helpers'

export default function TopActionableDecisionActionsActionableSection({
  showActionableActions,
  activityLatestActionableProposal,
  activityLatestActionableProposalDiffersFromLatest,
  activityLatestActionableProposalAcceptTitle,
  activityLatestActionableProposalAcceptDisabled,
  activityLatestActionableChangeRequest,
  activityLatestActionableChangeRequestDiffersFromLatest,
  activityLatestActionableChangeRequestHasRerunRecommendation,
  activityLatestRetryableTrackingJob,
  activityLatestRetryableTrackingJobDiffersFromLatest,
  actionableChangeRequestRetryJobId,
  actionableChangeRequestCanRetry,
  retryableTrackingJobOpenId,
  serviceAvailable,
  proposalMutationPending,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onHandleProposalAction,
  onRetryAgentJobWithFocus,
  onRerunBacktestFromChangeRequest,
}: TopActionableDecisionActionsActionableSectionProps) {
  if (!showActionableActions) {
    return null
  }

  return (
    <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="actionable">
      {activityLatestActionableProposal && (
        <>
          <button
            type="button"
            className="micro-action"
            data-strategy-activity-top-action-key="actionable_proposal_accept"
            title={activityLatestActionableProposalAcceptTitle ?? `接受 ${proposalTypeLabel(activityLatestActionableProposal.proposal_type)}`}
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
  )
}
