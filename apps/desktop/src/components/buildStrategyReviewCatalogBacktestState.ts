import type { AgentJob, BacktestRun, StrategySummary } from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestSampleQualityMeta,
  backtestWindowMeta,
} from '../utils/app-helpers'

export function buildStrategyReviewCatalogBacktestState({
  selectedStrategy,
  backtests,
  schedulerJobs,
}: {
  selectedStrategy: StrategySummary | null
  backtests: BacktestRun[]
  schedulerJobs: AgentJob[]
}) {
  const backtestReviewJobs = [...schedulerJobs]
    .filter((job) => job.job_type === 'generate_backtest_review')
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())

  const strategyBacktests = selectedStrategy
    ? backtests.filter((item) => item.strategy_id === selectedStrategy.id)
    : []
  const latestStrategyBacktest = strategyBacktests[0]

  return {
    backtestReviewJobs,
    strategyBacktests,
    latestStrategyBacktest,
    latestStrategyBacktestDecisionMeta: backtestDecisionReadinessMeta(latestStrategyBacktest),
    latestStrategyBacktestSampleMeta: backtestSampleQualityMeta(latestStrategyBacktest),
    latestStrategyBacktestWindowMeta: backtestWindowMeta(latestStrategyBacktest),
  }
}
