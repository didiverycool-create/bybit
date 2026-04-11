import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyActivityBacktestSummary,
  StrategyProposal,
} from '../types'
import { getChangeRequestStrategyId } from '../utils/app-helpers'
import {
  TopActionableDecisionActions,
  TopRecentFocusActions,
} from './strategy-activity-sections'

export type StrategyActivityTopDecisionActionsSectionProps = {
  strategyId: string
  latestProposalChangeSummaryText: string | null
  activityLatestProposal: StrategyProposal | null
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestChangeRequestStrategyId: string | null
  activityLatestBacktest: StrategyActivityBacktestSummary | null
  activityLatestPrimaryReview: ReviewDocument | null
  activityLatestPrimaryReviewRecord: ReviewDocument | null
  activityLatestPrimaryReviewStrategyId: string | null
  activityLatestTrackingReview: ReviewDocument | null
  activityLatestTrackingReviewRecord: ReviewDocument | null
  activityLatestTrackingReviewStrategyId: string | null
  activityLatestTrackingJob: AgentJob | null
  activityLatestTrackingJobRecord: AgentJob | null
  activityLatestBacktestReview: ReviewDocument | null
  activityLatestBacktestReviewRecord: ReviewDocument | null
  activityLatestBacktestJob: AgentJob | null
  activityLatestBacktestJobRecord: AgentJob | null
  activityLatestActionableBacktestRecord: BacktestRun | null
  activityLatestActionableBacktestHasRecommendation: boolean
  activityLatestActionableBacktestDiffersFromLatest: boolean
  activityLatestActionableBacktestJob: AgentJob | null
  activityLatestActionableBacktestJobRecord: AgentJob | null
  activityLatestActionableBacktestJobCanRetry: boolean
  activityLatestBacktestStrategyId: string | null
  activityLatestBacktestSourceChangeRequestId: string | null
  activityLatestBacktestSourceBacktestId: string | null
  activityLatestBacktestSourceReviewId: string | null
  activityLatestBacktestSourceProposalId: string | null
  activityLatestActionablePrimaryReview: ReviewDocument | null
  activityLatestActionablePrimaryReviewRecord: ReviewDocument | null
  activityLatestActionablePrimaryReviewStrategyId: string | null
  activityLatestActionablePrimaryReviewHasRecommendation: boolean
  activityLatestActionablePrimaryReviewDiffersFromLatest: boolean
  activityLatestTrackingJobLinkedReviewId: string | null
  activityLatestTrackingJobChangeRequestId: string | null
  activityLatestTrackingJobBacktestId: string | null
  activityLatestTrackingJobSourceChangeRequestId: string | null
  activityLatestTrackingJobSourceBacktestId: string | null
  activityLatestTrackingJobSourceReviewId: string | null
  activityLatestTrackingJobSourceProposalId: string | null
  activityLatestTrackingJobStrategyId: string | null
  activityLatestProposalLinkedChangeRequest: ChangeRequest | null
  activityLatestProposalLinkedBacktest: BacktestRun | null
  activityLatestProposalLinkedReview: ReviewDocument | null
  activityLatestProposalLinkedJob: AgentJob | null
  activityLatestChangeRequestLinkedBacktestId: string | null
  activityLatestChangeRequestLinkedReviewId: string | null
  activityLatestChangeRequestLinkedJob: AgentJob | null
  activityLatestChangeRequestSourceBacktestId: string | null
  activityLatestChangeRequestSourceBacktestStrategyId: string | null
  activityLatestChangeRequestSourceReviewId: string | null
  activityLatestChangeRequestSourceReviewStrategyId: string | null
  activityLatestChangeRequestSourceProposalId: string | null
  activityLatestChangeRequestSourceProposalStrategyId: string | null
  activityLatestActionableProposal: StrategyProposal | null
  activityLatestActionableProposalDiffersFromLatest: boolean
  activityLatestActionableProposalAcceptTitle: string | null
  activityLatestActionableProposalAcceptDisabled: boolean
  activityLatestActionableChangeRequest: ChangeRequest | null
  activityLatestActionableChangeRequestDiffersFromLatest: boolean
  activityLatestActionableChangeRequestLinkedJobId: string | null
  activityLatestActionableChangeRequestHasRerunRecommendation: boolean
  activityLatestRetryableTrackingJob: AgentJob | null
  activityLatestRetryableTrackingJobRecord: AgentJob | null
  activityLatestRetryableTrackingJobDiffersFromLatest: boolean
  serviceAvailable: boolean
  proposalMutationPending: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
  onRetryAgentJobWithFocus: (jobId: string) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
  onRerunBacktestFromRecommendation: (backtest: BacktestRun) => void
  onRerunBacktestFromReview: (review: ReviewDocument | null) => void
}

