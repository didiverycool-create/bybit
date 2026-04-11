import type { StrategySummary } from '../types'
import { strategyStatusLabel } from '../utils/app-helpers'
import StrategyCurrentPanel, { type StrategyCurrentPanelProps } from './StrategyCurrentPanel'

type StrategyWorkspaceSectionProps = {
  activeSectionKey: string
  strategies: StrategySummary[]
  selectedStrategy: StrategySummary | null
  onSelectStrategyId: (strategyId: string) => void
  currentPanelProps: StrategyCurrentPanelProps | null
}

export default function StrategyWorkspaceSection({
  activeSectionKey,
  strategies,
  selectedStrategy,
  onSelectStrategyId,
  currentPanelProps,
}: StrategyWorkspaceSectionProps) {
  return (
    <section key={activeSectionKey} className="section-grid section-grid--strategy section-entrance">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">策略管理</span>
            <h3>模板策略与 Python 策略</h3>
          </div>
          <span className="chip chip--muted">规则策略 + AI 调参</span>
        </div>
        <div className="strategy-list">
          {strategies.map((strategy, index) => (
            <button
              key={strategy.id}
              type="button"
              className={`strategy-item strategy-item--fade ${selectedStrategy?.id === strategy.id ? 'active' : ''}`}
              style={{ animationDelay: `${index * 40}ms` }}
              onClick={() => onSelectStrategyId(strategy.id)}
            >
              <div>
                <strong>{strategy.name}</strong>
                <p>{strategy.description}</p>
              </div>
              <div className="strategy-kpis">
                <span
                  className={`status-chip ${
                    strategy.status === 'running'
                      ? 'status-running'
                      : strategy.status === 'paper_only'
                        ? 'status-applied'
                        : 'status-failed'
                  }`}
                >
                  {strategyStatusLabel(strategy.status)}
                </span>
                <small>
                  {strategy.pnl_7d} / {strategy.max_drawdown}
                </small>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="panel">
        {currentPanelProps ? <StrategyCurrentPanel {...currentPanelProps} /> : <div className="empty-state">暂无策略数据</div>}
      </article>
    </section>
  )
}
