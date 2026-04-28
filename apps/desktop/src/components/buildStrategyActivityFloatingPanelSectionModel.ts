import { proposalAcceptBlockedReason } from '../utils/app-helpers'
import type { BuildStrategyActivityFloatingPanelPropsArgs } from './buildStrategyActivityFloatingPanelProps'
import type { StrategyActivityDecisionSelectors } from './buildStrategyActivityDecisionSectionProps'
import {
  buildStrategyActivityFloatingPanelSectionProps,
  type StrategyActivityFloatingPanelActions,
  type StrategyActivityFloatingPanelCollectionState,
  type StrategyActivityFloatingPanelDerivedState,
  type StrategyActivityFloatingPanelServiceState,
} from './buildStrategyActivityFloatingPanelSectionProps'

type StrategyActivityFloatingPanelDecisionModel =
  BuildStrategyActivityFloatingPanelPropsArgs['decisionModel']
type StrategyActivityFloatingPanelProgressModel =
  BuildStrategyActivityFloatingPanelPropsArgs['progressModel']
type StrategyActivityFloatingPanelOpsModel = BuildStrategyActivityFloatingPanelPropsArgs['opsModel']

export type BuildStrategyActivityFloatingPanelSectionModelArgs = Pick<
  BuildStrategyActivityFloatingPanelPropsArgs,
  | 'selectedStrategy'
  | 'strategyActivitySnapshotModel'
  | 'serviceState'
  | 'workspaceState'
  | 'decisionModel'
  | 'progressModel'
  | 'opsModel'
  | 'actions'
  | 'focusLabels'
>

function buildStrategyActivityFloatingPanelDerivedState({
  decisionModel,
  progressModel,
  opsModel,
}: {
  decisionModel: StrategyActivityFloatingPanelDecisionModel
  progressModel: StrategyActivityFloatingPanelProgressModel
  opsModel: StrategyActivityFloatingPanelOpsModel
}): StrategyActivityFloatingPanelDerivedState {
  return {
    ...decisionModel,
    ...progressModel,
    ...opsModel,
  }
}

function buildStrategyActivityFloatingPanelCollectionState({
  selectedStrategy,
  workspaceState,
  decisionModel,
  progressModel,
  opsModel,
}: Omit<BuildStrategyActivityFloatingPanelSectionModelArgs, 'strategyActivitySnapshotModel' | 'serviceState' | 'actions' | 'focusLabels'>): StrategyActivityFloatingPanelCollectionState {
  return {
    ...decisionModel,
    ...progressModel,
    ...opsModel,
    selectedStrategyChangeRequest: workspaceState.selectedStrategyChangeRequest,
    selectedBacktest: workspaceState.selectedBacktest,
    backtests: workspaceState.backtests,
    reviewCatalog: workspaceState.reviewCatalog,
    backtestReviewJobs: workspaceState.backtestReviewJobs,
    selectedProposalId: workspaceState.selectedProposalId,
    selectedChangeRequestId: workspaceState.selectedChangeRequestId,
    selectedStrategyId: selectedStrategy?.id ?? null,
    replayFocusReview: workspaceState.replayFocusReview,
    aiSchedulerFocusedJobId: workspaceState.aiSchedulerFocusedJobId,
  }
}

function buildStrategyActivityFloatingPanelServiceState({
  serviceState,
}: Pick<BuildStrategyActivityFloatingPanelSectionModelArgs, 'serviceState'>): StrategyActivityFloatingPanelServiceState {
  return {
    serviceAvailable: serviceState.serviceAvailable,
    selectedMode: serviceState.selectedMode,
    alertMutationPending: serviceState.alertMutationPending,
    cancelPaperOrderPending: serviceState.cancelPaperOrderPending,
    cancelExchangeOrderPending: serviceState.cancelExchangeOrderPending,
    replacePaperOrderPending: serviceState.replacePaperOrderPending,
    replaceExchangeOrderPending: serviceState.replaceExchangeOrderPending,
    proposalMutationPending: serviceState.proposalMutationPending,
    backtestMutationPending: serviceState.backtestMutationPending,
    retryAgentJobMutationPending: serviceState.retryAgentJobMutationPending,
  }
}

