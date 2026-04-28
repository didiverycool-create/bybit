import type { WorkspacePreferences } from '../types'
import type { WorkspaceBootstrap } from '../utils/workspace-helpers'

export type WorkspaceFeedbackTone = 'success' | 'warning' | 'error'

export type UseWorkspacePersistenceOptions = {
  currentWorkspaceDraft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>
  workspaceSavedAt: string | null
  lastSyncedWorkspaceSignature: string
  workspaceQueryData: WorkspaceBootstrap | WorkspacePreferences | null | undefined
  serviceAvailable: boolean
  saveWorkspacePreferences: (
    draft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>,
  ) => Promise<Pick<WorkspaceBootstrap, 'updated_at'>>
  setLastSyncedWorkspaceSignature: (signature: string) => void
  applyWorkspaceStateWithMarketPrefetch: (
    next: WorkspaceBootstrap | WorkspacePreferences,
  ) => Promise<void>
  setWorkspaceSavedAt: (value: string | null) => void
  setWorkspaceConflict: (value: boolean) => void
  showFeedback: (
    tone: WorkspaceFeedbackTone,
    title: string,
    detail: string,
  ) => void
  watchlistFirstSymbol: string | null | undefined
  strategiesFirstId: string | null | undefined
}
