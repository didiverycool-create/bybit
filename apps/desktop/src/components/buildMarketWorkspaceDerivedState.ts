import type { LiveControlStreamStatus } from './useLiveControlStreamsShared'
import type {
  MarketDetail,
  MarketLiveDiagnostics,
  MarketLiveSnapshot,
} from '../types'
import {
  formatDateTime,
  marketDiagnosticsSummaryLong,
  marketDiagnosticsSummaryShort,
  resolveErrorMessage,
} from '../utils/app-helpers'

type BuildMarketWorkspaceDerivedStateArgs = {
  liveMarketEnabled: boolean
  marketDetailQueryData: MarketDetail | undefined
  marketLiveSnapshot: MarketLiveSnapshot | undefined
  matchedMarketDetail: MarketDetail | null
  stableMarketDetails: Record<string, MarketDetail>
  stableMarketDiagnostics: Record<string, MarketLiveDiagnostics>
  marketSelectionKey: string
  marketLiveQueryIsLoading: boolean
  marketLiveQueryIsFetching: boolean
  marketLiveQueryError: unknown
  marketDetailQueryIsLoading: boolean
  marketDetailQueryIsFetching: boolean
  marketDetailQueryError: unknown
  marketLiveStreamStatus: LiveControlStreamStatus
}

export type BuildMarketWorkspaceDerivedStateResult = {
  resolvedMarketDetail: MarketDetail | null
  marketDetail: MarketDetail | null
  marketRenderableDetail: MarketDetail | null
  marketDiagnostics: MarketLiveDiagnostics | null
  marketDiagnosticsSummary: string
  marketDiagnosticsTitle: string
  marketDetailLoading: boolean
  marketDetailErrorMessage: string | null
  marketLiveStatusMessage: string | null
  marketLiveStatusTitle: string
}

export function buildMarketWorkspaceDerivedState({
  liveMarketEnabled,
  marketDetailQueryData,
  marketLiveSnapshot,
  matchedMarketDetail,
  stableMarketDetails,
  stableMarketDiagnostics,
  marketSelectionKey,
  marketLiveQueryIsLoading,
  marketLiveQueryIsFetching,
  marketLiveQueryError,
  marketDetailQueryIsLoading,
  marketDetailQueryIsFetching,
  marketDetailQueryError,
  marketLiveStreamStatus,
}: BuildMarketWorkspaceDerivedStateArgs): BuildMarketWorkspaceDerivedStateResult {
  const resolvedMarketDetail = liveMarketEnabled
    ? marketLiveSnapshot?.detail ?? null
    : marketDetailQueryData ?? null
  const marketDetail =
    (matchedMarketDetail && matchedMarketDetail.candles.length > 0 ? matchedMarketDetail : null) ??
    stableMarketDetails[marketSelectionKey] ??
    null
  const marketRenderableDetail = marketDetail && marketDetail.candles.length > 0 ? marketDetail : null
  const marketDiagnostics = liveMarketEnabled
    ? marketLiveSnapshot?.diagnostics ?? stableMarketDiagnostics[marketSelectionKey] ?? null
    : null
  const marketDiagnosticsSummary = marketDiagnosticsSummaryShort(marketDiagnostics)
  const marketDiagnosticsTitle = marketDiagnosticsSummaryLong(marketDiagnostics)
  const marketLiveStreamErrored = liveMarketEnabled && marketLiveStreamStatus.phase === 'error'
  const marketLiveStatusMessage = marketLiveStreamErrored
    ? marketRenderableDetail
      ? '实时流异常，正在重连；当前展示最近一次快照或轮询数据。'
      : marketLiveQueryError
        ? '实时流异常，轮询补偿也失败，请稍后重试。'
        : '实时流异常，正在重连；当前等待轮询补偿返回。'
    : null
  const marketLiveStatusTitle = !marketLiveStatusMessage
    ? ''
    : marketLiveStreamStatus.lastEventAt
      ? `最近一次实时更新：${formatDateTime(marketLiveStreamStatus.lastEventAt)}`
      : marketLiveStreamStatus.lastErrorAt
        ? `最近一次连接异常：${formatDateTime(marketLiveStreamStatus.lastErrorAt)}`
        : '浏览器正在自动重连实时流'
  const marketDetailLoading =
    !marketRenderableDetail &&
    (liveMarketEnabled ? marketLiveQueryIsLoading || marketLiveQueryIsFetching : marketDetailQueryIsLoading || marketDetailQueryIsFetching)
  const baseMarketDetailError = (liveMarketEnabled ? marketLiveQueryError : marketDetailQueryError)
    ? resolveErrorMessage(liveMarketEnabled ? marketLiveQueryError : marketDetailQueryError)
    : null
  const marketDetailErrorMessage =
    !marketRenderableDetail && baseMarketDetailError
      ? marketLiveStreamErrored && liveMarketEnabled
        ? `实时流异常，轮询补偿也失败：${baseMarketDetailError}`
        : baseMarketDetailError
      : null

  return {
    resolvedMarketDetail,
    marketDetail,
    marketRenderableDetail,
    marketDiagnostics,
    marketDiagnosticsSummary,
    marketDiagnosticsTitle,
    marketDetailLoading,
    marketDetailErrorMessage,
    marketLiveStatusMessage,
    marketLiveStatusTitle,
  }
}
