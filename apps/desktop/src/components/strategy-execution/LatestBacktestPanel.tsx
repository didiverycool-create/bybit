import type { AgentJob, BacktestRun, StrategyRuntimeSnapshot, StrategySummary } from '../../types'
import {
  formatNumber,
  jobStatusToneClass,
  strategyRuntimeSignalLabel,
  strategyRuntimeSignalToneClass,
} from '../../utils/app-helpers'

type BacktestDecisionMeta = {
  label: string
  description: string
  recommendedRange?: string | null
  recommendedTimeframe?: string | null
  nextAction?: string | null
  chipClass?: string
} | null

type BacktestSampleMeta = {
  label: string
  description: string
  chipClass: string
} | null

type BacktestWindowMeta = {
  attention: boolean
  truncated?: boolean
  label: string
  description: string
  detail: string
  nextAction?: string | null
  chipClass: string
} | null

type BacktestLineageMeta = {
  label: string
  detail: string
} | null

type BacktestReviewJobMeta = {
  label: string
  detail: string
  canRetry: boolean
} | null

export type LatestBacktestPanelProps = {
  selectedStrategy: StrategySummary
  latestStrategyBacktest: BacktestRun | null
  latestStrategyBacktestDecisionMeta: BacktestDecisionMeta
  latestStrategyBacktestSampleMeta: BacktestSampleMeta
  latestStrategyBacktestWindowMeta: BacktestWindowMeta
  latestStrategyBacktestLineageMeta: BacktestLineageMeta
  latestStrategyBacktestReview: { id: string } | null
  latestStrategyBacktestReviewJob: AgentJob | null
  latestStrategyBacktestReviewJobMeta: BacktestReviewJobMeta
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onRetryAgentJob: (jobId: string, options?: { focusJob?: boolean }) => void
  onRerunBacktestFromRecommendation: (backtest: BacktestRun) => void
}

