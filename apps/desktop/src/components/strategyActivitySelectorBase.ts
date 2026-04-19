import type { StrategyActivitySnapshot } from '../types'
import { resolveStrategyActivityLatestOpsSnapshot } from '../strategyActivityLatestOpsSnapshot'
export { resolveStrategyActivityDecisionContext } from './strategyActivitySelectorStructure'
export { resolveStrategyActivitySections } from './strategyActivitySelectorStructure'

export function resolveStrategyActivityLatestOps(activity?: StrategyActivitySnapshot | null) {
  return resolveStrategyActivityLatestOpsSnapshot(activity)
}

export function resolveStrategyActivityRuntime(activity?: StrategyActivitySnapshot | null) {
  return activity?.latest_runtime?.runtime ?? activity?.runtime ?? null
}
