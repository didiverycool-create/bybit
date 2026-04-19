import type { StrategySummary } from '../types'

export type ResolveWorkspaceFocusSelectionArgs = {
  strategyId: string | null | undefined
  strategies: StrategySummary[]
  selectedStrategyCurrentId: string | null
  selectedStrategyId: string | null
  selectedSymbol?: string
  currentReviewInspectorStrategyId?: string | null
  syncSymbol?: boolean
  syncReviewInspectorStrategyId?: boolean
}

export type ResolveWorkspaceFocusSelectionResult = {
  strategy: StrategySummary | null
  nextSelectedStrategyId: string | null
  nextSelectedSymbol: string | null
  nextReviewInspectorStrategyId: string | null
}

export function resolveWorkspaceFocusSelection({
  strategyId,
  strategies,
  selectedStrategyCurrentId,
  selectedStrategyId,
  selectedSymbol,
  currentReviewInspectorStrategyId,
  syncSymbol = true,
  syncReviewInspectorStrategyId = false,
}: ResolveWorkspaceFocusSelectionArgs): ResolveWorkspaceFocusSelectionResult {
  if (!strategyId) {
    return {
      strategy: null,
      nextSelectedStrategyId: null,
      nextSelectedSymbol: null,
      nextReviewInspectorStrategyId: null,
    }
  }

  const strategy = strategies.find((item) => item.id === strategyId) ?? null
  if (!strategy) {
    return {
      strategy: null,
      nextSelectedStrategyId: null,
      nextSelectedSymbol: null,
      nextReviewInspectorStrategyId: null,
    }
  }

  return {
    strategy,
    nextSelectedStrategyId:
      strategy.id !== selectedStrategyCurrentId && strategy.id !== selectedStrategyId
        ? strategy.id
        : null,
    nextSelectedSymbol:
      syncSymbol && strategy.symbols[0] && strategy.symbols[0] !== selectedSymbol
        ? strategy.symbols[0]
        : null,
    nextReviewInspectorStrategyId:
      syncReviewInspectorStrategyId && currentReviewInspectorStrategyId !== strategy.id
        ? strategy.id
        : null,
  }
}
