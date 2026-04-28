import type { ActivityProposalListProps } from './ActivityProposalList.types'
import ActivityProposalListItem from './ActivityProposalListItem'

export default function ActivityProposalList({
  focusedProposalSupplemented,
  strategyActivityLatestProposalSupplemented,
  strategyActivityLatestActionableProposalSupplemented,
  strategyActivityProposals,
  activityLatestProposal,
  activityLatestActionableProposal,
  selectedProposalId,
  serviceAvailable,
  proposalMutationPending,
  retryAgentJobMutationPending,
  getStrategyActivityProposalLinkedState,
  proposalFocusLabels,
  getProposalBlockedReason,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenReplayReview,
  onOpenReviewInspector,
  onOpenAiSchedulerJob,
  onRetryAgentJob,
  onHandleProposalAction,
}: ActivityProposalListProps) {
  return (
    <>
      <span className="section-label" data-strategy-activity-section-label="proposals">
        最近提案
      </span>
      {focusedProposalSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="focused_proposal_hint">
          当前定位的提案不在最近活动返回的最近提案内，面板已临时把它补进当前视图，便于继续接受、拒绝或沿来源链排障。
        </p>
      )}
      {strategyActivityLatestProposalSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_proposal_supplemented_hint">
          顶部最近提案不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿当前最新提案处理。
        </p>
      )}
      {strategyActivityLatestActionableProposalSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_proposal_supplemented_hint">
          顶部当前可处理提案不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿这条仍可接受或拒绝的提案处理。
        </p>
      )}
      <div
        className="trade-list trade-list--dense"
        data-strategy-activity-section="proposals"
        data-strategy-activity-action-group="proposals"
      >
        {strategyActivityProposals.map((proposal) => (
          <ActivityProposalListItem
            key={proposal.id}
            proposal={proposal}
            linkedState={getStrategyActivityProposalLinkedState(proposal)}
            activityLatestProposal={activityLatestProposal}
            activityLatestActionableProposal={activityLatestActionableProposal}
            selectedProposalId={selectedProposalId}
            serviceAvailable={serviceAvailable}
            proposalMutationPending={proposalMutationPending}
            retryAgentJobMutationPending={retryAgentJobMutationPending}
            proposalFocusLabels={proposalFocusLabels}
            getProposalBlockedReason={getProposalBlockedReason}
            onOpenStrategyProposal={onOpenStrategyProposal}
            onOpenChangeRequest={onOpenChangeRequest}
            onOpenBacktestDetail={onOpenBacktestDetail}
            onOpenReplayReview={onOpenReplayReview}
            onOpenReviewInspector={onOpenReviewInspector}
            onOpenAiSchedulerJob={onOpenAiSchedulerJob}
            onRetryAgentJob={onRetryAgentJob}
            onHandleProposalAction={onHandleProposalAction}
          />
        ))}
        {!strategyActivityProposals.length && (
          <div className="empty-state empty-state--inline">当前没有最近可处理的提案。</div>
        )}
      </div>
    </>
  )
}
