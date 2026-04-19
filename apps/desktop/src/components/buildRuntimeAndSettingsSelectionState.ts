import type {
  ExecutionPreview,
  StrategyRuntimeSnapshot,
  WatchlistInstrument,
} from '../types'

export type BuildRuntimeAndSettingsSelectionStateArgs = {
  watchlist: WatchlistInstrument[]
  selectedSymbol: string
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null | undefined
  selectedModeStrategyPreview: ExecutionPreview | null | undefined
}

export function buildRuntimeAndSettingsSelectionState({
  watchlist,
  selectedSymbol,
  selectedStrategyRuntime,
  selectedModeStrategyPreview,
}: BuildRuntimeAndSettingsSelectionStateArgs) {
  const watchlistAlertSignature = watchlist
    .map((item) => `${item.symbol}:${item.alert_enabled ? '1' : '0'}:${item.alert_threshold_pct}`)
    .join('|')
  const selectedWatchItem = watchlist.find((item) => item.symbol === selectedSymbol)
  const selectedStrategyRuntimePreview = selectedStrategyRuntime
    ? selectedModeStrategyPreview ?? {
        action: selectedStrategyRuntime.next_action,
        allowed: false,
        blocked_reason:
          selectedStrategyRuntime.runtime_status === 'paused'
            ? '策略当前处于暂停状态，只有恢复运行后才会继续评估执行。'
            : '当前正在等待该模式下的策略执行预检，请稍后再试。',
        notional: null,
        current_position_side: null,
        current_position_size: null,
        projected_position_side: null,
        projected_position_size: null,
        available_balance_before: null,
        available_balance_after: null,
        estimated_realized_pnl: null,
        warnings: selectedStrategyRuntime.note ? [selectedStrategyRuntime.note] : [],
      }
    : null

  return {
    watchlistAlertSignature,
    selectedWatchItem,
    selectedStrategyRuntimePreview,
  }
}
