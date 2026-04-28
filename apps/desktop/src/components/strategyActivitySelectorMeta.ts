import type { StrategyActivitySnapshot } from '../types'
import { strategyRuntimeSignalLabel } from '../utils/app-helpers'
import { resolveStrategyActivityRuntime } from './strategyActivitySelectorBase'
import {
  resolveStrategyActivityBacktestSources,
  resolveStrategyActivityChangeRequestSources,
  resolveStrategyActivityProposalSources,
  resolveStrategyActivityReviewSources,
  resolveStrategyActivityTrackingSources,
} from './strategyActivitySelectorSources'
import {
  resolveStrategyActivityOpsSources,
  resolveStrategyActivityOpsSummaries,
} from './strategyActivitySelectorOps'
import {
  resolveStrategyActivityCollections,
  type StrategyActivityCollections,
} from './strategyActivitySelectorCollections'

export type StrategyActivitySnapshotViewModel = {
  strategyId: string | null
  meta: {
    activityAvailable: boolean
    generatedAt: string | null
    headline: string
  }
  proposalSources: ReturnType<typeof resolveStrategyActivityProposalSources>
  changeRequestSources: ReturnType<typeof resolveStrategyActivityChangeRequestSources>
  backtestSources: ReturnType<typeof resolveStrategyActivityBacktestSources>
  reviewSources: ReturnType<typeof resolveStrategyActivityReviewSources>
  trackingSources: ReturnType<typeof resolveStrategyActivityTrackingSources>
  opsSources: ReturnType<typeof resolveStrategyActivityOpsSources>
  opsSummaries: ReturnType<typeof resolveStrategyActivityOpsSummaries>
  collections: StrategyActivityCollections
}

export function resolveStrategyActivitySnapshotViewModel(
  activity?: StrategyActivitySnapshot | null,
): StrategyActivitySnapshotViewModel {
  const runtime = resolveStrategyActivityRuntime(activity)
  return {
    strategyId: activity?.strategy_id ?? null,
    meta: {
      activityAvailable: Boolean(activity),
      generatedAt: activity?.generated_at ?? null,
      headline: runtime ? `${strategyRuntimeSignalLabel(runtime.signal)} · ${runtime.next_action}` : '运行态尚未准备好',
    },
    proposalSources: resolveStrategyActivityProposalSources(activity),
    changeRequestSources: resolveStrategyActivityChangeRequestSources(activity),
    backtestSources: resolveStrategyActivityBacktestSources(activity),
    reviewSources: resolveStrategyActivityReviewSources(activity),
    trackingSources: resolveStrategyActivityTrackingSources(activity),
    opsSources: resolveStrategyActivityOpsSources(activity),
    opsSummaries: resolveStrategyActivityOpsSummaries(activity),
    collections: resolveStrategyActivityCollections(activity),
  }
}
