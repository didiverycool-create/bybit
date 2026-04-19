import type {
  AgentJob,
  BacktestRun,
  StrategyActivityBacktestSummary,
  StrategyActivityJobSummary,
  StrategyActivityReviewSummary,
  StrategyActivitySnapshot,
  ReviewDocument,
} from '../types'
import {
  resolveStrategyActivityDecisionSection,
  resolveStrategyActivitySection,
} from './strategyActivitySelectorStructure'
import { preferStrategyActivitySectionPriority } from './strategyActivitySelectorPriority'

export function resolveStrategyActivityBacktestSources(activity?: StrategyActivitySnapshot | null) {
  const backtestSection = resolveStrategyActivitySection(activity, 'backtest')
  const backtestDecisionContext = resolveStrategyActivityDecisionSection(activity, 'backtest')
  return {
    latestBacktest: preferStrategyActivitySectionPriority(
      backtestSection?.latest,
      undefined,
    ),
    latestActionableBacktest: preferStrategyActivitySectionPriority(
      backtestSection?.latest_actionable,
      undefined,
    ),
    latestBacktestRecord: preferStrategyActivitySectionPriority(
      backtestSection?.latest_record,
      backtestDecisionContext?.latest_record,
    ),
    latestActionableBacktestRecord: preferStrategyActivitySectionPriority(
      backtestSection?.latest_actionable_record,
      backtestDecisionContext?.actionable_record,
    ),
    latestBacktestReview: preferStrategyActivitySectionPriority(
      backtestSection?.latest_review,
      undefined,
    ),
    latestActionableBacktestReview: preferStrategyActivitySectionPriority(
      backtestSection?.latest_actionable_review,
      undefined,
    ),
    latestBacktestJob: preferStrategyActivitySectionPriority(
      backtestSection?.latest_job,
      undefined,
    ),
    latestActionableBacktestJob: preferStrategyActivitySectionPriority(
      backtestSection?.latest_actionable_job,
      undefined,
    ),
    latestBacktestReviewRecord: preferStrategyActivitySectionPriority(
      backtestSection?.latest_review_record,
      backtestDecisionContext?.latest_review_record,
    ),
    latestActionableBacktestReviewRecord: preferStrategyActivitySectionPriority(
      backtestSection?.latest_actionable_review_record,
      backtestDecisionContext?.actionable_review_record,
    ),
    latestBacktestJobRecord: preferStrategyActivitySectionPriority(
      backtestSection?.latest_job_record,
      backtestDecisionContext?.latest_job_record,
    ),
    latestActionableBacktestJobRecord: preferStrategyActivitySectionPriority(
      backtestSection?.latest_actionable_job_record,
      backtestDecisionContext?.actionable_job_record,
    ),
  } satisfies {
    latestBacktest: StrategyActivityBacktestSummary | null
    latestActionableBacktest: StrategyActivityBacktestSummary | null
    latestBacktestRecord: BacktestRun | null
    latestActionableBacktestRecord: BacktestRun | null
    latestBacktestReview: StrategyActivityReviewSummary | null
    latestActionableBacktestReview: StrategyActivityReviewSummary | null
    latestBacktestJob: StrategyActivityJobSummary | null
    latestActionableBacktestJob: StrategyActivityJobSummary | null
    latestBacktestReviewRecord: ReviewDocument | null
    latestActionableBacktestReviewRecord: ReviewDocument | null
    latestBacktestJobRecord: AgentJob | null
    latestActionableBacktestJobRecord: AgentJob | null
  }
}
