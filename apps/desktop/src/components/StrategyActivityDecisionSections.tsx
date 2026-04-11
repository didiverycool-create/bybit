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
  ActivityBacktestList,
  ActivityChangeRequestList,
  ActivityProposalList,
} from './strategy-activity-sections'

type ProposalLinkedState = {
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedChangeRequest: ChangeRequest | null
  linkedJob: AgentJob | null
}

type ChangeRequestLinkedState = {
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedJob: AgentJob | null
  sourceBacktest: BacktestRun | null
  sourceReview: ReviewDocument | null
  sourceProposal: StrategyProposal | null
}

export type StrategyActivityDecisionSectionsProps = {
  strategyId: string
  recentProposalIds: string[]
  recentChangeRequestIds: string[]
  recentBacktestIds: string[]
  selectedStrategyProposal: StrategyProposal | null
  selectedStrategyChangeRequest: ChangeRequest | null
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktest: BacktestRun | null
  strategyActivityLatestProposalSupplemented: boolean
  strategyActivityLatestActionableProposalSupplemented: boolean
  strategyActivityLatestChangeRequestSupplemented: boolean
  strategyActivityLatestActionableChangeRequestSupplemented: boolean
  strategyActivityLatestBacktestSupplemented: boolean
  strategyActivityLatestActionableBacktestSupplemented: boolean
  strategyActivityProposals: StrategyProposal[]
  strategyActivityChangeRequests: ChangeRequest[]
  strategyActivityBacktests: StrategyActivityBacktestSummary[]
  activityLatestProposal: StrategyProposal | null
  activityLatestActionableProposal: StrategyProposal | null
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestActionableChangeRequest: ChangeRequest | null
  activityLatestBacktest: StrategyActivityBacktestSummary | null
  activityLatestActionableBacktest: StrategyActivityBacktestSummary | null
  activityLatestActionableBacktestReview: ReviewDocument | null
  activityLatestBacktestReview: ReviewDocument | null
  activityLatestActionableBacktestJob: AgentJob | null
  activityLatestBacktestJob: AgentJob | null
  backtests: BacktestRun[]
  reviewCatalog: ReviewDocument[]
  backtestReviewJobs: AgentJob[]
  serviceAvailable: boolean
  proposalMutationPending: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  getStrategyActivityProposalLinkedState: (proposal?: StrategyProposal | null) => ProposalLinkedState
  getStrategyActivityChangeRequestLinkedState: (request?: ChangeRequest | null) => ChangeRequestLinkedState
  proposalFocusLabels: (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
  getProposalBlockedReason: (proposal: StrategyProposal) => string | null
  backtestFocusLabels: (
    backtest: StrategyActivityBacktestSummary,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

export default function StrategyActivityDecisionSections({
  strategyId,
  recentProposalIds,
  recentChangeRequestIds,
  recentBacktestIds,
  selectedStrategyProposal,
  selectedStrategyChangeRequest,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktest,
  strategyActivityLatestProposalSupplemented,
  strategyActivityLatestActionableProposalSupplemented,
  strategyActivityLatestChangeRequestSupplemented,
  strategyActivityLatestActionableChangeRequestSupplemented,
  strategyActivityLatestBacktestSupplemented,
  strategyActivityLatestActionableBacktestSupplemented,
  strategyActivityProposals,
  strategyActivityChangeRequests,
  strategyActivityBacktests,
  activityLatestProposal,
  activityLatestActionableProposal,
  activityLatestChangeRequest,
  activityLatestActionableChangeRequest,
  activityLatestBacktest,
  activityLatestActionableBacktest,
  activityLatestActionableBacktestReview,
  activityLatestBacktestReview,
  activityLatestActionableBacktestJob,
  activityLatestBacktestJob,
  backtests,
  reviewCatalog,
  backtestReviewJobs,
  serviceAvailable,
  proposalMutationPending,
  backtestMutationPending,
  retryAgentJobMutationPending,
  getStrategyActivityProposalLinkedState,
  getStrategyActivityChangeRequestLinkedState,
  proposalFocusLabels,
  getProposalBlockedReason,
  backtestFocusLabels,
  onOpenStrategyProposal,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenReviewInspector,
  onOpenReplayReview,
  onOpenAiSchedulerJob,
  onOpenSourceReview,
  onRetryAgentJob,
  onHandleProposalAction,
  onRerunBacktestFromChangeRequest,
}: StrategyActivityDecisionSectionsProps) {
  const focusedProposalSupplemented = Boolean(
    selectedStrategyProposal &&
      selectedStrategyProposal.strategy_id === strategyId &&
      !recentProposalIds.includes(selectedStrategyProposal.id),
  )
  const focusedChangeRequestSupplemented = Boolean(
    selectedStrategyChangeRequest &&
      getChangeRequestStrategyId(selectedStrategyChangeRequest, strategyId) === strategyId &&
      !recentChangeRequestIds.includes(selectedStrategyChangeRequest.id),
  )
  const focusedBacktestSupplemented = Boolean(
    selectedBacktest &&
      selectedBacktest.strategy_id === strategyId &&
      !recentBacktestIds.includes(selectedBacktest.id),
  )

  return (
    <>
      <ActivityProposalList
        focusedProposalSupplemented={focusedProposalSupplemented}
        strategyActivityLatestProposalSupplemented={strategyActivityLatestProposalSupplemented}
        strategyActivityLatestActionableProposalSupplemented={strategyActivityLatestActionableProposalSupplemented}
        strategyActivityProposals={strategyActivityProposals}
        activityLatestProposal={activityLatestProposal}
        activityLatestActionableProposal={activityLatestActionableProposal}
        selectedProposalId={selectedProposalId}
        serviceAvailable={serviceAvailable}
        proposalMutationPending={proposalMutationPending}
        retryAgentJobMutationPending={retryAgentJobMutationPending}
        getStrategyActivityProposalLinkedState={getStrategyActivityProposalLinkedState}
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

      <ActivityChangeRequestList
        strategyId={strategyId}
        focusedChangeRequestSupplemented={focusedChangeRequestSupplemented}
        strategyActivityLatestChangeRequestSupplemented={strategyActivityLatestChangeRequestSupplemented}
        strategyActivityLatestActionableChangeRequestSupplemented={strategyActivityLatestActionableChangeRequestSupplemented}
        strategyActivityChangeRequests={strategyActivityChangeRequests}
        activityLatestChangeRequest={activityLatestChangeRequest}
        activityLatestActionableChangeRequest={activityLatestActionableChangeRequest}
        selectedChangeRequestId={selectedChangeRequestId}
        serviceAvailable={serviceAvailable}
        backtestMutationPending={backtestMutationPending}
        retryAgentJobMutationPending={retryAgentJobMutationPending}
        getStrategyActivityChangeRequestLinkedState={getStrategyActivityChangeRequestLinkedState}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenReviewInspector={onOpenReviewInspector}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
        onOpenSourceReview={onOpenSourceReview}
        onOpenStrategyProposal={onOpenStrategyProposal}
        onRetryAgentJob={onRetryAgentJob}
        onRerunBacktestFromChangeRequest={onRerunBacktestFromChangeRequest}
      />

      <ActivityBacktestList
        strategyId={strategyId}
        focusedBacktestSupplemented={focusedBacktestSupplemented}
        strategyActivityLatestBacktestSupplemented={strategyActivityLatestBacktestSupplemented}
        strategyActivityLatestActionableBacktestSupplemented={strategyActivityLatestActionableBacktestSupplemented}
        strategyActivityBacktests={strategyActivityBacktests}
        activityLatestBacktest={activityLatestBacktest}
        activityLatestActionableBacktest={activityLatestActionableBacktest}
        activityLatestActionableBacktestReview={activityLatestActionableBacktestReview}
        activityLatestBacktestReview={activityLatestBacktestReview}
        activityLatestActionableBacktestJob={activityLatestActionableBacktestJob}
        activityLatestBacktestJob={activityLatestBacktestJob}
        backtests={backtests}
        reviewCatalog={reviewCatalog}
        backtestReviewJobs={backtestReviewJobs}
        serviceAvailable={serviceAvailable}
        retryAgentJobMutationPending={retryAgentJobMutationPending}
        backtestFocusLabels={backtestFocusLabels}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenReviewInspector={onOpenReviewInspector}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenSourceReview={onOpenSourceReview}
        onOpenStrategyProposal={onOpenStrategyProposal}
        onRetryAgentJob={onRetryAgentJob}
      />
    </>
  )
}
