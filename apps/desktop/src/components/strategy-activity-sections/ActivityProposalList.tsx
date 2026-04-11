import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
} from '../../types'
import {
  formatDateTime,
  getChangeRequestStrategyId,
  proposalManualFollowupMeta,
  proposalOutcomeDetails,
  proposalStatusLabel,
  proposalTypeLabel,
} from '../../utils/app-helpers'

type ProposalLinkedState = {
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedChangeRequest: ChangeRequest | null
  linkedJob: AgentJob | null
}

export type ActivityProposalListProps = {
  focusedProposalSupplemented: boolean
  strategyActivityLatestProposalSupplemented: boolean
  strategyActivityLatestActionableProposalSupplemented: boolean
  strategyActivityProposals: StrategyProposal[]
  activityLatestProposal: StrategyProposal | null
  activityLatestActionableProposal: StrategyProposal | null
  selectedProposalId: string | null
  serviceAvailable: boolean
  proposalMutationPending: boolean
  retryAgentJobMutationPending: boolean
  getStrategyActivityProposalLinkedState: (proposal?: StrategyProposal | null) => ProposalLinkedState
  proposalFocusLabels: (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
  getProposalBlockedReason: (proposal: StrategyProposal) => string | null
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onRetryAgentJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}

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
        {strategyActivityProposals.map((proposal) => {
          const linkedState = getStrategyActivityProposalLinkedState(proposal)
          const linkedBacktest = linkedState.linkedBacktest
          const linkedReview = linkedState.linkedReview
          const linkedChangeRequest = linkedState.linkedChangeRequest
          const linkedJob = linkedState.linkedJob
          const proposalStrategyId = getChangeRequestStrategyId(linkedChangeRequest, proposal.strategy_id)
          const manualFollowupMeta = proposalManualFollowupMeta(proposal, linkedChangeRequest)
          const outcomeDetails = proposalOutcomeDetails(
            proposal,
            linkedChangeRequest,
            linkedBacktest,
            linkedReview,
            linkedJob,
          )
          const focusLabels = proposalFocusLabels(
            proposal,
            linkedChangeRequest,
            linkedBacktest,
            linkedReview,
            linkedJob,
          )
          const blockedReason = getProposalBlockedReason(proposal)
          return (
            <div
              key={proposal.id}
              className={`trade-row trade-row--fade ${focusLabels.length ? 'job-row--active' : ''}`}
              data-strategy-activity-row-id={proposal.id}
            >
              <div className="console-row__main">
                <strong>{proposal.title}</strong>
                <p>
                  {proposalTypeLabel(proposal.proposal_type)} · {proposal.expected_impact}
                </p>
                {outcomeDetails.map((detail, detailIndex) => (
                  <p key={`${proposal.id}-outcome-${detailIndex}`}>{detail}</p>
                ))}
              </div>
              <div className="trade-meta">
                <span className="console-tag">{proposalStatusLabel(proposal.status)}</span>
                {activityLatestProposal?.id === proposal.id && (
                  <span className="console-tag console-tag--warn">当前最新</span>
                )}
                {activityLatestActionableProposal?.id === proposal.id && (
                  <span className="console-tag console-tag--warn">当前可处理</span>
                )}
                {manualFollowupMeta && (
                  <span className="console-tag console-tag--warn">{manualFollowupMeta.label}</span>
                )}
                {selectedProposalId === proposal.id && (
                  <span className="console-tag console-tag--warn">当前提案</span>
                )}
                {focusLabels.map((label) => (
                  <span key={`${proposal.id}-${label}`} className="console-tag console-tag--warn">
                    {label}
                  </span>
                ))}
                <button
                  type="button"
                  className="micro-action"
                  onClick={() => onOpenStrategyProposal(proposal.id, proposal.strategy_id)}
                >
                  打开提案
                </button>
                {linkedChangeRequest && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenChangeRequest(linkedChangeRequest.id, proposalStrategyId)}
                  >
                    生成变更
                  </button>
                )}
                {linkedBacktest && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenBacktestDetail(linkedBacktest.id, proposal.strategy_id)}
                  >
                    生成回测
                  </button>
                )}
                {linkedReview && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenReplayReview(linkedReview.id, proposal.strategy_id, 'selected')}
                  >
                    生成复盘
                  </button>
                )}
                {linkedChangeRequest?.follow_up_job_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenAiSchedulerJob(linkedChangeRequest.follow_up_job_id!)}
                  >
                    打开任务
                  </button>
                )}
                {linkedChangeRequest?.linked_review_id &&
                  proposalStrategyId &&
                  (!linkedReview || linkedReview.id !== linkedChangeRequest.linked_review_id) && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenReviewInspector(linkedChangeRequest.linked_review_id, proposalStrategyId)}
                    >
                      查看结果
                    </button>
                  )}
                {linkedChangeRequest?.follow_up_job_id &&
                  (linkedChangeRequest.follow_up_job_status === 'failed' ||
                    linkedChangeRequest.follow_up_job_status === 'cancelled') && (
                    <button
                      type="button"
                      className="micro-action"
                      disabled={!serviceAvailable || retryAgentJobMutationPending}
                      onClick={() => onRetryAgentJob(linkedChangeRequest.follow_up_job_id!)}
                    >
                      重试跟踪
                    </button>
                  )}
                {linkedJob &&
                  (!linkedChangeRequest?.follow_up_job_id || linkedChangeRequest.follow_up_job_id !== linkedJob.id) && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenAiSchedulerJob(linkedJob.id)}
                    >
                      打开任务
                    </button>
                  )}
                {linkedJob?.linked_review_id &&
                  proposalStrategyId &&
                  (!linkedReview || linkedReview.id !== linkedJob.linked_review_id) && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenReviewInspector(linkedJob.linked_review_id, proposalStrategyId)}
                    >
                      查看结果
                    </button>
                  )}
                {linkedJob &&
                  (!linkedChangeRequest?.follow_up_job_id || linkedChangeRequest.follow_up_job_id !== linkedJob.id) &&
                  (linkedJob.status === 'failed' || linkedJob.status === 'cancelled') && (
                    <button
                      type="button"
                      className="micro-action"
                      disabled={!serviceAvailable || retryAgentJobMutationPending}
                      onClick={() => onRetryAgentJob(linkedJob.id)}
                    >
                      重试跟踪
                    </button>
                  )}
                <small>{formatDateTime(proposal.created_at)}</small>
              </div>
              {(proposal.status === 'pending' || proposal.status === 'testing') && (
                <div className="toggle-card__actions">
                  <button
                    type="button"
                    className="ghost-button"
                    title={blockedReason ?? manualFollowupMeta?.detail ?? '接受当前提案'}
                    disabled={!serviceAvailable || proposalMutationPending || Boolean(blockedReason)}
                    onClick={() => onHandleProposalAction(proposal.id, 'accept')}
                  >
                    接受
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!serviceAvailable || proposalMutationPending}
                    onClick={() => onHandleProposalAction(proposal.id, 'reject')}
                  >
                    拒绝
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {!strategyActivityProposals.length && (
          <div className="empty-state empty-state--inline">当前没有最近可处理的提案。</div>
        )}
      </div>
    </>
  )
}
