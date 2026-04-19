import type { AgentJob, BacktestRun, ReviewDocument } from '../../types'
import { formatTime, jobStatusToneClass } from '../../utils/app-helpers'

type BacktestSampleMeta = {
  label: string
  description: string
  chipClass: string
} | null

type BacktestDecisionMeta = {
  label: string
  description: string
  recommendedRange?: string | null
  recommendedTimeframe?: string | null
  nextAction?: string | null
  chipClass?: string
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

export type BacktestExperimentPanelProps = {
  selectedBacktest: BacktestRun
  selectedBacktestSampleMeta: BacktestSampleMeta
  selectedBacktestDecisionMeta: BacktestDecisionMeta
  selectedBacktestWindowMeta: BacktestWindowMeta
  selectedBacktestLineageMeta: BacktestLineageMeta
  selectedBacktestReview: ReviewDocument | null
  selectedBacktestReviewJob: AgentJob | null
  selectedBacktestReviewJobMeta: BacktestReviewJobMeta
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onRerunBacktestFromRecommendation: (backtest: BacktestRun) => void
}

export default function BacktestExperimentPanel({
  selectedBacktest,
  selectedBacktestSampleMeta,
  selectedBacktestDecisionMeta,
  selectedBacktestWindowMeta,
  selectedBacktestLineageMeta,
  selectedBacktestReview,
  selectedBacktestReviewJob,
  selectedBacktestReviewJobMeta,
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
}: BacktestExperimentPanelProps) {
  return (
    <div className="console-panel">
      <div className="panel-head panel-head--compact">
        <div>
          <span className="section-label">实验环境</span>
          <h3>区间、成本与执行假设</h3>
        </div>
      </div>
      <div className="stack-list">
        <div className="stack-row">
          <strong>回测区间</strong>
          <span>{selectedBacktest.data_range}</span>
        </div>
        <div className="stack-row">
          <strong>数据粒度</strong>
          <span>{selectedBacktest.data_granularity}</span>
        </div>
        <div className="stack-row">
          <strong>夏普</strong>
          <span>{selectedBacktest.metrics.sharpe}</span>
        </div>
        <div className="stack-row">
          <strong>胜率</strong>
          <span>{selectedBacktest.metrics.win_rate}</span>
        </div>
        {selectedBacktest.risk_ratios && (
          <div className="stack-row">
            <strong>风险比率</strong>
            <span>
              Sortino {selectedBacktest.risk_ratios.sortino_ratio.toFixed(2)}
              {' · '}
              Calmar {selectedBacktest.risk_ratios.calmar_ratio.toFixed(2)}
              {' · '}
              盈亏比 {selectedBacktest.risk_ratios.profit_factor.toFixed(2)}
            </span>
          </div>
        )}
        {selectedBacktest.volatility_stats && (
          <div className="stack-row">
            <strong>波动</strong>
            <span>
              年化 {selectedBacktest.volatility_stats.annualized_volatility_pct.toFixed(2)}%
              {' · '}
              正向 bar {selectedBacktest.volatility_stats.positive_bar_ratio_pct.toFixed(1)}%
              {' · '}
              最长回撤 {selectedBacktest.volatility_stats.max_drawdown_duration_bars} bar
            </span>
          </div>
        )}
        {selectedBacktest.trade_rhythm_stats && (
          <div className="stack-row">
            <strong>节奏</strong>
            <span>
              连胜 {selectedBacktest.trade_rhythm_stats.longest_winning_streak_bars}
              {' / '}
              连亏 {selectedBacktest.trade_rhythm_stats.longest_losing_streak_bars} bar
              {' · '}
              胜负 bar 比 {selectedBacktest.trade_rhythm_stats.win_loss_bar_ratio.toFixed(2)}
            </span>
          </div>
        )}
        {selectedBacktest.benchmark_stats && (
          <div className="stack-row">
            <strong>对比基准</strong>
            <span>
              持有收益 {selectedBacktest.benchmark_stats.buy_hold_return_pct.toFixed(2)}%
              {' · '}
              超额 {selectedBacktest.benchmark_stats.strategy_over_buy_hold_pct.toFixed(2)}%
              {' · '}
              Alpha {selectedBacktest.benchmark_stats.alpha_pct.toFixed(2)}%
            </span>
          </div>
        )}
        {selectedBacktest.exposure_stats && (
          <div className="stack-row">
            <strong>敞口统计</strong>
            <span>
              偏度 {selectedBacktest.exposure_stats.return_skew.toFixed(2)}
              {' · '}
              峰度 {selectedBacktest.exposure_stats.return_kurtosis.toFixed(2)}
              {' · '}
              Ulcer {selectedBacktest.exposure_stats.ulcer_index_pct.toFixed(2)}%
              {' · '}
              恢复因子 {selectedBacktest.exposure_stats.recovery_factor.toFixed(2)}
              {' · '}
              下行波动 {selectedBacktest.exposure_stats.downside_deviation_pct.toFixed(2)}%
            </span>
          </div>
        )}
        <div className="stack-row">
          <strong>样本质量</strong>
          <span>{selectedBacktestSampleMeta?.description ?? '未标注'}</span>
        </div>
        {selectedBacktestDecisionMeta && (
          <div className="stack-row">
            <strong>结论门禁</strong>
            <span>{selectedBacktestDecisionMeta.description}</span>
          </div>
        )}
        {selectedBacktestWindowMeta && (
          <div className="stack-row">
            <strong>样本窗口</strong>
            <span>{selectedBacktestWindowMeta.detail}</span>
          </div>
        )}
        {selectedBacktestDecisionMeta?.nextAction && (
          <div className="stack-row">
            <strong>门禁建议</strong>
            <span>{selectedBacktestDecisionMeta.nextAction}</span>
          </div>
        )}
        {selectedBacktestLineageMeta && (
          <div className="stack-row">
            <strong>来源链路</strong>
            <span>
              {selectedBacktestLineageMeta.detail}
              {selectedBacktest.source_change_request_id && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() =>
                      onOpenChangeRequest(selectedBacktest.source_change_request_id, selectedBacktest.strategy_id)
                    }
                  >
                    来源变更
                  </button>
                </>
              )}
              {selectedBacktest.source_backtest_id && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() =>
                      onOpenBacktestDetail(selectedBacktest.source_backtest_id, selectedBacktest.strategy_id)
                    }
                  >
                    来源回测
                  </button>
                </>
              )}
              {selectedBacktest.source_review_id && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() =>
                      onOpenSourceReview(selectedBacktest.source_review_id, selectedBacktest.strategy_id)
                    }
                  >
                    来源复盘
                  </button>
                </>
              )}
              {selectedBacktest.source_proposal_id && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() =>
                      onOpenStrategyProposal(selectedBacktest.source_proposal_id, selectedBacktest.strategy_id)
                    }
                  >
                    来源提案
                  </button>
                </>
              )}
            </span>
          </div>
        )}
        {selectedBacktestReviewJobMeta &&
          selectedBacktestReviewJob &&
          (selectedBacktestReviewJob.status !== 'completed' || !selectedBacktestReview) && (
            <div className="stack-row">
              <strong>复盘任务</strong>
              <span>
                <span className={jobStatusToneClass(selectedBacktestReviewJob.status)}>
                  {selectedBacktestReviewJobMeta.label}
                </span>
                {' · '}
                {selectedBacktestReviewJobMeta.detail}{' '}
                <button
                  type="button"
                  className="ghost-button ghost-button--inline"
                  onClick={() => onOpenAiSchedulerJob(selectedBacktestReviewJob.id)}
                >
                  打开任务
                </button>
                {selectedBacktestReviewJobMeta.canRetry && (
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    disabled={!serviceAvailable || retryAgentJobMutationPending}
                    onClick={() => onRetryAgentJob(selectedBacktestReviewJob.id)}
                  >
                    重试
                  </button>
                )}
              </span>
            </div>
          )}
        {selectedBacktestDecisionMeta?.recommendedRange &&
          selectedBacktestDecisionMeta?.recommendedTimeframe && (
            <div className="stack-row">
              <strong>门禁重跑</strong>
              <span>
                {selectedBacktestDecisionMeta.recommendedRange}
                {' @ '}
                {selectedBacktestDecisionMeta.recommendedTimeframe}{' '}
                <button
                  type="button"
                  className="ghost-button ghost-button--inline"
                  disabled={!serviceAvailable || backtestMutationPending}
                  title={selectedBacktestDecisionMeta.nextAction ?? '按当前结论门禁建议重跑'}
                  onClick={() => onRerunBacktestFromRecommendation(selectedBacktest)}
                >
                  按建议重跑
                </button>
              </span>
            </div>
          )}
        {selectedBacktestWindowMeta?.nextAction && (
          <div className="stack-row">
            <strong>补样本建议</strong>
            <span>{selectedBacktestWindowMeta.nextAction}</span>
          </div>
        )}
        <div className="stack-row">
          <strong>手续费 / 滑点</strong>
          <span>
            {selectedBacktest.fee_model} · {selectedBacktest.slippage_model}
          </span>
        </div>
        <div className="stack-row">
          <strong>起止时间</strong>
          <span>
            {formatTime(selectedBacktest.started_at)}
            {' -> '}
            {formatTime(selectedBacktest.finished_at ?? selectedBacktest.started_at)}
          </span>
        </div>
        <div className="stack-row">
          <strong>说明</strong>
          <span>{selectedBacktest.notes}</span>
        </div>
      </div>
    </div>
  )
}
