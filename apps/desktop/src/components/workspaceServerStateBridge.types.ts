import type { Dispatch, SetStateAction } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import type { WorkspacePreferences } from '../types'
import type { WorkspaceBootstrap } from '../utils/workspace-helpers'
import type {
  WorkspaceServerSyncSetters,
  WorkspaceServerSyncWorkspace,
} from './workspaceServerSyncTypes'

export type UseWorkspaceServerStateBridgeArgs = {
  queryClient: QueryClient
  currentWorkspaceDraft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>
  workspaceQueryData: WorkspaceBootstrap | WorkspacePreferences | null | undefined
  lastSyncedWorkspaceSignature: string
  setWorkspaceConflict: Dispatch<SetStateAction<boolean>>
} & WorkspaceServerSyncSetters

export type UseWorkspaceServerStateBridgeResult = {
  applyWorkspaceStateWithMarketPrefetch: (
    nextWorkspace: WorkspaceServerSyncWorkspace,
  ) => Promise<void>
}
