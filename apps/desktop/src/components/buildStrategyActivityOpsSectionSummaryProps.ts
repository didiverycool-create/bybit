import { backtestLineageMeta, strategyAgentJobSummary } from '../utils/app-helpers'
import type { StrategyActivityOpsSummaryState } from './buildStrategyActivityOpsSectionTypes'

type BuildStrategyActivityOpsSectionSummaryPropsArgs = {
  summaryState: StrategyActivityOpsSummaryState
}

export function buildStrategyActivityOpsSectionSummaryProps({
  summaryState,
}: BuildStrategyActivityOpsSectionSummaryPropsArgs): {
  latestActivitySummaryText: string | null
  latestOpsSummaryText: string | null
} {
  const latestActivitySummaryText =
    summaryState.activityLatestPrimaryReview ||
    summaryState.activityLatestBacktest ||
    summaryState.activityLatestTrackingReview ||
    summaryState.activityLatestTrackingJob
      ? `${summaryState.activityLatestBacktest
          ? `最近回测: ${summaryState.activityLatestBacktest.id} · ${summaryState.activityLatestBacktest.timeframe} · ${summaryState.activityLatestBacktest.data_range} · ${summaryState.activityLatestBacktest.status}`
          : '最近回测: 暂无'}${
          summaryState.activityLatestBacktestDecisionMeta
            ? ` · 结论 ${summaryState.activityLatestBacktestDecisionMeta.label}`
            : summaryState.activityLatestBacktestWindowMeta?.attention
              ? ` · ${summaryState.activityLatestBacktestWindowMeta.label}`
              : ''
        }${
          summaryState.activityLatestBacktestReview
            ? ` · 最新结果: ${summaryState.activityLatestBacktestReview.title}`
            : summaryState.activityLatestBacktestJobMeta
              ? ` · AI复盘任务: ${summaryState.activityLatestBacktestJobMeta.label}`
              : ''
        }${summaryState.activityLatestBacktestLineageMeta ? ` · ${summaryState.activityLatestBacktestLineageMeta.detail}` : ''}${
          summaryState.activityLatestPrimaryReview || summaryState.activityLatestTrackingReview || summaryState.activityLatestTrackingJob
            ? ' · '
            : ''
        }${
          summaryState.activityLatestPrimaryReview
            ? `最近复盘: ${summaryState.activityLatestPrimaryReview.summary}`
            : '最近复盘: 暂无'
        }${
          summaryState.activityLatestPrimaryReview && backtestLineageMeta(summaryState.activityLatestPrimaryReview)
            ? ` · ${backtestLineageMeta(summaryState.activityLatestPrimaryReview)?.detail}`
            : ''
        }${summaryState.activityLatestTrackingReview ? ` · 最近跟踪: ${summaryState.activityLatestTrackingReview.summary}` : ''}${
          summaryState.activityLatestTrackingJob
            ? ` · 最近任务: ${strategyAgentJobSummary(summaryState.activityLatestTrackingJob)}`
            : ''
        }`
      : null

  const latestOpsSummaryText =
    summaryState.activityLatestAuditSummary ||
    summaryState.activityLatestAlertSummary ||
    summaryState.activityLatestOrderSummary ||
    summaryState.activityLatestTradeSummary
      ? `${summaryState.activityLatestAuditSummary ? `最新审计: ${summaryState.activityLatestAuditSummary}` : '最新审计: 暂无'}${
          summaryState.activityLatestAlertSummary ? ` · 最新提醒: ${summaryState.activityLatestAlertSummary}` : ''
        }${summaryState.activityLatestOrderSummary ? ` · 最新委托: ${summaryState.activityLatestOrderSummary}` : ''}${
          summaryState.activityLatestTradeSummary ? ` · 最新成交: ${summaryState.activityLatestTradeSummary}` : ''
        }`
      : null

  return {
    latestActivitySummaryText,
    latestOpsSummaryText,
  }
}
