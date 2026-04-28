import { buildOverviewWorkspaceDerivedState } from './buildOverviewWorkspaceDerivedState'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>

export type UseAppShellOverviewDerivedStateArgs = {
  layoutPreset: AppWorkspaceBootstrapState['layoutPreset']
  watchlist: MarketWorkspaceModel['watchlist']
  aiActivityFeed: RuntimeAndSettingsModel['aiActivityFeed']
}

export function useAppShellOverviewDerivedState({
  layoutPreset,
  watchlist,
  aiActivityFeed,
}: UseAppShellOverviewDerivedStateArgs) {
  return buildOverviewWorkspaceDerivedState({
    layoutPreset,
    watchlist,
    aiActivityFeed,
  })
}
