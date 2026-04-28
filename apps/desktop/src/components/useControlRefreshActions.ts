import { useCallback } from 'react'
import { useMutation, type QueryClient } from '@tanstack/react-query'

import { systemIntegrationApi } from '../apiSystemIntegration'
import { buildWorkspaceSignature } from '../utils/workspace-helpers'

type UseControlRefreshActionsArgs = {
  queryClient: QueryClient
  setWorkspaceSavedAt: (value: string | null) => void
  setLastSyncedWorkspaceSignature: (signature: string) => void
}

export function useControlRefreshActions({
  queryClient,
  setWorkspaceSavedAt,
  setLastSyncedWorkspaceSignature,
}: UseControlRefreshActionsArgs) {
  const refreshControlData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['snapshot'] }),
      queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
      queryClient.invalidateQueries({ queryKey: ['market'] }),
      queryClient.invalidateQueries({ queryKey: ['account-live'] }),
      queryClient.invalidateQueries({ queryKey: ['account-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['account-positions'] }),
      queryClient.invalidateQueries({ queryKey: ['account-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['account-order-history'] }),
      queryClient.invalidateQueries({ queryKey: ['bybit-private'] }),
      queryClient.invalidateQueries({ queryKey: ['bybit-public'] }),
      queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
      queryClient.invalidateQueries({ queryKey: ['ops-live'] }),
      queryClient.invalidateQueries({ queryKey: ['change-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['backtests'] }),
      queryClient.invalidateQueries({ queryKey: ['strategies'] }),
      queryClient.invalidateQueries({ queryKey: ['strategy-activity'] }),
      queryClient.invalidateQueries({ queryKey: ['runtime-worker-status'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews'] }),
      queryClient.invalidateQueries({ queryKey: ['trades'] }),
      queryClient.invalidateQueries({ queryKey: ['audit'] }),
      queryClient.invalidateQueries({ queryKey: ['workspace'] }),
    ])
  }, [queryClient])

  const workspaceMutation = useMutation({
    mutationFn: systemIntegrationApi.updateWorkspacePreferences,
    onSuccess: async (workspace) => {
      setWorkspaceSavedAt(workspace.updated_at)
      setLastSyncedWorkspaceSignature(buildWorkspaceSignature(workspace))
      queryClient.setQueryData(['workspace'], workspace)
      await queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  return {
    refreshControlData,
    saveWorkspacePreferences: workspaceMutation.mutateAsync,
    workspaceMutationPending: workspaceMutation.isPending,
  }
}
