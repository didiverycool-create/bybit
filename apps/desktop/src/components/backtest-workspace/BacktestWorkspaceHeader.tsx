import type { BacktestRun, StrategySummary } from '../../types'
import { backtestSampleQualityMeta, backtestWindowMeta, formatTime } from '../../utils/app-helpers'

type BacktestOption = {
  value: string
  label: string
}

type BacktestDecisionMeta = {
  label: string
  description: string
} | null

type BacktestWindowMeta = {
  attention: boolean
  description: string
} | null

type BacktestSampleMeta = {
  description: string
} | null

export type BacktestWorkspaceHeaderProps = {
  selectedStrategy: StrategySummary | null
  strategies: StrategySummary[]
  backtestFilter: 'selected' | 'all'
  onSelectBacktestFilter: (value: 'selected' | 'all') => void
  backtestsForWorkspace: BacktestRun[]
  latestWorkspaceBacktest: BacktestRun | null
  latestWorkspaceBacktestDecisionMeta: BacktestDecisionMeta
  latestWorkspaceBacktestWindowMeta: BacktestWindowMeta
  latestWorkspaceBacktestSampleMeta: BacktestSampleMeta
  openStrategyProposalsCount: number
  backtestTimeframeDraft: string
  onSelectBacktestTimeframeDraft: (value: string) => void
  backtestTimeframeOptions: BacktestOption[]
  backtestRangeDraft: string
  onSelectBacktestRangeDraft: (value: string) => void
  backtestRangeOptions: BacktestOption[]
  onSelectStrategyId: (strategyId: string) => void
  serviceAvailable: boolean
  backtestMutationPending: boolean
  onSubmitBacktest: () => void
  onOpenStrategySection: () => void
  selectedBacktest: BacktestRun | null
  onSelectBacktestId: (backtestId: string) => void
}

