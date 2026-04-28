import type { StrategyActivitySnapshot, StrategyActivitySections, StrategyActivityDecisionContext } from '../types'

export function resolveStrategyActivitySections(activity?: StrategyActivitySnapshot | null) {
  return activity?.activity_sections ?? null
}

export function resolveStrategyActivityDecisionContext(activity?: StrategyActivitySnapshot | null) {
  return activity?.decision_context ?? null
}

export function resolveStrategyActivitySection<K extends keyof StrategyActivitySections>(
  activity?: StrategyActivitySnapshot | null,
  key?: K,
) {
  if (!key) {
    return null
  }
  return activity?.activity_sections?.[key] ?? null
}

export function resolveStrategyActivityDecisionSection<K extends keyof StrategyActivityDecisionContext>(
  activity?: StrategyActivitySnapshot | null,
  key?: K,
) {
  if (!key) {
    return null
  }
  return activity?.decision_context?.[key] ?? null
}
