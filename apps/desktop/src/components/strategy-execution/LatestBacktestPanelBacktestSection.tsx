import { jobStatusToneClass } from '../../utils/app-helpers'
import type { LatestBacktestPanelProps } from './LatestBacktestPanel.types'

export default function LatestBacktestPanelBacktestSection({
  latestStrategyBacktest,
  latestStrategyBacktestDecisionMeta,
  latestStrategyBacktestSampleMeta,
  latestStrategyBacktestWindowMeta,
  latestStrategyBacktestReview,
  latestStrategyBacktestReviewJobMeta,
  latestStrategyBacktestReviewJob,
  serviceAvailable,
  backtestMutationPending,
  onOpenAiSchedulerJob,
  onRetryAgentJob,
  onRerunBacktestFromRecommendation,
}: LatestBacktestPanelProps) {
  if (!latestStrategyBacktest) {
    return null
  }

  return (
    <div className="stack-list">
      <div className="stack-row">
        <strong>回测区间</strong>
        <span>{latestStrategyBacktest.data_range}</span>
      </div>
      <div className="stack-row">
        <strong>数据与滑点</strong>
        <span>
          {latestStrategyBacktest.data_granularity} · {latestStrategyBacktest.slippage_model}
        </span>
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
                  disabled={!serviceAvailable || backtestMutationPending}
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
    </div>
  )
}
