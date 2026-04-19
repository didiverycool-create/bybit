import { preferStrategyActivityValue } from './strategyActivitySelectorValue'

export function preferStrategyActivitySectionPriority<T>(
  sectionValue: T | null | undefined,
  decisionContextValue: T | null | undefined,
) {
  return preferStrategyActivityValue(sectionValue, decisionContextValue)
}

export function preferStrategyActivityLatestPriority<T>(
  latestValue: T | null | undefined,
  flatValue: T | null | undefined,
  recentValue?: T | null | undefined,
) {
  return preferStrategyActivityValue(latestValue, flatValue, recentValue)
}