export default function BacktestWorkspaceHeader({
  selectedStrategy,
  strategies,
  backtestFilter,
  onSelectBacktestFilter,
  backtestsForWorkspace,
  latestWorkspaceBacktest,
  latestWorkspaceBacktestDecisionMeta,
  latestWorkspaceBacktestWindowMeta,
  latestWorkspaceBacktestSampleMeta,
  openStrategyProposalsCount,
  backtestTimeframeDraft,
  onSelectBacktestTimeframeDraft,
  backtestTimeframeOptions,
  backtestRangeDraft,
  onSelectBacktestRangeDraft,
  backtestRangeOptions,
  onSelectStrategyId,
  serviceAvailable,
  backtestMutationPending,
  onSubmitBacktest,
  onOpenStrategySection,
  selectedBacktest,
  onSelectBacktestId,
}: BacktestWorkspaceHeaderProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <span className="section-label">回测工作台</span>
          <h3>按策略研究、筛选和比较回测</h3>
        </div>
        <div className="chip-row">
          <span className="chip chip--muted">{backtestFilter === 'selected' ? '仅当前策略' : '全策略'}</span>
          <span className="chip chip--muted">{selectedStrategy?.name ?? '等待策略'}</span>
          {selectedBacktest?.benchmark_stats ? (
            <>
              <span
                className={
                  selectedBacktest.benchmark_stats.strategy_over_buy_hold_pct > 0
                    ? 'chip chip--success'
                    : selectedBacktest.benchmark_stats.strategy_over_buy_hold_pct < 0
                      ? 'chip chip--warning'
                      : 'chip'
                }
              >
                超额 {selectedBacktest.benchmark_stats.strategy_over_buy_hold_pct.toFixed(2)}%
              </span>
              <span
                className={
                  selectedBacktest.benchmark_stats.alpha_pct > 0
                    ? 'chip chip--success'
                    : selectedBacktest.benchmark_stats.alpha_pct < 0
                      ? 'chip chip--warning'
                      : 'chip'
                }
              >
                Alpha {selectedBacktest.benchmark_stats.alpha_pct.toFixed(2)}%
              </span>
              <span className="chip">
                相关性 {selectedBacktest.benchmark_stats.correlation.toFixed(2)}
              </span>
            </>
          ) : null}
          {selectedBacktest?.tail_risk_stats ? (
            <>
              <span
                className={
                  selectedBacktest.tail_risk_stats.var_95_pct >= 5
                    ? 'chip chip--warning'
                    : 'chip'
                }
              >
                VaR95 {selectedBacktest.tail_risk_stats.var_95_pct.toFixed(2)}%
              </span>
              <span
                className={
                  selectedBacktest.tail_risk_stats.gain_to_pain_ratio >= 1
                    ? 'chip chip--success'
                    : selectedBacktest.tail_risk_stats.gain_to_pain_ratio > 0
                      ? 'chip'
                      : 'chip chip--warning'
                }
              >
                痛苦比 {selectedBacktest.tail_risk_stats.gain_to_pain_ratio.toFixed(2)}
              </span>
            </>
          ) : null}
          {selectedBacktest?.order_flow_stats ? (
            <>
              <span className="chip chip--muted">
                日频 {selectedBacktest.order_flow_stats.trade_frequency_per_day.toFixed(2)}
              </span>
              <span
                className={
                  selectedBacktest.order_flow_stats.active_bar_ratio_pct >= 80
                    ? 'chip chip--warning'
                    : selectedBacktest.order_flow_stats.active_bar_ratio_pct >= 20
                      ? 'chip'
                      : 'chip chip--muted'
                }
              >
                在场 {selectedBacktest.order_flow_stats.active_bar_ratio_pct.toFixed(1)}%
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="console-strip console-strip--compact backtest-summary-strip">
        <div>
          <span>当前策略</span>
          <strong>{selectedStrategy?.name ?? '--'}</strong>
        </div>
        <div>
          <span>记录数</span>
          <strong>{backtestsForWorkspace.length} 组</strong>
        </div>
        <div>
          <span>最近结果</span>
          <strong>{latestWorkspaceBacktest?.metrics.annual_return ?? '--'}</strong>
          <small>
            {latestWorkspaceBacktestDecisionMeta && latestWorkspaceBacktestDecisionMeta.label !== '可继续判断'
              ? latestWorkspaceBacktestDecisionMeta.description
              : latestWorkspaceBacktestWindowMeta?.attention
                ? latestWorkspaceBacktestWindowMeta.description
                : latestWorkspaceBacktestSampleMeta?.description ?? '等待回测结果'}
          </small>
        </div>
        <div>
          <span>AI 提案</span>
          <strong>{openStrategyProposalsCount} 条</strong>
        </div>
      </div>
      <div className="field-grid backtest-field-grid">
        <label className="field">
          <span>策略</span>
          <select value={selectedStrategy?.id ?? ''} onChange={(event) => onSelectStrategyId(event.target.value)}>
            {strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>时间周期</span>
          <select value={backtestTimeframeDraft} onChange={(event) => onSelectBacktestTimeframeDraft(event.target.value)}>
            {backtestTimeframeOptions.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>区间</span>
          <select value={backtestRangeDraft} onChange={(event) => onSelectBacktestRangeDraft(event.target.value)}>
            {backtestRangeOptions.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>结果视图</span>
          <select
            value={backtestFilter}
            onChange={(event) => onSelectBacktestFilter(event.target.value as 'selected' | 'all')}
          >
            <option value="selected">仅当前策略</option>
            <option value="all">全部策略</option>
          </select>
        </label>
      </div>
      <div className="hero-actions">
        <button
          type="button"
          className="primary-button"
          disabled={!serviceAvailable || backtestMutationPending || !selectedStrategy}
          onClick={onSubmitBacktest}
        >
          发起回测
        </button>
        <button type="button" className="ghost-button" onClick={onOpenStrategySection}>
          返回策略页
        </button>
      </div>
      <div className="terminal-block__head terminal-block__head--compact backtest-list-head">
        <div>
          <span className="section-label">结果列表</span>
          <h3>终端式回测时间线</h3>
        </div>
      </div>
      <div className="job-list">
        {backtestsForWorkspace.map((item, index) => {
          const sampleMeta = backtestSampleQualityMeta(item)
          const windowMetaItem = backtestWindowMeta(item)
          return (
            <button
              key={item.id}
              type="button"
              className={`job-row job-row--selectable job-row--fade ${selectedBacktest?.id === item.id ? 'job-row--active' : ''}`}
              style={{ animationDelay: `${index * 28}ms` }}
              onClick={() => onSelectBacktestId(item.id)}
            >
              <div className="console-row__main">
                <strong>{item.strategy_name}</strong>
                <p>
                  {item.data_range} · {item.timeframe} · {item.metrics.annual_return}
                  {windowMetaItem?.attention ? ` · ${windowMetaItem.description}` : ''}
                </p>
              </div>
              <div className="job-meta">
                {sampleMeta && item.sample_quality !== 'sufficient' && (
                  <span className={sampleMeta.chipClass}>{sampleMeta.label}</span>
                )}
                {windowMetaItem?.attention && <span className={windowMetaItem.chipClass}>{windowMetaItem.label}</span>}
                <span className="console-tag">{item.status}</span>
                <small>{formatTime(item.finished_at ?? item.started_at)}</small>
              </div>
            </button>
          )
        })}
        {backtestsForWorkspace.length === 0 && (
          <div className="empty-state empty-state--inline">当前筛选条件下还没有回测记录</div>
        )}
      </div>
    </article>
  )
}