export default function StrategyActivityTopDecisionActionsSection({
  strategyId,
  latestProposalChangeSummaryText,
  activityLatestProposal,
  activityLatestChangeRequest,
  activityLatestChangeRequestStrategyId,
  activityLatestBacktest,
  activityLatestPrimaryReview,
  activityLatestPrimaryReviewRecord,
  activityLatestPrimaryReviewStrategyId,
  activityLatestTrackingReview,
  activityLatestTrackingReviewRecord,
  activityLatestTrackingReviewStrategyId,
  activityLatestTrackingJob,
  activityLatestTrackingJobRecord,
  activityLatestBacktestReview,
  activityLatestBacktestReviewRecord,
  activityLatestBacktestJob,
  activityLatestBacktestJobRecord,
  activityLatestActionableBacktestRecord,
  activityLatestActionableBacktestHasRecommendation,
  activityLatestActionableBacktestDiffersFromLatest,
  activityLatestActionableBacktestJob,
  activityLatestActionableBacktestJobRecord,
  activityLatestActionableBacktestJobCanRetry,
  activityLatestBacktestStrategyId,
  activityLatestBacktestSourceChangeRequestId,
  activityLatestBacktestSourceBacktestId,
  activityLatestBacktestSourceReviewId,
  activityLatestBacktestSourceProposalId,
  activityLatestActionablePrimaryReview,
  activityLatestActionablePrimaryReviewRecord,
  activityLatestActionablePrimaryReviewStrategyId,
  activityLatestActionablePrimaryReviewHasRecommendation,
  activityLatestActionablePrimaryReviewDiffersFromLatest,
  activityLatestTrackingJobLinkedReviewId,
  activityLatestTrackingJobChangeRequestId,
  activityLatestTrackingJobBacktestId,
  activityLatestTrackingJobSourceChangeRequestId,
  activityLatestTrackingJobSourceBacktestId,
  activityLatestTrackingJobSourceReviewId,
  activityLatestTrackingJobSourceProposalId,
  activityLatestTrackingJobStrategyId,
  activityLatestProposalLinkedChangeRequest,
  activityLatestProposalLinkedBacktest,
  activityLatestProposalLinkedReview,
  activityLatestProposalLinkedJob,
  activityLatestChangeRequestLinkedBacktestId,
  activityLatestChangeRequestLinkedReviewId,
  activityLatestChangeRequestLinkedJob,
  activityLatestChangeRequestSourceBacktestId,
  activityLatestChangeRequestSourceBacktestStrategyId,
  activityLatestChangeRequestSourceReviewId,
  activityLatestChangeRequestSourceReviewStrategyId,
  activityLatestChangeRequestSourceProposalId,
  activityLatestChangeRequestSourceProposalStrategyId,
  activityLatestActionableProposal,
  activityLatestActionableProposalDiffersFromLatest,
  activityLatestActionableProposalAcceptTitle,
  activityLatestActionableProposalAcceptDisabled,
  activityLatestActionableChangeRequest,
  activityLatestActionableChangeRequestDiffersFromLatest,
  activityLatestActionableChangeRequestLinkedJobId,
  activityLatestActionableChangeRequestHasRerunRecommendation,
  activityLatestRetryableTrackingJob,
  activityLatestRetryableTrackingJobRecord,
  activityLatestRetryableTrackingJobDiffersFromLatest,
  serviceAvailable,
  proposalMutationPending,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenReviewInspector,
  onOpenReplayReview,
  onOpenSourceReview,
  onOpenAiSchedulerJob,
  onHandleProposalAction,
  onRetryAgentJobWithFocus,
  onRerunBacktestFromChangeRequest,
  onRerunBacktestFromRecommendation,
  onRerunBacktestFromReview,
}: StrategyActivityTopDecisionActionsSectionProps) {
  const latestPrimaryReviewOpenId = activityLatestPrimaryReviewRecord?.id ?? activityLatestPrimaryReview?.id ?? null
  const latestTrackingReviewOpenId = activityLatestTrackingReviewRecord?.id ?? activityLatestTrackingReview?.id ?? null
  const latestTrackingJobOpenId = activityLatestTrackingJobRecord?.id ?? activityLatestTrackingJob?.id ?? null
  const latestBacktestReviewOpenId = activityLatestBacktestReviewRecord?.id ?? activityLatestBacktestReview?.id ?? null
  const latestBacktestJobOpenId = activityLatestBacktestJobRecord?.id ?? activityLatestBacktestJob?.id ?? null
  const latestActionableBacktestJobOpenId =
    activityLatestActionableBacktestJobRecord?.id ?? activityLatestActionableBacktestJob?.id ?? null
  const latestActionablePrimaryReviewOpenId =
    activityLatestActionablePrimaryReviewRecord?.id ?? activityLatestActionablePrimaryReview?.id ?? null
  const latestPrimaryReviewSourceJobId = activityLatestPrimaryReview?.source_job_id ?? null
  const latestPrimaryReviewSourceChangeRequestId = activityLatestPrimaryReview?.source_change_request_id ?? null
  const latestPrimaryReviewSourceBacktestId = activityLatestPrimaryReview?.source_backtest_id ?? null
  const latestPrimaryReviewSourceReviewId = activityLatestPrimaryReview?.source_review_id ?? null
  const latestPrimaryReviewSourceProposalId = activityLatestPrimaryReview?.source_proposal_id ?? null
  const latestTrackingReviewSourceJobId = activityLatestTrackingReview?.source_job_id ?? null
  const latestTrackingReviewSourceChangeRequestId = activityLatestTrackingReview?.source_change_request_id ?? null
  const latestTrackingReviewSourceBacktestId = activityLatestTrackingReview?.source_backtest_id ?? null
  const latestTrackingReviewSourceReviewId = activityLatestTrackingReview?.source_review_id ?? null
  const latestTrackingReviewSourceProposalId = activityLatestTrackingReview?.source_proposal_id ?? null
  const latestProposalChangeRequestStrategyId = activityLatestProposalLinkedChangeRequest
    ? getChangeRequestStrategyId(activityLatestProposalLinkedChangeRequest, activityLatestProposal?.strategy_id ?? strategyId)
    : null
  const latestProposalReviewStrategyId =
    activityLatestProposal?.strategy_id ?? activityLatestProposalLinkedReview?.strategy_id ?? strategyId
  const latestProposalJobId =
    activityLatestProposalLinkedChangeRequest?.follow_up_job_id ?? activityLatestProposalLinkedJob?.id ?? null
  const latestChangeRequestJobId =
    activityLatestChangeRequest?.follow_up_job_id ?? activityLatestChangeRequestLinkedJob?.id ?? null
  const actionableChangeRequestRetryJobId =
    activityLatestActionableChangeRequest?.follow_up_job_id ?? activityLatestActionableChangeRequestLinkedJobId ?? null
  const actionableChangeRequestCanRetry = Boolean(
    activityLatestActionableChangeRequest &&
      actionableChangeRequestRetryJobId &&
      (activityLatestActionableChangeRequest.follow_up_job_status === 'failed' ||
        activityLatestActionableChangeRequest.follow_up_job_status === 'cancelled'),
  )
  const retryableTrackingJobOpenId =
    activityLatestRetryableTrackingJobRecord?.id ?? activityLatestRetryableTrackingJob?.id ?? null

  const showLatestFocusActions = Boolean(
    activityLatestProposal ||
      (activityLatestChangeRequest && activityLatestChangeRequestStrategyId) ||
      activityLatestBacktest ||
      (latestPrimaryReviewOpenId && activityLatestPrimaryReviewStrategyId) ||
      (latestTrackingReviewOpenId && activityLatestTrackingReviewStrategyId) ||
      latestTrackingJobOpenId,
  )
  const showLineageActions = Boolean(
    (latestBacktestReviewOpenId && activityLatestBacktestStrategyId) ||
      latestBacktestJobOpenId ||
      (activityLatestActionableBacktestRecord && activityLatestActionableBacktestHasRecommendation) ||
      (activityLatestActionableBacktestJobCanRetry && latestActionableBacktestJobOpenId) ||
      (activityLatestBacktestSourceChangeRequestId && activityLatestBacktestStrategyId) ||
      (activityLatestBacktestSourceBacktestId &&
        activityLatestBacktestStrategyId &&
        activityLatestBacktestSourceBacktestId !== activityLatestBacktest?.id) ||
      (activityLatestBacktestSourceReviewId &&
        activityLatestBacktestStrategyId &&
        activityLatestBacktestSourceReviewId !== activityLatestBacktestReview?.id) ||
      (activityLatestBacktestSourceProposalId && activityLatestBacktestStrategyId) ||
      latestPrimaryReviewSourceJobId ||
      (latestPrimaryReviewSourceChangeRequestId && activityLatestPrimaryReviewStrategyId) ||
      (latestPrimaryReviewSourceBacktestId && activityLatestPrimaryReviewStrategyId) ||
      (latestPrimaryReviewSourceReviewId && activityLatestPrimaryReviewStrategyId) ||
      (latestPrimaryReviewSourceProposalId && activityLatestPrimaryReviewStrategyId) ||
      (latestActionablePrimaryReviewOpenId &&
        activityLatestActionablePrimaryReviewStrategyId &&
        activityLatestActionablePrimaryReviewHasRecommendation) ||
      latestTrackingReviewSourceJobId ||
      (latestTrackingReviewSourceChangeRequestId && activityLatestTrackingReviewStrategyId) ||
      (latestTrackingReviewSourceBacktestId && activityLatestTrackingReviewStrategyId) ||
      (latestTrackingReviewSourceReviewId && activityLatestTrackingReviewStrategyId) ||
      (latestTrackingReviewSourceProposalId && activityLatestTrackingReviewStrategyId) ||
      (activityLatestTrackingJobLinkedReviewId && activityLatestTrackingJobStrategyId) ||
      (activityLatestTrackingJobChangeRequestId && activityLatestTrackingJobStrategyId) ||
      (activityLatestTrackingJobBacktestId && activityLatestTrackingJobStrategyId) ||
      (activityLatestTrackingJobSourceChangeRequestId &&
        activityLatestTrackingJobStrategyId &&
        activityLatestTrackingJobSourceChangeRequestId !== activityLatestTrackingJobChangeRequestId) ||
      (activityLatestTrackingJobSourceBacktestId &&
        activityLatestTrackingJobStrategyId &&
        activityLatestTrackingJobSourceBacktestId !== activityLatestTrackingJobBacktestId) ||
      (activityLatestTrackingJobSourceReviewId &&
        activityLatestTrackingJobStrategyId &&
        activityLatestTrackingJobSourceReviewId !== activityLatestTrackingJobLinkedReviewId) ||
      (activityLatestTrackingJobSourceProposalId && activityLatestTrackingJobStrategyId),
  )
  const showProposalChangeActions = Boolean(
    activityLatestProposalLinkedChangeRequest ||
      activityLatestProposalLinkedBacktest ||
      activityLatestProposalLinkedReview ||
      latestProposalJobId ||
      (activityLatestChangeRequest && activityLatestChangeRequestStrategyId && activityLatestChangeRequestLinkedBacktestId) ||
      (activityLatestChangeRequest && activityLatestChangeRequestStrategyId && activityLatestChangeRequestLinkedReviewId) ||
      latestChangeRequestJobId ||
      (activityLatestChangeRequestSourceBacktestStrategyId && activityLatestChangeRequestSourceBacktestId) ||
      (activityLatestChangeRequestSourceReviewStrategyId && activityLatestChangeRequestSourceReviewId) ||
      (activityLatestChangeRequestSourceProposalStrategyId && activityLatestChangeRequestSourceProposalId),
  )
  const showActionableActions = Boolean(
    activityLatestActionableProposal ||
      actionableChangeRequestCanRetry ||
      (activityLatestActionableChangeRequest && activityLatestActionableChangeRequestHasRerunRecommendation) ||
      (retryableTrackingJobOpenId &&
        (activityLatestRetryableTrackingJob?.status === 'failed' ||
          activityLatestRetryableTrackingJob?.status === 'cancelled')),
  )

  return (
    <>
      {latestProposalChangeSummaryText && (
        <p className="panel-note" data-strategy-activity-note-key="latest_proposal_change_summary">
          {latestProposalChangeSummaryText}
        </p>
      )}

      <TopRecentFocusActions
        showLatestFocusActions={showLatestFocusActions}
        showLineageActions={showLineageActions}
        strategyId={strategyId}
        activityLatestProposal={activityLatestProposal}
        activityLatestChangeRequest={activityLatestChangeRequest}
        activityLatestChangeRequestStrategyId={activityLatestChangeRequestStrategyId}
        activityLatestBacktest={activityLatestBacktest}
        activityLatestPrimaryReviewStrategyId={activityLatestPrimaryReviewStrategyId}
        activityLatestTrackingReviewStrategyId={activityLatestTrackingReviewStrategyId}
        activityLatestBacktestStrategyId={activityLatestBacktestStrategyId}
        activityLatestBacktestReview={activityLatestBacktestReview}
        activityLatestActionableBacktestRecord={activityLatestActionableBacktestRecord}
        activityLatestActionableBacktestHasRecommendation={activityLatestActionableBacktestHasRecommendation}
        activityLatestActionableBacktestDiffersFromLatest={activityLatestActionableBacktestDiffersFromLatest}
        activityLatestActionableBacktestJobCanRetry={activityLatestActionableBacktestJobCanRetry}
        activityLatestBacktestSourceChangeRequestId={activityLatestBacktestSourceChangeRequestId}
        activityLatestBacktestSourceBacktestId={activityLatestBacktestSourceBacktestId}
        activityLatestBacktestSourceReviewId={activityLatestBacktestSourceReviewId}
        activityLatestBacktestSourceProposalId={activityLatestBacktestSourceProposalId}
        activityLatestActionablePrimaryReviewStrategyId={activityLatestActionablePrimaryReviewStrategyId}
        activityLatestActionablePrimaryReviewHasRecommendation={activityLatestActionablePrimaryReviewHasRecommendation}
        activityLatestActionablePrimaryReviewRecord={activityLatestActionablePrimaryReviewRecord}
        activityLatestActionablePrimaryReviewDiffersFromLatest={activityLatestActionablePrimaryReviewDiffersFromLatest}
        activityLatestTrackingJobLinkedReviewId={activityLatestTrackingJobLinkedReviewId}
        activityLatestTrackingJobChangeRequestId={activityLatestTrackingJobChangeRequestId}
        activityLatestTrackingJobBacktestId={activityLatestTrackingJobBacktestId}
        activityLatestTrackingJobSourceChangeRequestId={activityLatestTrackingJobSourceChangeRequestId}
        activityLatestTrackingJobSourceBacktestId={activityLatestTrackingJobSourceBacktestId}
        activityLatestTrackingJobSourceReviewId={activityLatestTrackingJobSourceReviewId}
        activityLatestTrackingJobSourceProposalId={activityLatestTrackingJobSourceProposalId}
        activityLatestTrackingJobStrategyId={activityLatestTrackingJobStrategyId}
        latestPrimaryReviewOpenId={latestPrimaryReviewOpenId}
        latestTrackingReviewOpenId={latestTrackingReviewOpenId}
        latestTrackingJobOpenId={latestTrackingJobOpenId}
        latestBacktestReviewOpenId={latestBacktestReviewOpenId}
        latestBacktestJobOpenId={latestBacktestJobOpenId}
        latestActionableBacktestJobOpenId={latestActionableBacktestJobOpenId}
        latestActionablePrimaryReviewOpenId={latestActionablePrimaryReviewOpenId}
        latestPrimaryReviewSourceJobId={latestPrimaryReviewSourceJobId}
        latestPrimaryReviewSourceChangeRequestId={latestPrimaryReviewSourceChangeRequestId}
        latestPrimaryReviewSourceBacktestId={latestPrimaryReviewSourceBacktestId}
        latestPrimaryReviewSourceReviewId={latestPrimaryReviewSourceReviewId}
        latestPrimaryReviewSourceProposalId={latestPrimaryReviewSourceProposalId}
        latestTrackingReviewSourceJobId={latestTrackingReviewSourceJobId}
        latestTrackingReviewSourceChangeRequestId={latestTrackingReviewSourceChangeRequestId}
        latestTrackingReviewSourceBacktestId={latestTrackingReviewSourceBacktestId}
        latestTrackingReviewSourceReviewId={latestTrackingReviewSourceReviewId}
        latestTrackingReviewSourceProposalId={latestTrackingReviewSourceProposalId}
        serviceAvailable={serviceAvailable}
        backtestMutationPending={backtestMutationPending}
        retryAgentJobMutationPending={retryAgentJobMutationPending}
        onOpenStrategyProposal={onOpenStrategyProposal}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenReplayReview={onOpenReplayReview}
        onOpenReviewInspector={onOpenReviewInspector}
        onOpenSourceReview={onOpenSourceReview}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
        onRetryAgentJobWithFocus={onRetryAgentJobWithFocus}
        onRerunBacktestFromRecommendation={onRerunBacktestFromRecommendation}
        onRerunBacktestFromReview={onRerunBacktestFromReview}
      />

      <TopActionableDecisionActions
        showProposalChangeActions={showProposalChangeActions}
        showActionableActions={showActionableActions}
        activityLatestChangeRequest={activityLatestChangeRequest}
        activityLatestChangeRequestStrategyId={activityLatestChangeRequestStrategyId}
        activityLatestChangeRequestLinkedBacktestId={activityLatestChangeRequestLinkedBacktestId}
        activityLatestChangeRequestLinkedReviewId={activityLatestChangeRequestLinkedReviewId}
        activityLatestChangeRequestSourceBacktestId={activityLatestChangeRequestSourceBacktestId}
        activityLatestChangeRequestSourceBacktestStrategyId={activityLatestChangeRequestSourceBacktestStrategyId}
        activityLatestChangeRequestSourceReviewId={activityLatestChangeRequestSourceReviewId}
        activityLatestChangeRequestSourceReviewStrategyId={activityLatestChangeRequestSourceReviewStrategyId}
        activityLatestChangeRequestSourceProposalId={activityLatestChangeRequestSourceProposalId}
        activityLatestChangeRequestSourceProposalStrategyId={activityLatestChangeRequestSourceProposalStrategyId}
        activityLatestProposalLinkedChangeRequest={activityLatestProposalLinkedChangeRequest}
        activityLatestProposalLinkedBacktest={activityLatestProposalLinkedBacktest}
        activityLatestProposalLinkedReview={activityLatestProposalLinkedReview}
        activityLatestActionableProposal={activityLatestActionableProposal}
        activityLatestActionableProposalDiffersFromLatest={activityLatestActionableProposalDiffersFromLatest}
        activityLatestActionableProposalAcceptTitle={activityLatestActionableProposalAcceptTitle}
        activityLatestActionableProposalAcceptDisabled={activityLatestActionableProposalAcceptDisabled}
        activityLatestActionableChangeRequest={activityLatestActionableChangeRequest}
        activityLatestActionableChangeRequestDiffersFromLatest={activityLatestActionableChangeRequestDiffersFromLatest}
        activityLatestActionableChangeRequestHasRerunRecommendation={activityLatestActionableChangeRequestHasRerunRecommendation}
        activityLatestRetryableTrackingJob={activityLatestRetryableTrackingJob}
        activityLatestRetryableTrackingJobDiffersFromLatest={activityLatestRetryableTrackingJobDiffersFromLatest}
        latestProposalChangeRequestStrategyId={latestProposalChangeRequestStrategyId}
        latestProposalReviewStrategyId={latestProposalReviewStrategyId}
        latestProposalJobId={latestProposalJobId}
        latestChangeRequestJobId={latestChangeRequestJobId}
        actionableChangeRequestRetryJobId={actionableChangeRequestRetryJobId}
        actionableChangeRequestCanRetry={actionableChangeRequestCanRetry}
        retryableTrackingJobOpenId={retryableTrackingJobOpenId}
        serviceAvailable={serviceAvailable}
        proposalMutationPending={proposalMutationPending}
        backtestMutationPending={backtestMutationPending}
        retryAgentJobMutationPending={retryAgentJobMutationPending}
        onOpenStrategyProposal={onOpenStrategyProposal}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenReplayReview={onOpenReplayReview}
        onOpenReviewInspector={onOpenReviewInspector}
        onOpenSourceReview={onOpenSourceReview}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
        onHandleProposalAction={onHandleProposalAction}
        onRetryAgentJobWithFocus={onRetryAgentJobWithFocus}
        onRerunBacktestFromChangeRequest={onRerunBacktestFromChangeRequest}
      />
    </>
  )
}
