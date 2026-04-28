import type { BuildStrategyActivityFloatingPanelPropsArgs } from './buildStrategyActivityFloatingPanelProps'

type StrategyActivityFloatingPanelQueryState =
  BuildStrategyActivityFloatingPanelPropsArgs['queryState']
type StrategyActivityFloatingPanelServiceState =
  BuildStrategyActivityFloatingPanelPropsArgs['serviceState']
type StrategyActivityFloatingPanelWorkspaceState =
  BuildStrategyActivityFloatingPanelPropsArgs['workspaceState']
type StrategyActivityFloatingPanelFocusLabels =
  BuildStrategyActivityFloatingPanelPropsArgs['focusLabels']

export type BuildStrategyActivityFloatingPanelDerivedStateArgs = {
  queryState: {
    status: StrategyActivityFloatingPanelQueryState['status']
    fetchStatus: StrategyActivityFloatingPanelQueryState['fetchStatus']
    errorMessage: StrategyActivityFloatingPanelQueryState['errorMessage']
    loading: StrategyActivityFloatingPanelQueryState['loading']
  }
  serviceState: StrategyActivityFloatingPanelServiceState
  workspaceState: StrategyActivityFloatingPanelWorkspaceState
  focusLabels: StrategyActivityFloatingPanelFocusLabels
}

export type BuildStrategyActivityFloatingPanelDerivedStateResult = Pick<
  BuildStrategyActivityFloatingPanelPropsArgs,
  'queryState' | 'serviceState' | 'workspaceState' | 'focusLabels'
>

export function buildStrategyActivityFloatingPanelDerivedState({
  queryState,
  serviceState,
  workspaceState,
  focusLabels,
}: BuildStrategyActivityFloatingPanelDerivedStateArgs): BuildStrategyActivityFloatingPanelDerivedStateResult {
  return {
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
  }
}
