import type { ActivityBacktestListItemProps } from './ActivityBacktestList.types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  backtestReviewJobMeta,
  backtestSampleQualityMeta,
  backtestWindowMeta,
  formatDateTime,
} from '../../utils/app-helpers'

export default function ActivityBacktestListItem({
  strategyId,
  backtest,
  activityLatestBacktest,
  activityLatestActionableBacktest,
  activityLatestActionableBacktestReview,
  activityLatestBacktestReview,
  activityLatestActionableBacktestJob,
  activityLatestBacktestJob,
  backtests,
  reviewCatalog,
  backtestReviewJobs,
  serviceAvailable,
  retryAgentJobMutationPending,
  backtestFocusLabels,
  onOpenBacktestDetail,
  onOpenReviewInspector,
  onOpenAiSchedulerJob,
  onOpenChangeRequest,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onRetryAgentJob,
}: ActivityBacktestListItemProps) {
  const linkedBacktest = backtests.find((item) => item.id === backtest.id) ?? null
  const backtestStrategyId = linkedBacktest?.strategy_id ?? strategyId
  const sampleMeta = linkedBacktest
    ? backtestSampleQualityMeta(linkedBacktest)
    : backtestSampleQualityMeta({
        sample_quality: backtest.sample_quality,
        reference_only: backtest.sample_quality === 'reference_only',
      })
  const decisionMeta = linkedBacktest
    ? backtestDecisionReadinessMeta(linkedBacktest)
    : backtestDecisionReadinessMeta({
        decision_readiness: backtest.decision_readiness ?? null,
      })
  const windowMeta = linkedBacktest ? backtestWindowMeta(linkedBacktest) : null
  const lineageMeta = linkedBacktest ? backtestLineageMeta(linkedBacktest) : backtestLineageMeta(backtest)
  const linkedReview =
    reviewCatalog
      .filter((review) => review.backtest_id === backtest.id && review.strategy_id === backtestStrategyId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ??
    (activityLatestActionableBacktest?.id === backtest.id ? activityLatestActionableBacktestReview ?? null : null) ??
    (activityLatestBacktest?.id === backtest.id ? activityLatestBacktestReview ?? null : null)
  const linkedJob =
    backtestReviewJobs.find((job) => job.backtest_id === backtest.id) ??
    (activityLatestActionableBacktest?.id === backtest.id ? activityLatestActionableBacktestJob ?? null : null) ??
    (activityLatestBacktest?.id === backtest.id ? activityLatestBacktestJob ?? null : null)
  const linkedJobMeta = backtestReviewJobMeta(linkedJob, Boolean(linkedReview))
  const focusLabels = backtestFocusLabels(backtest, linkedReview, linkedJob)

  return (
    <div
      className={`trade-row trade-row--fade ${focusLabels.length ? 'job-row--active' : ''}`}
      data-strategy-activity-row-id={backtest.id}
    >
      <div className="console-row__main">
        <strong>{backtest.id}</strong>
        <p>
          {backtest.timeframe} · {backtest.data_range} · {backtest.status}
          {windowMeta?.attention ? ` · ${windowMeta.description}` : ''}
        </p>
        {decisionMeta && (
          <p>
            结论门禁 {decisionMeta.label} · {decisionMeta.description}
            {decisionMeta.nextAction ? ` · 建议 ${decisionMeta.nextAction}` : ''}
          </p>
        )}
        {!decisionMeta && sampleMeta && backtest.sample_quality !== 'sufficient' && (
          <p>样本质量 {sampleMeta.label} · {sampleMeta.description}</p>
        )}
        {!decisionMeta && windowMeta?.attention && (
          <p>
            样本窗口 {windowMeta.label} · {windowMeta.description}
            {windowMeta.nextAction ? ` · 建议 ${windowMeta.nextAction}` : ''}
          </p>
        )}
        {linkedJobMeta && (!linkedReview || linkedJob?.status !== 'completed') && (
          <p>
            AI 复盘任务{linkedJobMeta.label} · {linkedJobMeta.detail}
          </p>
        )}
        {lineageMeta && <p className="panel-note">来源链路: {lineageMeta.detail}</p>}
      </div>
      <div className="trade-meta">
        <span className="console-tag">{backtest.timeframe}</span>
        <span className="console-tag">{backtest.status}</span>
        {activityLatestBacktest?.id === backtest.id && (
          <span className="console-tag console-tag--warn">当前最新</span>
        )}
        {activityLatestActionableBacktest?.id === backtest.id && (
          <span className="console-tag console-tag--warn">当前可处理</span>
        )}
        {sampleMeta && backtest.sample_quality !== 'sufficient' && (
          <span className={sampleMeta.chipClass}>{sampleMeta.label}</span>
        )}
        {decisionMeta && <span className={decisionMeta.chipClass}>{decisionMeta.label}</span>}
        {!decisionMeta && windowMeta?.attention && <span className={windowMeta.chipClass}>{windowMeta.label}</span>}
        {focusLabels.map((label) => (
          <span key={`${backtest.id}-${label}`} className="console-tag console-tag--warn">
            {label}
          </span>
        ))}
        <button type="button" className="micro-action" onClick={() => onOpenBacktestDetail(backtest.id, backtestStrategyId)}>
          打开回测
        </button>
        {linkedReview && (
          <button type="button" className="micro-action" onClick={() => onOpenReviewInspector(linkedReview.id, backtestStrategyId)}>
            查看结果
          </button>
        )}
        {linkedJob && (
          <button type="button" className="micro-action" onClick={() => onOpenAiSchedulerJob(linkedJob.id)}>
            打开任务
          </button>
        )}
        {linkedJobMeta?.canRetry && linkedJob && (
          <button
            type="button"
            className="micro-action"
            disabled={!serviceAvailable || retryAgentJobMutationPending}
            onClick={() => onRetryAgentJob(linkedJob.id)}
          >
            重试跟踪
          </button>
        )}
        {backtest.source_change_request_id && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenChangeRequest(backtest.source_change_request_id!, backtestStrategyId)}
          >
            来源变更
          </button>
        )}
        {backtest.source_backtest_id && backtest.source_backtest_id !== backtest.id && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenBacktestDetail(backtest.source_backtest_id!, backtestStrategyId)}
          >
            来源回测
          </button>
        )}
        {backtest.source_review_id && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenSourceReview(backtest.source_review_id!, backtestStrategyId)}
          >
            来源复盘
          </button>
        )}
        {backtest.source_proposal_id && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenStrategyProposal(backtest.source_proposal_id!, backtestStrategyId)}
          >
            来源提案
          </button>
        )}
        <small>{formatDateTime(backtest.finished_at ?? backtest.created_at)}</small>
      </div>
    </div>
  )
}
