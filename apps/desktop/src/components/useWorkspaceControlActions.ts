import {
  type UseWorkspaceControlActionsArgs,
  useWorkspaceControlActionsModel,
} from './useWorkspaceControlActionsModel'

export function useWorkspaceControlActions({
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
  return useWorkspaceControlActionsModel({
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
  })
}
