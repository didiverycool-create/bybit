import type { StrategyActivitySnapshot } from './types'
import { normalizeStrategyActivityRecentCollections } from './strategyActivitySnapshotNormalizationCollections'
import {
  normalizeReviewDocument,
  normalizeStrategyActivityDecisionContext,
  normalizeStrategyActivitySections,
} from './strategyActivitySnapshotNormalizationDecision'
import { deriveStrategyActivityState } from './strategyActivitySnapshotNormalizationDerivedState'

export function normalizeStrategyActivitySnapshot(
  activity: StrategyActivitySnapshot,
): StrategyActivitySnapshot {
  const decisionContext = normalizeStrategyActivityDecisionContext(activity.decision_context)
  const activitySections = normalizeStrategyActivitySections(activity.activity_sections)
  const derivedState = deriveStrategyActivityState(activity, decisionContext, activitySections)
  const recentCollections = normalizeStrategyActivityRecentCollections(activity)

  return {
    ...activity,
    ...derivedState,
    ...recentCollections,
    decision_context: decisionContext,
    activity_sections: activitySections,
  }
}

export { normalizeReviewDocument }
