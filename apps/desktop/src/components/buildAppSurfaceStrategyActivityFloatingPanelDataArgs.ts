import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildStrategyActivityFloatingPanelSurfaceArgsInput } from './buildStrategyActivityFloatingPanelSurfaceArgs'

export type BuildAppSurfaceStrategyActivityFloatingPanelDataArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAppSurfaceStrategyActivityFloatingPanelDataArgs({
  source,
}: BuildAppSurfaceStrategyActivityFloatingPanelDataArgsInput): Omit<
  BuildStrategyActivityFloatingPanelSurfaceArgsInput,
  | 'navigationActions'
  | 'strategyWorkspaceActions'
  | 'workspaceControlActions'
  | 'strategyWorkflowActions'
  | 'tradingExecutionActions'
  | 'setters'
> {
  const {
    selectedMode,
    strategyActivityPanelOpen,
    aiSchedulerFocusedJobId,
    selectedProposalId,
    selectedChangeRequestId,
    snapshot,
    selectedStrategy,
    activeStrategyId,
    strategyActivityQuery,
    strategyActivityQueryErrorMessage,
    backtests,
    serviceAvailable,
    strategyActivitySnapshotModel,
    backtestReviewJobs,
    reviewCatalog,
    strategyActivityDecisionModel,
    strategyActivityProgressModel,
    strategyActivityOpsModel,
    selectedStrategyChangeRequest,
    selectedBacktest,
    replayFocusReview,
    backtestFocusLabels,
    proposalFocusLabels,
    replacePaperOrderPending,
    replaceExchangeOrderPending,
    cancelPaperOrderPending,
    cancelExchangeOrderPending,
    strategyWorkflowActions,
    workspaceControlActions,
  } = source

  return {
    panelOpen: strategyActivityPanelOpen,
    selectedStrategy,
    strategyActivitySnapshotModel,
    activityMeta: strategyActivitySnapshotModel.meta,
    activeStrategyId,
    decisionModel: strategyActivityDecisionModel,
    progressModel: strategyActivityProgressModel,
    opsModel: strategyActivityOpsModel,
    queryState: {
      status: strategyActivityQuery.status,
      fetchStatus: strategyActivityQuery.fetchStatus,
      errorMessage: strategyActivityQueryErrorMessage,
      loading: strategyActivityQuery.isFetching,
    },
    serviceState: {
      serviceAvailable,
      strategyTrackingPending: strategyWorkflowActions.strategyTrackingMutationPending,
      selectedMode,
      alertMutationPending: workspaceControlActions.alertMutationPending,
      cancelPaperOrderPending,
      cancelExchangeOrderPending,
      replacePaperOrderPending,
      replaceExchangeOrderPending,
      proposalMutationPending: strategyWorkflowActions.proposalMutationPending,
      backtestMutationPending: strategyWorkflowActions.backtestMutationPending,
      retryAgentJobMutationPending: strategyWorkflowActions.retryAgentJobMutationPending,
    },
    workspaceState: {
      selectedStrategyChangeRequest,
      selectedBacktest,
      backtests,
      reviewCatalog,
      backtestReviewJobs,
      selectedProposalId,
      selectedChangeRequestId,
      aiSchedulerFocusedJobId,
      replayFocusReview,
      schedulerState: snapshot?.scheduler,
    },
    focusLabels: {
      proposalFocusLabels,
      backtestFocusLabels,
    },
  }
}
