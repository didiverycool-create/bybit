import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildOverviewWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildOverviewWorkspaceSurfaceArgs({
  source,
}: BuildOverviewWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['overviewWorkspace'] {
  const {
    layoutPreset,
    selectedSymbol,
    selectedStrategy,
    showStrategyWatch,
    overviewWatchlistItems,
    selectedMarketTimeframe,
    marketTimeframePresets,
    marketRenderableDetail,
    marketDiagnostics,
    marketDetailLoading,
    marketDetailErrorMessage,
    marketLiveStatusMessage,
    marketLiveStatusTitle,
    snapshotExecutionHealth,
    marketDiagnosticsTitle,
    marketDiagnosticsSummary,
    scheduler,
    overviewAiEvents,
    overviewQueuedRequests,
  } = source

  return {
    layoutState: {
      layoutPreset,
      selectedSymbol,
      selectedStrategy,
      showStrategyWatch,
      overviewWatchlistItems,
      selectedMarketTimeframe,
      marketTimeframeOptions: marketTimeframePresets,
    },
    marketState: {
      marketRenderableDetail,
      marketDiagnostics,
      marketDetailLoading,
      marketDetailErrorMessage,
      marketLiveStatusMessage,
      marketLiveStatusTitle,
      snapshotExecutionHealth,
      marketDiagnosticsTitle,
      marketDiagnosticsSummary,
    },
    activityState: {
      schedulerJobs: scheduler?.jobs ?? [],
      overviewAiEvents,
      overviewQueuedRequests,
    },
  }
}