export default function LatestBacktestPanel({
  selectedStrategy,
  latestStrategyBacktest,
  latestStrategyBacktestDecisionMeta,
  latestStrategyBacktestSampleMeta,
  latestStrategyBacktestWindowMeta,
  latestStrategyBacktestLineageMeta,
  latestStrategyBacktestReview,
  latestStrategyBacktestReviewJob,
  latestStrategyBacktestReviewJobMeta,
  selectedStrategyRuntime,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onRetryAgentJob,
  onRerunBacktestFromRecommendation,
}: LatestBacktestPanelProps) {
  return (
    <>
      <div className="panel-head panel-head--compact">
        <div>
          <span className="section-label">最新回测与请求</span>
          <h3>围绕当前策略的执行上下文</h3>
        </div>
        <span className="chip chip--muted">{selectedStrategy.symbols.join(' / ')}</span>
      </div>
      {latestStrategyBacktest ? (
        <div className="stack-list">
          <div className="stack-row">
            <strong>回测区间</strong>
            <span>{latestStrategyBacktest.data_range}</span>
          </div>
          <div className="stack-row">
            <strong>数据与滑点</strong>
            <span>{latestStrategyBacktest.data_granularity} · {latestStrategyBacktest.slippage_model}</span>
          </div>
          <div className="stack-row">
            <strong>收益 / 回撤 / 夏普</strong>
            <span>
              {latestStrategyBacktest.metrics.annual_return} · {latestStrategyBacktest.metrics.max_drawdown} ·{' '}
              {latestStrategyBacktest.metrics.sharpe}
            </span>
          </div>
          <div className="stack-row">
            <strong>成交数</strong>
            <span>
              {latestStrategyBacktest.metrics.trades} 笔
              {latestStrategyBacktestSampleMeta ? ` · ${latestStrategyBacktestSampleMeta.description}` : ''}
              {latestStrategyBacktestWindowMeta?.attention ? ` · ${latestStrategyBacktestWindowMeta.label}` : ''}
            </span>
          </div>
          {latestStrategyBacktestDecisionMeta && (
            <div className="stack-row">
              <strong>结论门禁</strong>
              <span>{latestStrategyBacktestDecisionMeta.description}</span>
            </div>
          )}
          {latestStrategyBacktestWindowMeta && (
            <div className="stack-row">
              <strong>样本窗口</strong>
              <span>{latestStrategyBacktestWindowMeta.detail}</span>
            </div>
          )}
          {latestStrategyBacktestDecisionMeta?.nextAction && (
            <div className="stack-row">
              <strong>门禁建议</strong>
              <span>{latestStrategyBacktestDecisionMeta.nextAction}</span>
            </div>
          )}
          {latestStrategyBacktestLineageMeta && (
            <div className="stack-row">
              <strong>来源链路</strong>
              <span>
                {latestStrategyBacktestLineageMeta.detail}
                {latestStrategyBacktest.source_change_request_id && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="ghost-button ghost-button--inline"
                      onClick={() =>
                        onOpenChangeRequest(
                          latestStrategyBacktest.source_change_request_id,
                          latestStrategyBacktest.strategy_id,
                        )
                      }
                    >
                      来源变更
                    </button>
                  </>
                )}
                {latestStrategyBacktest.source_backtest_id && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="ghost-button ghost-button--inline"
                      onClick={() =>
                        onOpenBacktestDetail(latestStrategyBacktest.source_backtest_id, latestStrategyBacktest.strategy_id)
                      }
                    >
                      来源回测
                    </button>
                  </>
                )}
                {latestStrategyBacktest.source_review_id && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="ghost-button ghost-button--inline"
                      onClick={() =>
                        onOpenSourceReview(latestStrategyBacktest.source_review_id, latestStrategyBacktest.strategy_id)
                      }
                    >
                      来源复盘
                    </button>
                  </>
                )}
                {latestStrategyBacktest.source_proposal_id && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="ghost-button ghost-button--inline"
                      onClick={() =>
                        onOpenStrategyProposal(latestStrategyBacktest.source_proposal_id, latestStrategyBacktest.strategy_id)
                      }
                    >
                      来源提案
                    </button>
                  </>
                )}
              </span>
            </div>
          )}
          {latestStrategyBacktestReviewJobMeta &&
            latestStrategyBacktestReviewJob &&
            (latestStrategyBacktestReviewJob.status !== 'completed' || !latestStrategyBacktestReview) && (
              <div className="stack-row">
                <strong>复盘任务</strong>
                <span>
                  <span className={jobStatusToneClass(latestStrategyBacktestReviewJob.status)}>
                    {latestStrategyBacktestReviewJobMeta.label}
                  </span>
                  {' · '}
                  {latestStrategyBacktestReviewJobMeta.detail}
                  {' '}
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() => onOpenAiSchedulerJob(latestStrategyBacktestReviewJob.id)}
                  >
                    打开任务
                  </button>
                  {latestStrategyBacktestReviewJobMeta.canRetry && (
                    <button
                      type="button"
                      className="ghost-button ghost-button--inline"
                      disabled={!serviceAvailable || retryAgentJobMutationPending}
                      onClick={() => {
                        void onRetryAgentJob(latestStrategyBacktestReviewJob.id)
                      }}
                    >
                      重试
                    </button>
                  )}
                </span>
              </div>
            )}
          {latestStrategyBacktestDecisionMeta?.recommendedRange &&
            latestStrategyBacktestDecisionMeta?.recommendedTimeframe && (
              <div className="stack-row">
                <strong>门禁重跑</strong>
                <span>
                  {latestStrategyBacktestDecisionMeta.recommendedRange}
                  {' @ '}
                  {latestStrategyBacktestDecisionMeta.recommendedTimeframe}
                  {' '}
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    disabled={!serviceAvailable || backtestMutationPending}
                    title={latestStrategyBacktestDecisionMeta.nextAction ?? '按当前结论门禁建议重跑'}
                    onClick={() => {
                      void onRerunBacktestFromRecommendation(latestStrategyBacktest)
                    }}
                  >
                    按建议重跑
                  </button>
                </span>
              </div>
            )}
          {latestStrategyBacktestWindowMeta?.nextAction && (
            <div className="stack-row">
              <strong>补样本建议</strong>
              <span>{latestStrategyBacktestWindowMeta.nextAction}</span>
            </div>
          )}
          {selectedStrategyRuntime && (
            <div className="stack-row">
              <strong>运行态</strong>
              <span>
                <span className={strategyRuntimeSignalToneClass(selectedStrategyRuntime.signal)}>
                  {strategyRuntimeSignalLabel(selectedStrategyRuntime.signal)}
                </span>
                {' · '}
                参考价 {formatNumber(selectedStrategyRuntime.reference_price)}
                {' · '}
                最新 {formatNumber(selectedStrategyRuntime.last_price)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">当前策略还没有回测记录</div>
      )}
    </>
  )
}
