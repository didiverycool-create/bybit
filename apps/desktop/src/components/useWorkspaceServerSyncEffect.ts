import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { WorkspacePreferences } from '../types'
import type { WorkspaceBootstrap } from '../utils/workspace-helpers'
import { resolveWorkspaceServerSyncEffectState } from './workspaceServerSyncHelpers'

type UseWorkspaceServerSyncEffectArgs = {
  currentWorkspaceDraft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>
  workspaceQueryData: WorkspaceBootstrap | WorkspacePreferences | null | undefined
  lastSyncedWorkspaceSignature: string
  setWorkspaceConflict: Dispatch<SetStateAction<boolean>>
  applyWorkspaceStateWithMarketPrefetch: (
    nextWorkspace: WorkspaceBootstrap | WorkspacePreferences,
  ) => Promise<void>
}

export function useWorkspaceServerSyncEffect({
  currentWorkspaceDraft,
  workspaceQueryData,
  lastSyncedWorkspaceSignature,
  setWorkspaceConflict,
  applyWorkspaceStateWithMarketPrefetch,
}: UseWorkspaceServerSyncEffectArgs) {
  useEffect(() => {
    const effectState = resolveWorkspaceServerSyncEffectState({
      workspaceQueryData,
      currentWorkspaceDraft,
      lastSyncedWorkspaceSignature,
    })

    if (effectState.mode === 'skip') {
      return
    }
    if (effectState.mode === 'synced') {
      setWorkspaceConflict(false)
      return
    }
    if (effectState.mode === 'conflict') {
      setWorkspaceConflict(true)
      return
    }

    let cancelled = false
    void (async () => {
      await applyWorkspaceStateWithMarketPrefetch(effectState.workspace)
      if (!cancelled) {
        setWorkspaceConflict(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    applyWorkspaceStateWithMarketPrefetch,
    currentWorkspaceDraft,
    lastSyncedWorkspaceSignature,
    setWorkspaceConflict,
    workspaceQueryData,
  ])
}