function buildStrategyActivityFloatingPanelActions({
  actions,
}: Pick<BuildStrategyActivityFloatingPanelSectionModelArgs, 'actions'>): StrategyActivityFloatingPanelActions {
  return {
    onOpenAlertsSection: actions.onOpenAlertsSection,
    onOpenMarketSymbol: actions.onOpenMarketSymbol,
    onOpenTradesSection: actions.onOpenTradesSection,
    onOpenWatchlistManager: actions.onOpenWatchlistManager,
    onToggleAlertAcknowledged: actions.onToggleAlertAcknowledged,
    onOpenOrderEditor: actions.onOpenOrderEditor,
    onCancelPaperOrder: actions.onCancelPaperOrder,
    onCancelExchangeOrder: actions.onCancelExchangeOrder,
    onOpenAuditSection: actions.onOpenAuditSection,
    onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
    onOpenReviewInspector: actions.onOpenReviewInspector,
    onOpenChangeRequest: actions.onOpenChangeRequest,
    onOpenBacktestDetail: actions.onOpenBacktestDetail,
    onOpenSourceReview: actions.onOpenSourceReview,
    onOpenStrategyProposal: actions.onOpenStrategyProposal,
    onHandleProposalAction: (proposalId, action) => {
      actions.onHandleProposalAction(proposalId, action)
    },
    onRetryAgentJobWithFocus: (jobId) => {
      actions.onRetryAgentJob(jobId, { focusJob: true })
    },
    onRerunBacktestFromChangeRequest: (request) => {
      actions.onRerunBacktestFromChangeRequest(request)
    },
    onRerunBacktestFromRecommendation: (backtest) => {
      actions.onRerunBacktestFromRecommendation(backtest)
    },
    onRerunBacktestFromReview: (review) => {
      actions.onRerunBacktestFromReview(review)
    },
    onOpenReplayReview: actions.onOpenReplayReview,
    onOpenStrategyReplay: actions.onOpenStrategyReplay,
    onRetryAgentJob: (jobId) => {
      actions.onRetryAgentJob(jobId)
    },
  }
}

function buildStrategyActivityFloatingPanelSelectors({
  workspaceState,
  decisionModel,
  progressModel,
  focusLabels,
}: Pick<
  BuildStrategyActivityFloatingPanelSectionModelArgs,
  'workspaceState' | 'decisionModel' | 'progressModel' | 'focusLabels'
>): StrategyActivityDecisionSelectors {
  return {
    getStrategyActivityProposalLinkedState: decisionModel.getStrategyActivityProposalLinkedState,
    getStrategyActivityChangeRequestLinkedState:
      progressModel.getStrategyActivityChangeRequestLinkedState,
    proposalFocusLabels: focusLabels.proposalFocusLabels,
    backtestFocusLabels: focusLabels.backtestFocusLabels,
    getProposalBlockedReason: (proposal) =>
      proposalAcceptBlockedReason(proposal.proposal_type, workspaceState.schedulerState),
  }
}

export function buildStrategyActivityFloatingPanelSectionModel({
  selectedStrategy,
  strategyActivitySnapshotModel,
  serviceState,
  workspaceState,
  decisionModel,
  progressModel,
  opsModel,
  actions,
  focusLabels,
}: BuildStrategyActivityFloatingPanelSectionModelArgs) {
  return buildStrategyActivityFloatingPanelSectionProps({
    strategyActivitySnapshotModel,
    derivedState: buildStrategyActivityFloatingPanelDerivedState({
      decisionModel,
      progressModel,
      opsModel,
    }),
    collectionState: buildStrategyActivityFloatingPanelCollectionState({
      selectedStrategy,
      workspaceState,
      decisionModel,
      progressModel,
      opsModel,
    }),
    serviceState: buildStrategyActivityFloatingPanelServiceState({ serviceState }),
    actions: buildStrategyActivityFloatingPanelActions({ actions }),
    selectors: buildStrategyActivityFloatingPanelSelectors({
      workspaceState,
      decisionModel,
      progressModel,
      focusLabels,
    }),
  })
}
