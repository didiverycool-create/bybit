import type {
  AgentJob,
  BacktestRun,
  ReviewDocument,
  StrategyActivityBacktestSummary,
} from '../../types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  backtestReviewJobMeta,
  backtestSampleQualityMeta,
  backtestWindowMeta,
  formatDateTime,
} from '../../utils/app-helpers'

export type ActivityBacktestListProps = {
  strategyId: string
  focusedBacktestSupplemented: boolean
  strategyActivityLatestBacktestSupplemented: boolean
  strategyActivityLatestActionableBacktestSupplemented: boolean
  strategyActivityBacktests: StrategyActivityBacktestSummary[]
  activityLatestBacktest: StrategyActivityBacktestSummary | null
  activityLatestActionableBacktest: StrategyActivityBacktestSummary | null
  activityLatestActionableBacktestReview: ReviewDocument | null
  activityLatestBacktestReview: ReviewDocument | null
  activityLatestActionableBacktestJob: AgentJob | null
  activityLatestBacktestJob: AgentJob | null
  backtests: BacktestRun[]
  reviewCatalog: ReviewDocument[]
  backtestReviewJobs: AgentJob[]
  serviceAvailable: boolean
  retryAgentJobMutationPending: boolean
  backtestFocusLabels: (
    backtest: StrategyActivityBacktestSummary,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
}

export default function ActivityBacktestList({
  strategyId,
  focusedBacktestSupplemented,
  strategyActivityLatestBacktestSupplemented,
  strategyActivityLatestActionableBacktestSupplemented,
  strategyActivityBacktests,
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
}: ActivityBacktestListProps) {
  return (
    <>
      <span className="section-label" data-strategy-activity-section-label="backtests">
        最近回测
      </span>
      {focusedBacktestSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="focused_backtest_hint">
          当前聚焦的回测不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一轮回测排障和复盘。
        </p>
      )}
      {strategyActivityLatestBacktestSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_backtest_supplemented_hint">
          顶部最近回测不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿当前最新回测排障和复盘。
        </p>
      )}
      {strategyActivityLatestActionableBacktestSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_backtest_supplemented_hint">
          顶部当前可处理回测不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿这轮仍可处理的回测推进。
        </p>
      )}
      <div
        className="trade-list trade-list--dense"
        data-strategy-activity-section="backtests"
        data-strategy-activity-action-group="backtests"
      >
        {strategyActivityBacktests.map((backtest) => {
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
              key={backtest.id}
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
                  <p>AI 复盘任务{linkedJobMeta.label} · {linkedJobMeta.detail}</p>
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
                {!decisionMeta && windowMeta?.attention && (
                  <span className={windowMeta.chipClass}>{windowMeta.label}</span>
                )}
                {focusLabels.map((label) => (
                  <span key={`${backtest.id}-${label}`} className="console-tag console-tag--warn">
                    {label}
                  </span>
                ))}
                <button
                  type="button"
                  className="micro-action"
                  onClick={() => onOpenBacktestDetail(backtest.id, backtestStrategyId)}
                >
                  打开回测
                </button>
                {linkedReview && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenReviewInspector(linkedReview.id, backtestStrategyId)}
                  >
                    查看结果
                  </button>
                )}
                {linkedJob && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenAiSchedulerJob(linkedJob.id)}
                  >
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
        })}
        {!strategyActivityBacktests.length && (
          <div className="empty-state empty-state--inline">当前没有最近回测活动。</div>
        )}
      </div>
    </>
  )
}
