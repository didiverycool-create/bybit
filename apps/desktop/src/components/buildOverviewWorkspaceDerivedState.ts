import type { ComponentProps } from 'react'

import type OverviewWorkspaceContainer from './OverviewWorkspaceContainer'

type OverviewWorkspaceContainerProps = ComponentProps<typeof OverviewWorkspaceContainer>

export type BuildOverviewWorkspaceDerivedStateArgs = {
  layoutPreset: OverviewWorkspaceContainerProps['layoutState']['layoutPreset']
  watchlist: OverviewWorkspaceContainerProps['layoutState']['overviewWatchlistItems']
  aiActivityFeed: OverviewWorkspaceContainerProps['activityState']['overviewAiEvents']
}

export type BuildOverviewWorkspaceDerivedStateResult = {
  showStrategyWatch: OverviewWorkspaceContainerProps['layoutState']['showStrategyWatch']
  overviewWatchlistItems: OverviewWorkspaceContainerProps['layoutState']['overviewWatchlistItems']
  overviewAiEvents: OverviewWorkspaceContainerProps['activityState']['overviewAiEvents']
}

export function buildOverviewWorkspaceDerivedState({
  layoutPreset,
  watchlist,
  aiActivityFeed,
}: BuildOverviewWorkspaceDerivedStateArgs): BuildOverviewWorkspaceDerivedStateResult {
  const showStrategyWatch = true
  const compactStrategyWatch = layoutPreset !== 'balanced'

  return {
    showStrategyWatch,
    overviewWatchlistItems: showStrategyWatch ? watchlist.slice(0, compactStrategyWatch ? 6 : 10) : [],
    overviewAiEvents: aiActivityFeed.slice(0, 6),
  }
}
