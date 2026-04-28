import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildMarketWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildMarketWorkspaceSurfaceArgs({
  source,
}: BuildMarketWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['marketWorkspace'] {
  const {
    watchlistErrorMessage,
    watchlist,
    selectedSymbol,
    selectedWatchItem,
    marketDetail,
    marketRenderableDetail,
    marketDiagnostics,
    marketDiagnosticsSummary,
    marketDiagnosticsTitle,
    selectedMarketTimeframe,
    marketTimeframePresets,
    manualTradingBlockedReason,
    marketLiveStatusMessage,
    marketLiveStatusTitle,
  } = source

  const selectedWatchAlertLabel = selectedWatchItem
    ? selectedWatchItem.alert_enabled
      ? `提醒 ${selectedWatchItem.alert_threshold_pct.toFixed(1)}%`
      : '提醒已关闭'
    : '提醒未配置'
  const marketHeader = marketDetail?.headline ?? '等待本地量化服务返回当前品种的跟踪摘要'

  return {
    watchlistState: {
      watchlistErrorMessage,
      watchlist,
      selectedSymbol,
      selectedWatchAlertLabel,
    },
    marketState: {
      marketDetail,
      marketRenderableDetail,
      marketDiagnostics,
      marketDiagnosticsSummary,
      marketDiagnosticsTitle,
      marketHeader,
      marketDetailLoading: source.marketDetailLoading,
      marketDetailErrorMessage: source.marketDetailErrorMessage,
      marketLiveStatusMessage,
      marketLiveStatusTitle,
      selectedMarketTimeframe,
      marketTimeframeOptions: marketTimeframePresets,
      manualTradingBlockedReason,
    },
  }
}
