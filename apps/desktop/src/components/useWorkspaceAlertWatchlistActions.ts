import type { Dispatch, SetStateAction } from 'react'
import { useMutation } from '@tanstack/react-query'

import { marketApi } from '../apiMarket'
import { opsMonitoringApi } from '../apiOpsMonitoring'
import {
  type ActionTone,
  type SubmitStrategyRequest,
} from './workspaceAlertWatchlistActionsHelpers'
import { buildWorkspaceAlertWatchlistActionHandlers } from './workspaceAlertWatchlistActionHandlers'

type UseWorkspaceAlertWatchlistActionsArgs = {
  refreshControlData: () => Promise<void>
  watchlistDraftSymbol: string
  watchlistDraftMarket: string
  watchlistAlertDrafts: Record<string, string>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setWatchlistDraftSymbol: Dispatch<SetStateAction<string>>
  setWatchlistManagerOpen: Dispatch<SetStateAction<boolean>>
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
  submitStrategyRequest: SubmitStrategyRequest
}

export function useWorkspaceAlertWatchlistActions({
  refreshControlData,
  watchlistDraftSymbol,
  watchlistDraftMarket,
  watchlistAlertDrafts,
  setSelectedSymbol,
  setWatchlistDraftSymbol,
  setWatchlistManagerOpen,
  showFeedback,
  submitStrategyRequest,
}: UseWorkspaceAlertWatchlistActionsArgs) {
  const alertMutation = useMutation({
    mutationFn: ({ alertId, acknowledged }: { alertId: string; acknowledged: boolean }) =>
      opsMonitoringApi.acknowledgeAlert(alertId, acknowledged),
    onSuccess: refreshControlData,
  })

  const watchlistAddMutation = useMutation({
    mutationFn: marketApi.addWatchlistItem,
    onSuccess: refreshControlData,
  })

  const watchlistRemoveMutation = useMutation({
    mutationFn: marketApi.removeWatchlistItem,
    onSuccess: refreshControlData,
  })

  const {
    toggleAlertAcknowledged,
    submitWatchlistItem,
    removeWatchlistItem,
    submitWatchlistAlertRule,
  } = buildWorkspaceAlertWatchlistActionHandlers({
    watchlistDraftSymbol,
    watchlistDraftMarket,
    watchlistAlertDrafts,
    setSelectedSymbol,
    setWatchlistDraftSymbol,
    setWatchlistManagerOpen,
    showFeedback,
    submitStrategyRequest,
    alertMutation,
    watchlistAddMutation,
    watchlistRemoveMutation,
  })

  return {
    alertMutationPending: alertMutation.isPending,
    watchlistAddPending: watchlistAddMutation.isPending,
    watchlistRemovePending: watchlistRemoveMutation.isPending,
    toggleAlertAcknowledged,
    submitWatchlistItem,
    removeWatchlistItem,
    submitWatchlistAlertRule,
  }
}
