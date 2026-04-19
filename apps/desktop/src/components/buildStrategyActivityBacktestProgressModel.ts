import type { StrategyActivityBacktestSummary } from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  backtestReviewJobMeta,
  backtestWindowMeta,
  prependUniqueActivityItem,
} from '../utils/app-helpers'
import type {
  StrategyActivityProgressLookupContext,
  UseStrategyActivityProgressModelArgs,
} from './strategyActivityProgressShared'

type BacktestProgressArgs = Pick<UseStrategyActivityProgressModelArgs, 'selectedBacktest'>

export function buildStrategyActivityBacktestProgressModel(
  { selectedBacktest }: BacktestProgressArgs,
  context: StrategyActivityProgressLookupContext,
) {
  const {
    activityStrategyId,
    backtestSources,
    strategyActivityCollections,
    backtestById,
    backtestReviewJobByBacktestId,
    findLatestBacktestReview,
    resolveReviewRecord,
    resolveJobRecord,
  } = context
  const {
    latestBacktest: latestBacktestSource,
    latestActionableBacktest: latestActionableBacktestSource,
    latestBacktestRecord: latestBacktestRecordSource,
    latestActionableBacktestRecord: latestActionableBacktestRecordSource,
    latestBacktestReview: latestBacktestReviewSource,
    latestBacktestReviewRecord: latestBacktestReviewRecordSource,
    latestBacktestJob: latestBacktestJobSource,
    latestBacktestJobRecord: latestBacktestJobRecordSource,
    latestActionableBacktestReview: latestActionableBacktestReviewSource,
    latestActionableBacktestReviewRecord: latestActionableBacktestReviewRecordSource,
    latestActionableBacktestJob: latestActionableBacktestJobSource,
    latestActionableBacktestJobRecord: latestActionableBacktestJobRecordSource,
  } = backtestSources

  const strategyActivityBacktests = (() => {
    let activityBacktests = strategyActivityCollections.recentBacktests ?? []
    if (latestBacktestSource) {
      activityBacktests = prependUniqueActivityItem(activityBacktests, latestBacktestSource, (backtest) => backtest.id, 8)
    }
    if (latestActionableBacktestSource) {
      activityBacktests = prependUniqueActivityItem(
        activityBacktests,
        latestActionableBacktestSource,
        (backtest) => backtest.id,
        8,
      )
    }
    if (!selectedBacktest) {
      return activityBacktests
    }
    if (selectedBacktest.strategy_id !== activityStrategyId) {
      return activityBacktests
    }
    if (activityBacktests.some((backtest) => backtest.id === selectedBacktest.id)) {
      return activityBacktests
    }
    const focusedBacktest: StrategyActivityBacktestSummary = {
      id: selectedBacktest.id,
      status: selectedBacktest.status,
      timeframe: selectedBacktest.timeframe,
      data_range: selectedBacktest.data_range,
      sample_quality: selectedBacktest.sample_quality,
      history_source: selectedBacktest.history_source ?? 'exchange_history',
      decision_readiness: selectedBacktest.decision_readiness ?? 'ready',
      source_change_request_id: selectedBacktest.source_change_request_id ?? null,
      source_backtest_id: selectedBacktest.source_backtest_id ?? null,
      source_review_id: selectedBacktest.source_review_id ?? null,
      source_proposal_id: selectedBacktest.source_proposal_id ?? null,
      trigger_reason: selectedBacktest.trigger_reason ?? null,
      created_at: selectedBacktest.started_at,
      finished_at: selectedBacktest.finished_at ?? null,
    }
    return prependUniqueActivityItem(activityBacktests, focusedBacktest, (backtest) => backtest.id, 8)
  })()

  const activityLatestBacktest = latestBacktestSource ?? strategyActivityBacktests[0] ?? null
  const activityLatestBacktestRecord =
    latestBacktestRecordSource ??
    (activityLatestBacktest ? backtestById.get(activityLatestBacktest.id) ?? null : null)
  const activityLatestBacktestDecisionMeta = activityLatestBacktestRecord
    ? backtestDecisionReadinessMeta(activityLatestBacktestRecord)
    : activityLatestBacktest
      ? backtestDecisionReadinessMeta({
          decision_readiness: activityLatestBacktest.decision_readiness ?? null,
        })
      : null
  const activityLatestBacktestWindowMeta = activityLatestBacktestRecord
    ? backtestWindowMeta(activityLatestBacktestRecord)
    : null
  const activityLatestBacktestLineageMeta = activityLatestBacktestRecord
    ? backtestLineageMeta(activityLatestBacktestRecord)
    : backtestLineageMeta(activityLatestBacktest)
  const activityLatestBacktestReview =
    (activityLatestBacktest ? findLatestBacktestReview(activityLatestBacktest.id) : null) ??
    latestBacktestReviewSource ??
    null
  const activityLatestBacktestReviewRecord =
    latestBacktestReviewRecordSource ?? resolveReviewRecord(activityLatestBacktestReview)
  const activityLatestBacktestJob =
    (activityLatestBacktest
      ? backtestReviewJobByBacktestId.get(activityLatestBacktest.id) ?? null
      : null) ??
    latestBacktestJobSource ??
    null
  const activityLatestBacktestJobRecord = latestBacktestJobRecordSource ?? resolveJobRecord(activityLatestBacktestJob)
  const activityLatestBacktestJobMeta = backtestReviewJobMeta(
    activityLatestBacktestJobRecord ?? activityLatestBacktestJob,
    Boolean(activityLatestBacktestReviewRecord ?? activityLatestBacktestReview),
  )
  const activityLatestBacktestStrategyId = activityLatestBacktestRecord?.strategy_id ?? activityStrategyId ?? null
  const activityLatestBacktestSourceChangeRequestId =
    activityLatestBacktestRecord?.source_change_request_id ?? activityLatestBacktest?.source_change_request_id ?? null
  const activityLatestBacktestSourceBacktestId =
    activityLatestBacktestRecord?.source_backtest_id ?? activityLatestBacktest?.source_backtest_id ?? null
  const activityLatestBacktestSourceReviewId =
    activityLatestBacktestRecord?.source_review_id ?? activityLatestBacktest?.source_review_id ?? null
  const activityLatestBacktestSourceProposalId =
    activityLatestBacktestRecord?.source_proposal_id ?? activityLatestBacktest?.source_proposal_id ?? null

  const activityLatestActionableBacktest =
    strategyActivityBacktests.find((backtest) => {
      const linkedBacktest = backtestById.get(backtest.id) ?? null
      const decisionMeta = linkedBacktest ? backtestDecisionReadinessMeta(linkedBacktest) : null
      const linkedReview = findLatestBacktestReview(backtest.id)
      const linkedJob = backtestReviewJobByBacktestId.get(backtest.id) ?? null
      const linkedJobMeta = backtestReviewJobMeta(linkedJob, Boolean(linkedReview))
      return Boolean(
        (decisionMeta?.recommendedRange && decisionMeta?.recommendedTimeframe) || linkedJobMeta?.canRetry,
      )
    }) ??
    latestActionableBacktestSource ??
    null
  const activityLatestActionableBacktestRecord =
    latestActionableBacktestRecordSource ??
    (activityLatestActionableBacktest ? backtestById.get(activityLatestActionableBacktest.id) ?? null : null)
  const activityLatestActionableBacktestDecisionMeta = activityLatestActionableBacktestRecord
    ? backtestDecisionReadinessMeta(activityLatestActionableBacktestRecord)
    : null
  const activityLatestActionableBacktestReview =
    latestActionableBacktestReviewSource ??
    (activityLatestActionableBacktest ? findLatestBacktestReview(activityLatestActionableBacktest.id) : null) ??
    null
  const activityLatestActionableBacktestReviewRecord =
    latestActionableBacktestReviewRecordSource ??
    resolveReviewRecord(activityLatestActionableBacktestReview)
  const activityLatestActionableBacktestJob =
    latestActionableBacktestJobSource ??
    (activityLatestActionableBacktest
      ? backtestReviewJobByBacktestId.get(activityLatestActionableBacktest.id) ?? null
      : null) ??
    null
  const activityLatestActionableBacktestJobRecord =
    latestActionableBacktestJobRecordSource ??
    resolveJobRecord(activityLatestActionableBacktestJob)
  const activityLatestActionableBacktestJobMeta = backtestReviewJobMeta(
    activityLatestActionableBacktestJobRecord ?? activityLatestActionableBacktestJob,
    Boolean(activityLatestActionableBacktestReviewRecord ?? activityLatestActionableBacktestReview),
  )
  const activityLatestActionableBacktestSummary = activityLatestActionableBacktest
    ? `${activityLatestActionableBacktest.id} · ${activityLatestActionableBacktest.timeframe} · ${activityLatestActionableBacktest.data_range} · ${activityLatestActionableBacktest.status}`
    : null
  const activityLatestActionableBacktestDiffersFromLatest = Boolean(
    activityLatestActionableBacktest && activityLatestActionableBacktest.id !== activityLatestBacktest?.id,
  )

  return {
    strategyActivityBacktests,
    activityLatestBacktest,
    activityLatestBacktestRecord,
    activityLatestBacktestDecisionMeta,
    activityLatestBacktestWindowMeta,
    activityLatestBacktestLineageMeta,
    activityLatestBacktestReview,
    activityLatestBacktestReviewRecord,
    activityLatestBacktestJob,
    activityLatestBacktestJobRecord,
    activityLatestBacktestJobMeta,
    activityLatestBacktestStrategyId,
    activityLatestBacktestSourceChangeRequestId,
    activityLatestBacktestSourceBacktestId,
    activityLatestBacktestSourceReviewId,
    activityLatestBacktestSourceProposalId,
    activityLatestActionableBacktest,
    activityLatestActionableBacktestRecord,
    activityLatestActionableBacktestDecisionMeta,
    activityLatestActionableBacktestReview,
    activityLatestActionableBacktestReviewRecord,
    activityLatestActionableBacktestJob,
    activityLatestActionableBacktestJobRecord,
    activityLatestActionableBacktestJobMeta,
    activityLatestActionableBacktestSummary,
    activityLatestActionableBacktestDiffersFromLatest,
  }
}
