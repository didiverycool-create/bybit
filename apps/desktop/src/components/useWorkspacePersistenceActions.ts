import { useCallback } from 'react'

import type { UseWorkspacePersistenceActionsOptions } from './useWorkspacePersistenceActions.types'
import { buildApplyServerWorkspaceAction } from './useWorkspacePersistenceActionsServer'
import { buildRestoreDefaultWorkspaceAction } from './useWorkspacePersistenceActionsRestore'
import { buildSyncWorkspacePreferencesAction } from './useWorkspacePersistenceActionsSync'

export function useWorkspacePersistenceActions({
  currentWorkspaceDraft,
  serviceAvailable,
  saveWorkspacePreferences,
  setLastSyncedWorkspaceSignature,
  applyWorkspaceStateWithMarketPrefetch,
  setWorkspaceSavedAt,
  setWorkspaceConflict,
  showFeedback,
  watchlistFirstSymbol,
  strategiesFirstId,
  workspaceQueryData,
}: UseWorkspacePersistenceActionsOptions) {
  const syncWorkspacePreferences = useCallback(
    async (draft: typeof currentWorkspaceDraft = currentWorkspaceDraft) =>
      buildSyncWorkspacePreferencesAction({
        currentWorkspaceDraft,
        serviceAvailable,
        saveWorkspacePreferences,
        setLastSyncedWorkspaceSignature,
        applyWorkspaceStateWithMarketPrefetch,
        setWorkspaceSavedAt,
        setWorkspaceConflict,
        showFeedback,
        watchlistFirstSymbol,
        strategiesFirstId,
        workspaceQueryData,
      })(draft),
    [
      currentWorkspaceDraft,
      serviceAvailable,
      saveWorkspacePreferences,
      setLastSyncedWorkspaceSignature,
      applyWorkspaceStateWithMarketPrefetch,
      setWorkspaceSavedAt,
      setWorkspaceConflict,
      showFeedback,
      watchlistFirstSymbol,
      strategiesFirstId,
      workspaceQueryData,
    ],
  )

  const restoreDefaultWorkspace = useCallback(
    async () =>
      buildRestoreDefaultWorkspaceAction({
        currentWorkspaceDraft,
        serviceAvailable,
        saveWorkspacePreferences,
        setLastSyncedWorkspaceSignature,
        applyWorkspaceStateWithMarketPrefetch,
        setWorkspaceSavedAt,
        setWorkspaceConflict,
        showFeedback,
        watchlistFirstSymbol,
        strategiesFirstId,
        workspaceQueryData,
        syncWorkspacePreferences,
      })(),
    [
      currentWorkspaceDraft,
      serviceAvailable,
      saveWorkspacePreferences,
      setLastSyncedWorkspaceSignature,
      applyWorkspaceStateWithMarketPrefetch,
      setWorkspaceSavedAt,
      setWorkspaceConflict,
      showFeedback,
      watchlistFirstSymbol,
      strategiesFirstId,
      workspaceQueryData,
      syncWorkspacePreferences,
    ],
  )

  const applyServerWorkspace = useCallback(
    async () =>
      buildApplyServerWorkspaceAction({
        currentWorkspaceDraft,
        serviceAvailable,
        saveWorkspacePreferences,
        setLastSyncedWorkspaceSignature,
        applyWorkspaceStateWithMarketPrefetch,
        setWorkspaceSavedAt,
        setWorkspaceConflict,
        showFeedback,
        watchlistFirstSymbol,
        strategiesFirstId,
        workspaceQueryData,
      })(),
    [
      currentWorkspaceDraft,
      serviceAvailable,
      saveWorkspacePreferences,
      setLastSyncedWorkspaceSignature,
      applyWorkspaceStateWithMarketPrefetch,
      setWorkspaceSavedAt,
      setWorkspaceConflict,
      showFeedback,
      watchlistFirstSymbol,
      strategiesFirstId,
      workspaceQueryData,
    ],
  )

  return {
    syncWorkspacePreferences,
    restoreDefaultWorkspace,
    applyServerWorkspace,
  }
}
