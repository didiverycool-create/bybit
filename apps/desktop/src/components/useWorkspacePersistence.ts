import { buildWorkspaceSignature } from '../utils/workspace-helpers'
import type { UseWorkspacePersistenceOptions } from './workspacePersistenceTypes'
import { useWorkspacePersistenceActions } from './useWorkspacePersistenceActions'
import { useWorkspacePersistenceLocalEffect } from './useWorkspacePersistenceLocalEffect'

export function useWorkspacePersistence(options: UseWorkspacePersistenceOptions) {
  const {
    currentWorkspaceDraft,
    workspaceSavedAt,
    lastSyncedWorkspaceSignature,
    workspaceQueryData,
    serviceAvailable,
    saveWorkspacePreferences,
    setLastSyncedWorkspaceSignature,
    applyWorkspaceStateWithMarketPrefetch,
    setWorkspaceSavedAt,
    setWorkspaceConflict,
    showFeedback,
    watchlistFirstSymbol,
    strategiesFirstId,
  } = options

  useWorkspacePersistenceLocalEffect({
    currentWorkspaceDraft,
    workspaceSavedAt,
  })
  const {
    syncWorkspacePreferences,
    restoreDefaultWorkspace,
    applyServerWorkspace,
  } = useWorkspacePersistenceActions({
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
  })

  const workspaceDirty =
    buildWorkspaceSignature(currentWorkspaceDraft) !== lastSyncedWorkspaceSignature

  return {
    currentWorkspaceDraft,
    workspaceDirty,
    syncWorkspacePreferences,
    restoreDefaultWorkspace,
    applyServerWorkspace,
  }
}
