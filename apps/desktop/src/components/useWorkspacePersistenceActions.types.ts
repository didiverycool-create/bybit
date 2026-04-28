import type { UseWorkspacePersistenceOptions } from './workspacePersistenceTypes'

export type UseWorkspacePersistenceActionsOptions = Pick<
  UseWorkspacePersistenceOptions,
  | 'currentWorkspaceDraft'
  | 'serviceAvailable'
  | 'saveWorkspacePreferences'
  | 'setLastSyncedWorkspaceSignature'
  | 'applyWorkspaceStateWithMarketPrefetch'
  | 'setWorkspaceSavedAt'
  | 'setWorkspaceConflict'
  | 'showFeedback'
  | 'watchlistFirstSymbol'
  | 'strategiesFirstId'
  | 'workspaceQueryData'
>
