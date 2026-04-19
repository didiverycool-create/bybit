import { useCallback, useRef } from 'react'

import {
  applyWorkspaceServerState,
  applyWorkspaceServerStateWithMarketPrefetch,
} from './workspaceServerSyncHelpers'
import { useWorkspaceServerSyncEffect } from './useWorkspaceServerSyncEffect'
import type {
  UseWorkspaceServerStateBridgeArgs,
  UseWorkspaceServerStateBridgeResult,
} from './workspaceServerStateBridge.types'

export function useWorkspaceServerStateBridge({
  queryClient,
  currentWorkspaceDraft,
  workspaceQueryData,
  lastSyncedWorkspaceSignature,
  setWorkspaceConflict,
  ...workspaceServerSyncSetters
}: UseWorkspaceServerStateBridgeArgs): UseWorkspaceServerStateBridgeResult {
  const workspaceServerSyncSettersRef = useRef(workspaceServerSyncSetters)
  workspaceServerSyncSettersRef.current = workspaceServerSyncSetters

  const applyWorkspaceState = useCallback((nextWorkspace: typeof workspaceQueryData) => {
    if (!nextWorkspace) {
      return
    }
    applyWorkspaceServerState(nextWorkspace, workspaceServerSyncSettersRef.current)
  }, [])

  const applyWorkspaceStateWithMarketPrefetch = useCallback(
    async (nextWorkspace: NonNullable<typeof workspaceQueryData>) => {
      await applyWorkspaceServerStateWithMarketPrefetch(nextWorkspace, {
        queryClient,
        applyWorkspaceState,
      })
    },
    [applyWorkspaceState, queryClient],
  )

  useWorkspaceServerSyncEffect({
    currentWorkspaceDraft,
    workspaceQueryData,
    lastSyncedWorkspaceSignature,
    setWorkspaceConflict,
    applyWorkspaceStateWithMarketPrefetch,
  })

  return {
    applyWorkspaceStateWithMarketPrefetch,
  }
}
