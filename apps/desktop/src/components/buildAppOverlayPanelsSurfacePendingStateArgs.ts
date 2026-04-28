import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'

type AppOverlayPanelsSurfaceArgs = BuildAppSurfaceModelsArgsInput['appOverlayPanels']
type AppOverlayPanelsPendingState = AppOverlayPanelsSurfaceArgs['pendingState']

export type BuildAppOverlayPanelsSurfacePendingStateArgsInput = {
  changeRequestMutationPending: AppOverlayPanelsPendingState['changeRequestMutationPending']
  schedulerMutationPending: AppOverlayPanelsPendingState['schedulerMutationPending']
  watchlistAddPending: AppOverlayPanelsPendingState['watchlistAddPending']
  watchlistRemovePending: AppOverlayPanelsPendingState['watchlistRemovePending']
  manualTradeMutationPending: AppOverlayPanelsPendingState['manualTradeMutationPending']
  exchangeOrderMutationPending: AppOverlayPanelsPendingState['exchangeOrderMutationPending']
  paperOrderMutationPending: AppOverlayPanelsPendingState['paperOrderMutationPending']
  replacePaperOrderPending: AppOverlayPanelsPendingState['replacePaperOrderPending']
  replaceExchangeOrderPending: AppOverlayPanelsPendingState['replaceExchangeOrderPending']
  cancelPaperOrderPending: AppOverlayPanelsPendingState['cancelPaperOrderPending']
  cancelExchangeOrderPending: AppOverlayPanelsPendingState['cancelExchangeOrderPending']
  strategyTrackingMutationPending: AppOverlayPanelsPendingState['strategyTrackingMutationPending']
  backtestMutationPending: AppOverlayPanelsPendingState['backtestMutationPending']
  retryAgentJobMutationPending: AppOverlayPanelsPendingState['retryAgentJobMutationPending']
  proposalMutationPending: AppOverlayPanelsPendingState['proposalMutationPending']
}

export function buildAppOverlayPanelsSurfacePendingStateArgs({
  changeRequestMutationPending,
  schedulerMutationPending,
  watchlistAddPending,
  watchlistRemovePending,
  manualTradeMutationPending,
  exchangeOrderMutationPending,
  paperOrderMutationPending,
  replacePaperOrderPending,
  replaceExchangeOrderPending,
  cancelPaperOrderPending,
  cancelExchangeOrderPending,
  strategyTrackingMutationPending,
  backtestMutationPending,
  retryAgentJobMutationPending,
  proposalMutationPending,
}: BuildAppOverlayPanelsSurfacePendingStateArgsInput): AppOverlayPanelsPendingState {
  return {
    changeRequestMutationPending,
    schedulerMutationPending,
    watchlistAddPending,
    watchlistRemovePending,
    manualTradeMutationPending,
    exchangeOrderMutationPending,
    paperOrderMutationPending,
    replacePaperOrderPending,
    replaceExchangeOrderPending,
    cancelPaperOrderPending,
    cancelExchangeOrderPending,
    strategyTrackingMutationPending,
    backtestMutationPending,
    retryAgentJobMutationPending,
    proposalMutationPending,
  }
}
