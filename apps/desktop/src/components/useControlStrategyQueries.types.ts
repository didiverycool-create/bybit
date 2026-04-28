import type { Mode, SectionKey } from '../types'

export type UseControlStrategyQueriesArgs = {
  activeSection: SectionKey
  selectedMode: Mode
  selectedStrategyId: string | null
  selectedBacktestId: string | null
  backtestFilter: 'selected' | 'all'
  replayTrackingScope: 'all' | 'selected'
  strategyActivityPanelOpen: boolean
}
