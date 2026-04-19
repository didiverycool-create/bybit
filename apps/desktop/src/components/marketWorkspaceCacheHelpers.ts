import type {
  MarketDetail,
  MarketLiveDiagnostics,
  MarketLiveSnapshot,
} from '../types'
import {
  deriveMarketLiveDiagnostics,
} from '../utils/app-helpers'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import { normalizeWorkspaceMarketTimeframe } from '../utils/workspace-helpers'

export type StableMarketDetails = Record<string, MarketDetail>
export type StableMarketDiagnostics = Record<string, MarketLiveDiagnostics>

export type SeededMarketLiveDetail = {
  detail: MarketDetail
  detailKey: string
  diagnostics: MarketLiveDiagnostics
  normalizedSymbol: string
  normalizedTimeframe: MarketTimeframe
}

export function resolveMarketSelectionKey(
  symbol: string,
  timeframe: MarketTimeframe,
): string {
  return `${symbol}:${timeframe}`
}

export function buildMarketLiveCacheSeedState(
  payload: MarketLiveSnapshot,
): {
  nextStableDetails: StableMarketDetails
  nextStableDiagnostics: StableMarketDiagnostics
  seededDetails: SeededMarketLiveDetail[]
} {
  const seen = new Set<string>()
  const details = [...(payload.watchlist_details ?? []), payload.detail].filter(Boolean)
  const nextStableDetails: StableMarketDetails = {}
  const nextStableDiagnostics: StableMarketDiagnostics = {}
  const seededDetails: SeededMarketLiveDetail[] = []

  for (const detail of details) {
    const normalizedSymbol = String(detail.symbol || '').trim().toUpperCase()
    if (!normalizedSymbol) {
      continue
    }
    const normalizedTimeframe = normalizeWorkspaceMarketTimeframe(detail.timeframe)
    const detailKey = resolveMarketSelectionKey(normalizedSymbol, normalizedTimeframe)
    if (seen.has(detailKey) || detail.candles.length === 0) {
      continue
    }
    seen.add(detailKey)
    const diagnostics = deriveMarketLiveDiagnostics(
      payload,
      detail,
      normalizedSymbol,
      normalizedTimeframe,
    )
    nextStableDetails[detailKey] = detail
    nextStableDiagnostics[detailKey] = diagnostics
    seededDetails.push({
      detail,
      detailKey,
      diagnostics,
      normalizedSymbol,
      normalizedTimeframe,
    })
  }

  return {
    nextStableDetails,
    nextStableDiagnostics,
    seededDetails,
  }
}

export function mergeStableMarketDetails(
  current: StableMarketDetails,
  nextStableDetails: StableMarketDetails,
): StableMarketDetails {
  let changed = false
  const next = { ...current }
  Object.entries(nextStableDetails).forEach(([detailKey, detail]) => {
    const existing = current[detailKey]
    const existingLastTime = existing?.candles.at(-1)?.time ?? null
    const nextLastTime = detail.candles.at(-1)?.time ?? null
    if (
      existing &&
      existing.updated_at === detail.updated_at &&
      existing.candles.length === detail.candles.length &&
      existingLastTime === nextLastTime
    ) {
      return
    }
    next[detailKey] = detail
    changed = true
  })
  return changed ? next : current
}

export function mergeStableMarketDiagnostics(
  current: StableMarketDiagnostics,
  nextStableDiagnostics: StableMarketDiagnostics,
): StableMarketDiagnostics {
  let changed = false
  const next = { ...current }
  Object.entries(nextStableDiagnostics).forEach(([detailKey, diagnostics]) => {
    const existing = current[detailKey]
    if (
      existing &&
      existing.effective_symbol === diagnostics.effective_symbol &&
      existing.timeframe === diagnostics.timeframe &&
      existing.detail_source === diagnostics.detail_source &&
      existing.detail_candle_count === diagnostics.detail_candle_count &&
      existing.watchlist_real_detail_count === diagnostics.watchlist_real_detail_count &&
      existing.watchlist_fallback_detail_count === diagnostics.watchlist_fallback_detail_count &&
      existing.generated_in_ms === diagnostics.generated_in_ms &&
      existing.selection_corrected === diagnostics.selection_corrected
    ) {
      return
    }
    next[detailKey] = diagnostics
    changed = true
  })
  return changed ? next : current
}

export function resolveMatchedMarketDetail(
  marketDetail: MarketDetail | null,
  selectedSymbol: string,
  selectedMarketTimeframe: MarketTimeframe,
): MarketDetail | null {
  if (!marketDetail) {
    return null
  }
  return marketDetail.symbol.toUpperCase() === selectedSymbol.toUpperCase() &&
    normalizeWorkspaceMarketTimeframe(marketDetail.timeframe) === selectedMarketTimeframe
    ? marketDetail
    : null
}
