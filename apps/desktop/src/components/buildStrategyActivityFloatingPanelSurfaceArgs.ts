import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'
import type { useStrategyActivityDecisionModel } from './useStrategyActivityDecisionModel'
import type { useStrategyActivityOpsModel } from './useStrategyActivityOpsModel'
import type { useStrategyActivityProgressModel } from './useStrategyActivityProgressModel'
import type { useStrategyWorkflowActions } from './useStrategyWorkflowActions'
import type { useStrategyWorkspaceActions } from './useStrategyWorkspaceActions'
import type { useTradingExecutionActions } from './useTradingExecutionActions'
import type { useWorkspaceControlActions } from './useWorkspaceControlActions'
import type { useWorkspaceNavigation } from './useWorkspaceNavigation'

type StrategyActivityFloatingPanelSurfaceArgs = BuildAppSurfaceModelsArgsInput['strategyActivityFloatingPanel']
type StrategyActivityDecisionModel = ReturnType<typeof useStrategyActivityDecisionModel>
type StrategyActivityProgressModel = ReturnType<typeof useStrategyActivityProgressModel>
type StrategyActivityOpsModel = ReturnType<typeof useStrategyActivityOpsModel>
type WorkspaceNavigationModel = ReturnType<typeof useWorkspaceNavigation>
type StrategyWorkspaceActionsModel = ReturnType<typeof useStrategyWorkspaceActions>
type WorkspaceControlActionsModel = ReturnType<typeof useWorkspaceControlActions>
type StrategyWorkflowActionsModel = ReturnType<typeof useStrategyWorkflowActions>
type TradingExecutionActionsModel = ReturnType<typeof useTradingExecutionActions>

export type BuildStrategyActivityFloatingPanelSurfaceArgsInput = {
  panelOpen: StrategyActivityFloatingPanelSurfaceArgs['panelOpen']
  selectedStrategy: StrategyActivityFloatingPanelSurfaceArgs['selectedStrategy']
  strategyActivitySnapshotModel: StrategyActivityFloatingPanelSurfaceArgs['strategyActivitySnapshotModel']
  activityMeta: StrategyActivityFloatingPanelSurfaceArgs['activityMeta']
  activeStrategyId: StrategyActivityFloatingPanelSurfaceArgs['activeStrategyId']
  decisionModel: StrategyActivityDecisionModel
  progressModel: StrategyActivityProgressModel
  opsModel: StrategyActivityOpsModel
  queryState: {
    status: StrategyActivityFloatingPanelSurfaceArgs['queryState']['status']
    fetchStatus: StrategyActivityFloatingPanelSurfaceArgs['queryState']['fetchStatus']
    errorMessage: StrategyActivityFloatingPanelSurfaceArgs['queryState']['errorMessage']
    loading: StrategyActivityFloatingPanelSurfaceArgs['queryState']['loading']
  }
  serviceState: StrategyActivityFloatingPanelSurfaceArgs['serviceState']
  workspaceState: {
    selectedStrategyChangeRequest: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['selectedStrategyChangeRequest']
    selectedBacktest: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['selectedBacktest']
    backtests: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['backtests']
    reviewCatalog: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['reviewCatalog']
    backtestReviewJobs: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['backtestReviewJobs']
    selectedProposalId: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['selectedProposalId']
    selectedChangeRequestId: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['selectedChangeRequestId']
    aiSchedulerFocusedJobId: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['aiSchedulerFocusedJobId']
    replayFocusReview: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['replayFocusReview']
    schedulerState: StrategyActivityFloatingPanelSurfaceArgs['workspaceState']['schedulerState']
  }
  focusLabels: StrategyActivityFloatingPanelSurfaceArgs['focusLabels']
  navigationActions: Pick<
    WorkspaceNavigationModel,
    | 'openAlertsSection'
    | 'openMarketSymbol'
    | 'openTradesSection'
    | 'openAuditSection'
    | 'openAiSchedulerJob'
    | 'openReviewInspector'
    | 'openChangeRequest'
    | 'openBacktestDetail'
    | 'openSourceReview'
    | 'openStrategyProposal'
    | 'openReplayReview'
    | 'openStrategyReplay'
  >
  strategyWorkspaceActions: Pick<StrategyWorkspaceActionsModel, 'openStrategyTrackingPanel'>
  workspaceControlActions: Pick<WorkspaceControlActionsModel, 'toggleAlertAcknowledged'>
  strategyWorkflowActions: Pick<
    StrategyWorkflowActionsModel,
    | 'handleProposalAction'
    | 'retryAgentJob'
    | 'rerunBacktestFromChangeRequest'
    | 'rerunBacktestFromRecommendation'
    | 'rerunBacktestFromReview'
  >
  tradingExecutionActions: Pick<
    TradingExecutionActionsModel,
    'openOrderEditor' | 'cancelPaperOrder' | 'cancelExchangeOrder'
  >
  setters: StrategyActivityFloatingPanelSurfaceArgs['setters']
}

