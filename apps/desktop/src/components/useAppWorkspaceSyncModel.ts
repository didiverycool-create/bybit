import type { QueryClient } from '@tanstack/react-query'

import { buildWorkspaceDraftModelArgs } from './buildWorkspaceDraftModelArgs'
import { buildWorkspaceDraftSyncArgs } from './buildWorkspaceDraftSyncArgs'
import { buildWorkspaceFocusSyncArgs } from './buildWorkspaceFocusSyncArgs'
import { buildWorkspaceServerSyncArgs } from './buildWorkspaceServerSyncArgs'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'
import { useWorkspaceDraftModel } from './useWorkspaceDraftModel'
import { useWorkspaceDraftSync } from './useWorkspaceDraftSync'
import { useWorkspaceFocusSync } from './useWorkspaceFocusSync'
import { useWorkspaceServerSync } from './useWorkspaceServerSync'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>

export type UseAppWorkspaceSyncModelArgs =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  MarketWorkspaceModel &
  RuntimeAndSettingsModel &
  StrategyWorkspaceCompositeModel & {
    queryClient: QueryClient
  }

export function useAppWorkspaceSyncModel({
  queryClient,
  ...input
}: UseAppWorkspaceSyncModelArgs) {
  const workspaceDraftSource = buildWorkspaceDraftModelArgs(input)
  const workspaceDraftModel = useWorkspaceDraftModel(
    workspaceDraftSource,
  )

  const workspaceDraftSyncSource = buildWorkspaceDraftSyncArgs(input)
  useWorkspaceDraftSync(
    workspaceDraftSyncSource,
  )

  const workspaceFocusSyncSource = buildWorkspaceFocusSyncArgs(input)
  useWorkspaceFocusSync(
    workspaceFocusSyncSource,
  )

  const workspaceServerSyncSource = {
    ...input,
    ...workspaceDraftModel,
    queryClient,
  }
  const workspaceServerSyncModel = useWorkspaceServerSync(
    buildWorkspaceServerSyncArgs(workspaceServerSyncSource),
  )

  return {
    ...workspaceDraftModel,
    ...workspaceServerSyncModel,
  }
}
