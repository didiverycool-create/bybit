import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import type { SettingsPayload } from '../types'
import type {
  DesktopNotificationDelivery,
  DesktopNotificationPayload,
  SettingsDraft,
} from '../utils/app-helpers'

import { useWorkspaceAlertWatchlistActions } from './useWorkspaceAlertWatchlistActions'
import { useWorkspaceSchedulerRuntimeActions } from './useWorkspaceSchedulerRuntimeActions'
import { useWorkspaceSettingsNotificationActions } from './useWorkspaceSettingsNotificationActions'

type ActionTone = 'success' | 'warning' | 'error'

type SubmitStrategyRequest = (
  type: string,
  summary: string,
  payload: Record<string, unknown>,
  priority?: 'low' | 'normal' | 'high' | 'critical',
) => Promise<void>

export type UseWorkspaceControlActionsArgs = {
  refreshControlData: () => Promise<void>
  queryClient: QueryClient
  settings: SettingsPayload | null | undefined
  settingsDraft: SettingsDraft
  settingsDraftDirty: boolean
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
  lastLoadedSettingsSignatureRef: MutableRefObject<string>
  desktopNotificationsEnabled: boolean
  dispatchDesktopNotification: (
    payload: DesktopNotificationPayload,
    options?: {
      bypassCooldown?: boolean
      dedupeKey?: string | null
    },
  ) => Promise<DesktopNotificationDelivery>
  watchlistDraftSymbol: string
  watchlistDraftMarket: string
  watchlistAlertDrafts: Record<string, string>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setWatchlistDraftSymbol: Dispatch<SetStateAction<string>>
  setWatchlistManagerOpen: Dispatch<SetStateAction<boolean>>
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
  submitStrategyRequest: SubmitStrategyRequest
}

export function useWorkspaceControlActionsModel({
  refreshControlData,
  queryClient,
  settings,
  settingsDraft,
  settingsDraftDirty,
  setSettingsDraft,
  lastLoadedSettingsSignatureRef,
  desktopNotificationsEnabled,
  dispatchDesktopNotification,
  watchlistDraftSymbol,
  watchlistDraftMarket,
  watchlistAlertDrafts,
  setSelectedSymbol,
  setWatchlistDraftSymbol,
  setWatchlistManagerOpen,
  showFeedback,
  submitStrategyRequest,
}: UseWorkspaceControlActionsArgs) {
  const {
    settingsMutationPending,
    toggleSettingsNotificationChannel,
    restoreSettingsDraft,
    saveSettings,
    triggerDesktopNotificationTest,
  } = useWorkspaceSettingsNotificationActions({
    refreshControlData,
    queryClient,
    settings,
    settingsDraft,
    settingsDraftDirty,
    setSettingsDraft,
    lastLoadedSettingsSignatureRef,
    desktopNotificationsEnabled,
    dispatchDesktopNotification,
    showFeedback,
  })

  const {
    schedulerMutationPending,
    restartRuntimeWorkerPending,
    runSchedulerCommand,
    restartStrategyRuntimeWorker,
  } = useWorkspaceSchedulerRuntimeActions({
    refreshControlData,
    showFeedback,
  })

  const {
    alertMutationPending,
    watchlistAddPending,
    watchlistRemovePending,
    toggleAlertAcknowledged,
    submitWatchlistItem,
    removeWatchlistItem,
    submitWatchlistAlertRule,
  } = useWorkspaceAlertWatchlistActions({
    refreshControlData,
    watchlistDraftSymbol,
    watchlistDraftMarket,
    watchlistAlertDrafts,
    setSelectedSymbol,
    setWatchlistDraftSymbol,
    setWatchlistManagerOpen,
    showFeedback,
    submitStrategyRequest,
  })

  return {
    schedulerMutationPending,
    restartRuntimeWorkerPending,
    alertMutationPending,
    watchlistAddPending,
    watchlistRemovePending,
    settingsMutationPending,
    runSchedulerCommand,
    restartStrategyRuntimeWorker,
    toggleSettingsNotificationChannel,
    restoreSettingsDraft,
    saveSettings,
    triggerDesktopNotificationTest,
    toggleAlertAcknowledged,
    submitWatchlistItem,
    removeWatchlistItem,
    submitWatchlistAlertRule,
  }
}