export function buildStrategyActivityFloatingPanelSurfaceArgs({
  panelOpen,
  selectedStrategy,
  strategyActivitySnapshotModel,
  activityMeta,
  activeStrategyId,
  decisionModel,
  progressModel,
  opsModel,
  queryState,
  serviceState,
  workspaceState,
  focusLabels,
  navigationActions,
  strategyWorkspaceActions,
  workspaceControlActions,
  strategyWorkflowActions,
  tradingExecutionActions,
  setters,
}: BuildStrategyActivityFloatingPanelSurfaceArgsInput): StrategyActivityFloatingPanelSurfaceArgs {
  return {
    panelOpen,
    selectedStrategy,
    strategyActivitySnapshotModel,
    activityMeta,
    activeStrategyId,
    decisionModel,
    progressModel,
    opsModel,
    queryState: {
      status: queryState.status,
      fetchStatus: queryState.fetchStatus,
      errorMessage: queryState.errorMessage,
      loading: queryState.loading,
    },
    serviceState: {
      serviceAvailable: serviceState.serviceAvailable,
      strategyTrackingPending: serviceState.strategyTrackingPending,
      selectedMode: serviceState.selectedMode,
      alertMutationPending: serviceState.alertMutationPending,
      cancelPaperOrderPending: serviceState.cancelPaperOrderPending,
      cancelExchangeOrderPending: serviceState.cancelExchangeOrderPending,
      replacePaperOrderPending: serviceState.replacePaperOrderPending,
      replaceExchangeOrderPending: serviceState.replaceExchangeOrderPending,
      proposalMutationPending: serviceState.proposalMutationPending,
      backtestMutationPending: serviceState.backtestMutationPending,
      retryAgentJobMutationPending: serviceState.retryAgentJobMutationPending,
    },
    workspaceState: {
      selectedStrategyChangeRequest: workspaceState.selectedStrategyChangeRequest,
      selectedBacktest: workspaceState.selectedBacktest,
      backtests: workspaceState.backtests,
      reviewCatalog: workspaceState.reviewCatalog,
      backtestReviewJobs: workspaceState.backtestReviewJobs,
      selectedProposalId: workspaceState.selectedProposalId,
      selectedChangeRequestId: workspaceState.selectedChangeRequestId,
      aiSchedulerFocusedJobId: workspaceState.aiSchedulerFocusedJobId,
      replayFocusReview: workspaceState.replayFocusReview,
      schedulerState: workspaceState.schedulerState,
    },
    focusLabels: {
      proposalFocusLabels: focusLabels.proposalFocusLabels,
      backtestFocusLabels: focusLabels.backtestFocusLabels,
    },
    navigationActions,
    strategyWorkspaceActions,
    workspaceControlActions,
    strategyWorkflowActions,
    tradingExecutionActions,
    setters,
  }
}
