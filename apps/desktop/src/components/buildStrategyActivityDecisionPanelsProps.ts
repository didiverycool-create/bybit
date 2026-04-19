import type { StrategyActivityDecisionSectionsProps } from './StrategyActivityDecisionSections'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'
import type {
  StrategyActivityDecisionActions,
  StrategyActivityDecisionSelectors,
  StrategyActivityDecisionServiceState,
  StrategyActivityDecisionState,
} from './buildStrategyActivityDecisionSectionProps'

type BuildStrategyActivityDecisionPanelsPropsArgs = {
  strategyId: string
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  decisionState: StrategyActivityDecisionState
  serviceState: StrategyActivityDecisionServiceState
  actions: StrategyActivityDecisionActions
  selectors: StrategyActivityDecisionSelectors
}

export function buildStrategyActivityDecisionPanelsProps({
  strategyId,
  strategyActivitySnapshotModel,
  decisionState,
  serviceState,
  actions,
  selectors,
}: BuildStrategyActivityDecisionPanelsPropsArgs): StrategyActivityDecisionSectionsProps {
  return {
    strategyId,
    recentProposalIds: strategyActivitySnapshotModel.collections.recentProposals.map(
      (proposal) => proposal.id,
    ),
    recentChangeRequestIds: strategyActivitySnapshotModel.collections.recentChangeRequests.map(
      (request) => request.id,
    ),
    recentBacktestIds: strategyActivitySnapshotModel.collections.recentBacktests.map(
      (backtest) => backtest.id,
    ),
    selectedStrategyProposal: decisionState.selectedStrategyProposal,
    selectedStrategyChangeRequest: decisionState.selectedStrategyChangeRequest,
    selectedProposalId: decisionState.selectedProposalId,
    selectedChangeRequestId: decisionState.selectedChangeRequestId,
    selectedBacktest: decisionState.selectedBacktest,
    strategyActivityLatestProposalSupplemented:
      decisionState.strategyActivityLatestProposalSupplemented,
    strategyActivityLatestActionableProposalSupplemented:
      decisionState.strategyActivityLatestActionableProposalSupplemented,
    strategyActivityLatestChangeRequestSupplemented:
      decisionState.strategyActivityLatestChangeRequestSupplemented,
    strategyActivityLatestActionableChangeRequestSupplemented:
      decisionState.strategyActivityLatestActionableChangeRequestSupplemented,
    strategyActivityLatestBacktestSupplemented:
      decisionState.strategyActivityLatestBacktestSupplemented,
    strategyActivityLatestActionableBacktestSupplemented:
      decisionState.strategyActivityLatestActionableBacktestSupplemented,
    strategyActivityProposals: decisionState.strategyActivityProposals,
    strategyActivityChangeRequests: decisionState.strategyActivityChangeRequests,
    strategyActivityBacktests: decisionState.strategyActivityBacktests,
    activityLatestProposal: decisionState.activityLatestProposal,
    activityLatestActionableProposal: decisionState.activityLatestActionableProposal,
    activityLatestChangeRequest: decisionState.activityLatestChangeRequest,
    activityLatestActionableChangeRequest: decisionState.activityLatestActionableChangeRequest,
    activityLatestBacktest: decisionState.activityLatestBacktest,
    activityLatestActionableBacktest: decisionState.activityLatestActionableBacktest,
    activityLatestActionableBacktestReview: decisionState.activityLatestActionableBacktestReview,
    activityLatestBacktestReview: decisionState.activityLatestBacktestReview,
    activityLatestActionableBacktestJob: decisionState.activityLatestActionableBacktestJob,
    activityLatestBacktestJob: decisionState.activityLatestBacktestJob,
    backtests: decisionState.backtests,
    reviewCatalog: decisionState.reviewCatalog,
    backtestReviewJobs: decisionState.backtestReviewJobs,
    serviceAvailable: serviceState.serviceAvailable,
    proposalMutationPending: serviceState.proposalMutationPending,
    backtestMutationPending: serviceState.backtestMutationPending,
    retryAgentJobMutationPending: serviceState.retryAgentJobMutationPending,
    getStrategyActivityProposalLinkedState: selectors.getStrategyActivityProposalLinkedState,
    getStrategyActivityChangeRequestLinkedState:
      selectors.getStrategyActivityChangeRequestLinkedState,
    proposalFocusLabels: selectors.proposalFocusLabels,
    getProposalBlockedReason: selectors.getProposalBlockedReason,
    backtestFocusLabels: selectors.backtestFocusLabels,
    onOpenStrategyProposal: actions.onOpenStrategyProposal,
    onOpenChangeRequest: actions.onOpenChangeRequest,
    onOpenBacktestDetail: actions.onOpenBacktestDetail,
    onOpenReviewInspector: actions.onOpenReviewInspector,
    onOpenReplayReview: actions.onOpenReplayReview,
    onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
    onOpenSourceReview: actions.onOpenSourceReview,
    onRetryAgentJob: actions.onRetryAgentJobWithFocus,
    onHandleProposalAction: actions.onHandleProposalAction,
    onRerunBacktestFromChangeRequest: actions.onRerunBacktestFromChangeRequest,
  }
}
