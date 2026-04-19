import type { QueryClient } from '@tanstack/react-query'

import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useLiveControlStreams } from './useLiveControlStreams'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'

type BuildLiveControlStreamsArgs = Parameters<typeof useLiveControlStreams>[0]
type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>

export type BuildLiveControlStreamsArgsInput =
  AppWorkspaceBootstrapState &
  MarketWorkspaceModel & {
    queryClient: QueryClient
  }

export function buildLiveControlStreamsArgs({
  activeSection,
  liveMarketEnabled,
  selectedSymbol,
  selectedMarketTimeframe,
  queryClient,
  seedMarketLiveCaches,
  onLiveMarketStreamStatusChange,
}: BuildLiveControlStreamsArgsInput): BuildLiveControlStreamsArgs {
  return {
    liveMarketEnabled,
    selectedSymbol,
    selectedMarketTimeframe,
    queryClient,
    seedMarketLiveCaches,
    onLiveMarketStreamStatusChange,
    liveAiStreamEnabled: activeSection === 'scheduler',
    liveOpsStreamEnabled:
      activeSection === 'alerts' || activeSection === 'trades' || activeSection === 'audit',
    liveAccountStreamEnabled: activeSection === 'trades',
    liveStrategyStreamEnabled: activeSection === 'strategy',
  }
}
