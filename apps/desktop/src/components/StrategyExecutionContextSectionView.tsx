import type { StrategyExecutionContextSectionViewProps } from './StrategyExecutionContextSection.types'
import {
  ChangeRequestListItem,
  LatestBacktestPanel,
  ProposalListItem,
  SelectedChangeRequestPanel,
} from './strategy-execution'
import {
  proposalAcceptBlockedReason,
  proposalManualFollowupMeta,
  proposalTypeLabel,
} from '../utils/app-helpers'

export default function StrategyExecutionContextSectionView({
  selectedStrategy,
  latestStrategyBacktest,
  latestStrategyBacktestDecisionMeta,
  latestStrategyBacktestSampleMeta,
  latestStrategyBacktestWindowMeta,
  latestStrategyBacktestLineageMeta,
  latestStrategyBacktestReview,
  latestStrategyBacktestReviewJob,
  latestStrategyBacktestReviewJobMeta,
  selectedStrategyRuntime,
  selectedStrategyChangeRequest,
  allStrategyChangeRequests,
  strategyChangeRequests,
  strategyProposals,
  backtests,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  selectedChangeRequestId,
  gatedPublishProposalCount,
  schedulerState,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  proposalMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onRetryAgentJob,
  onHandleProposalAction,
  onRerunBacktestFromRecommendation,
  onRerunBacktestFromChangeRequest,
  proposalFocusLabels,
}: StrategyExecutionContextSectionViewProps) {
  return (
    <div className="composite-grid">
      <div className="console-panel console-panel--stream">
        <LatestBacktestPanel
          selectedStrategy={selectedStrategy}
          latestStrategyBacktest={latestStrategyBacktest}
          latestStrategyBacktestDecisionMeta={latestStrategyBacktestDecisionMeta}
          latestStrategyBacktestSampleMeta={latestStrategyBacktestSampleMeta}
          latestStrategyBacktestWindowMeta={latestStrategyBacktestWindowMeta}
          latestStrategyBacktestLineageMeta={latestStrategyBacktestLineageMeta}
          latestStrategyBacktestReview={latestStrategyBacktestReview}
          latestStrategyBacktestReviewJob={latestStrategyBacktestReviewJob}
          latestStrategyBacktestReviewJobMeta={latestStrategyBacktestReviewJobMeta}
          selectedStrategyRuntime={selectedStrategyRuntime}
          serviceAvailable={serviceAvailable}
          backtestMutationPending={backtestMutationPending}
          retryAgentJobMutationPending={retryAgentJobMutationPending}
          onOpenChangeRequest={onOpenChangeRequest}
          onOpenBacktestDetail={onOpenBacktestDetail}
          onOpenSourceReview={onOpenSourceReview}
          onOpenStrategyProposal={onOpenStrategyProposal}
          onOpenAiSchedulerJob={onOpenAiSchedulerJob}
          onRetryAgentJob={onRetryAgentJob}
          onRerunBacktestFromRecommendation={onRerunBacktestFromRecommendation}
        />
        {selectedStrategyChangeRequest && (
          <SelectedChangeRequestPanel
            selectedStrategy={selectedStrategy}
            selectedStrategyChangeRequest={selectedStrategyChangeRequest}
            backtests={backtests}
            serviceAvailable={serviceAvailable}
            backtestMutationPending={backtestMutationPending}
            retryAgentJobMutationPending={retryAgentJobMutationPending}
            onOpenChangeRequest={onOpenChangeRequest}
            onOpenBacktestDetail={onOpenBacktestDetail}
            onOpenSourceReview={onOpenSourceReview}
            onOpenStrategyProposal={onOpenStrategyProposal}
            onOpenAiSchedulerJob={onOpenAiSchedulerJob}
            onOpenReviewInspector={onOpenReviewInspector}
            onRetryAgentJob={onRetryAgentJob}
            onRerunBacktestFromChangeRequest={onRerunBacktestFromChangeRequest}
          />
        )}
        <div className="watchlist-module__header">
          <span className="section-label">待落实 ChangeRequest</span>
          <strong>{allStrategyChangeRequests.length} 条</strong>
        </div>
        {selectedStrategyChangeRequest &&
          !allStrategyChangeRequests.slice(0, 6).some((request) => request.id === selectedStrategyChangeRequest.id) && (
            <p className="panel-note">
              当前定位的变更不在最近 6 条内，列表已临时把它补进当前视图，便于直接继续排障和处理。
            </p>
          )}
        <div className="job-list">
          {strategyChangeRequests.map((request, index) => (
            <ChangeRequestListItem
              key={request.id}
              request={request}
              index={index}
              selectedStrategy={selectedStrategy}
              backtests={backtests}
              selectedChangeRequestId={selectedChangeRequestId}
              serviceAvailable={serviceAvailable}
              backtestMutationPending={backtestMutationPending}
              retryAgentJobMutationPending={retryAgentJobMutationPending}
              onOpenChangeRequest={onOpenChangeRequest}
              onOpenBacktestDetail={onOpenBacktestDetail}
              onOpenSourceReview={onOpenSourceReview}
              onOpenStrategyProposal={onOpenStrategyProposal}
              onOpenAiSchedulerJob={onOpenAiSchedulerJob}
              onOpenReviewInspector={onOpenReviewInspector}
              onRetryAgentJob={onRetryAgentJob}
              onRerunBacktestFromChangeRequest={onRerunBacktestFromChangeRequest}
            />
          ))}
          {strategyChangeRequests.length === 0 && (
            <div className="empty-state empty-state--inline">当前策略没有待落实的请求</div>
          )}
        </div>
      </div>

      <div className="console-panel console-panel--stream">
        <div className="panel-head panel-head--compact">
          <div>
            <span className="section-label">AI 提案</span>
            <h3>接受后会直接进入控制链路</h3>
          </div>
          <span className="chip chip--warning">{strategyProposals.length} 条待处理</span>
        </div>
        {gatedPublishProposalCount > 0 && (
          <p className="panel-note">
            当前有 {gatedPublishProposalCount} 条发布建议；若启用人工接管或冻结自动发布，前端会直接禁止接受。
          </p>
        )}
        <div className="job-list">
          {strategyProposals.map((proposal, index) => {
            const linkedBacktest = proposalBacktestMap.get(proposal.id) ?? null
            const linkedReview = proposalReviewMap.get(proposal.id) ?? null
            const linkedChangeRequest = proposalChangeRequestMap.get(proposal.id) ?? null
            const linkedJob = proposalAgentJobMap.get(proposal.id) ?? null
            const focusLabels = proposalFocusLabels(
              proposal,
              linkedChangeRequest,
              linkedBacktest,
              linkedReview,
              linkedJob,
            )
            return (
              <ProposalListItem
                key={proposal.id}
                proposal={proposal}
                index={index}
                linkedBacktest={linkedBacktest}
                linkedReview={linkedReview}
                linkedChangeRequest={linkedChangeRequest}
                linkedJob={linkedJob}
                focusLabels={focusLabels}
                serviceAvailable={serviceAvailable}
                retryAgentJobMutationPending={retryAgentJobMutationPending}
                onOpenChangeRequest={onOpenChangeRequest}
                onOpenBacktestDetail={onOpenBacktestDetail}
                onOpenAiSchedulerJob={onOpenAiSchedulerJob}
                onOpenReviewInspector={onOpenReviewInspector}
                onRetryAgentJob={onRetryAgentJob}
              />
            )
          })}
          {strategyProposals.length === 0 && (
            <div className="empty-state empty-state--inline">当前策略暂时没有 AI 提案</div>
          )}
        </div>
        {strategyProposals.length > 0 && (
          <div className="inline-actions">
            {strategyProposals
              .filter((proposal) => proposal.status === 'pending' || proposal.status === 'testing')
              .slice(0, 2)
              .map((proposal) => {
                const manualFollowupMeta = proposalManualFollowupMeta(
                  proposal,
                  proposalChangeRequestMap.get(proposal.id) ?? null,
                )
                const blockedReason = proposalAcceptBlockedReason(proposal.proposal_type, schedulerState)
                return (
                  <div key={`${proposal.id}-actions`} className="toggle-card__actions">
                    <button
                      type="button"
                      title={blockedReason ?? manualFollowupMeta?.detail ?? `接受 ${proposalTypeLabel(proposal.proposal_type)}`}
                      disabled={!serviceAvailable || proposalMutationPending || Boolean(blockedReason)}
                      onClick={() => onHandleProposalAction(proposal.id, 'accept')}
                    >
                      接受 {proposalTypeLabel(proposal.proposal_type)}
                    </button>
                    <button
                      type="button"
                      disabled={!serviceAvailable || proposalMutationPending}
                      onClick={() => onHandleProposalAction(proposal.id, 'reject')}
                    >
                      拒绝
                    </button>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
