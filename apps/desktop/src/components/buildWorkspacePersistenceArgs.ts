import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useControlRefreshActions } from './useControlRefreshActions'
import type { useDesktopUiActions } from './useDesktopUiActions'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useWorkspaceDraftModel } from './useWorkspaceDraftModel'
import type { UseWorkspacePersistenceOptions } from './workspacePersistenceTypes'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type ControlRefreshActions = ReturnType<typeof useControlRefreshActions>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>
type WorkspaceDraftModel = ReturnType<typeof useWorkspaceDraftModel>

export type BuildWorkspacePersistenceArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  ControlRefreshActions &
  DesktopUiActions &
  MarketWorkspaceModel &
  WorkspaceDraftModel & {
    applyWorkspaceStateWithMarketPrefetch:
      UseWorkspacePersistenceOptions['applyWorkspaceStateWithMarketPrefetch']
  }

export function buildWorkspacePersistenceArgs({
  currentWorkspaceDraft,
  workspaceSavedAt,
  lastSyncedWorkspaceSignature,
  workspaceQuery,
  serviceAvailable,
  saveWorkspacePreferences,
  setLastSyncedWorkspaceSignature,
  applyWorkspaceStateWithMarketPrefetch,
  setWorkspaceSavedAt,
  setWorkspaceConflict,
  showFeedback,
  watchlist,
  strategies,
}: BuildWorkspacePersistenceArgsInput): UseWorkspacePersistenceOptions {
  return {
    currentWorkspaceDraft,
    workspaceSavedAt,
    lastSyncedWorkspaceSignature,
    workspaceQueryData: workspaceQuery.data,
    serviceAvailable,
    saveWorkspacePreferences,
    setLastSyncedWorkspaceSignature,
    applyWorkspaceStateWithMarketPrefetch,
    setWorkspaceSavedAt,
    setWorkspaceConflict,
    showFeedback,
    watchlistFirstSymbol: watchlist[0]?.symbol,
    strategiesFirstId: strategies[0]?.id,
  }
}
