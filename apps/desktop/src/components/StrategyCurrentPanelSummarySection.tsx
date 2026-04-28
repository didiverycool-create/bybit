import type { ExecutionPreview, Mode, StrategyRuntimeSnapshot, StrategySummary } from '../types'
import {
  formatStrategySizingSummary,
  positionSideLabel,
  strategyRuntimeSignalLabel,
  strategyRuntimeSignalToneClass,
  strategyStatusLabel,
} from '../utils/app-helpers'
import type { BacktestDecisionMeta, BacktestSampleMeta, BacktestWindowMeta } from './strategyCurrentPanelTypes'

export type StrategyCurrentPanelSummarySectionProps = {
  selectedStrategy: StrategySummary
  latestStrategyBacktestAnnualReturn?: string | null
  latestStrategyBacktestDecisionMeta: BacktestDecisionMeta
  latestStrategyBacktestWindowMeta: BacktestWindowMeta
  latestStrategyBacktestSampleMeta: BacktestSampleMeta
  openStrategyProposalsCount: number
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  selectedStrategyRuntimePreview: ExecutionPreview | null
  selectedMode: Mode
}

function resolveLatestBacktestDescription(
  latestStrategyBacktestDecisionMeta: BacktestDecisionMeta,
  latestStrategyBacktestWindowMeta: BacktestWindowMeta,
  latestStrategyBacktestSampleMeta: BacktestSampleMeta,
) {
  return latestStrategyBacktestDecisionMeta && latestStrategyBacktestDecisionMeta.label !== '可继续判断'
    ? latestStrategyBacktestDecisionMeta.description
    : latestStrategyBacktestWindowMeta?.attention
      ? latestStrategyBacktestWindowMeta.description
      : latestStrategyBacktestSampleMeta?.description ?? '等待回测结果'
}

export default function StrategyCurrentPanelSummarySection({
  selectedStrategy,
  latestStrategyBacktestAnnualReturn,
  latestStrategyBacktestDecisionMeta,
  latestStrategyBacktestWindowMeta,
  latestStrategyBacktestSampleMeta,
  openStrategyProposalsCount,
  selectedStrategyRuntime,
  selectedStrategyRuntimePreview,
  selectedMode,
}: StrategyCurrentPanelSummarySectionProps) {
  return (
    <>
      <div className="panel-head">
        <div>
          <span className="section-label">当前策略</span>
          <h3>{selectedStrategy.name}</h3>
        </div>
        <div className="chip-row">
          <span className="chip chip--success">{strategyStatusLabel(selectedStrategy.status)}</span>
        </div>
      </div>
      <div className="terminal-summary-strip terminal-summary-strip--compact strategy-summary-strip">
        <div className="terminal-summary-strip__item">
          <span>类型</span>
          <strong>{selectedStrategy.category === 'template' ? '模板策略' : 'Python 策略'}</strong>
        </div>
        <div className="terminal-summary-strip__item">
          <span>版本 / 模式</span>
          <strong>
            {selectedStrategy.version} · {selectedStrategy.mode.toUpperCase()}
          </strong>
        </div>
        <div className="terminal-summary-strip__item">
          <span>7 日收益</span>
          <strong>{selectedStrategy.pnl_7d}</strong>
        </div>
        <div className="terminal-summary-strip__item">
          <span>最大回撤</span>
          <strong>{selectedStrategy.max_drawdown}</strong>
        </div>
        <div className="terminal-summary-strip__item">
          <span>最新回测</span>
          <strong>{latestStrategyBacktestAnnualReturn ?? '--'}</strong>
          <small>{resolveLatestBacktestDescription(latestStrategyBacktestDecisionMeta, latestStrategyBacktestWindowMeta, latestStrategyBacktestSampleMeta)}</small>
        </div>
        <div className="terminal-summary-strip__item">
          <span>待处理提案</span>
          <strong>{openStrategyProposalsCount} 条</strong>
        </div>
        <div className="terminal-summary-strip__item" title={selectedStrategyRuntime?.note ?? '等待运行态刷新'}>
          <span>运行信号</span>
          <strong className={selectedStrategyRuntime ? strategyRuntimeSignalToneClass(selectedStrategyRuntime.signal) : ''}>
            {selectedStrategyRuntime ? strategyRuntimeSignalLabel(selectedStrategyRuntime.signal) : '--'}
          </strong>
        </div>
        <div className="terminal-summary-strip__item" title={selectedStrategyRuntime?.next_action ?? '等待运行态刷新'}>
          <span>运行置信度</span>
          <strong>{selectedStrategyRuntime ? `${selectedStrategyRuntime.confidence.toFixed(1)}%` : '--'}</strong>
        </div>
      </div>
      {selectedStrategyRuntimePreview && (
        <div
          className={`terminal-summary-strip terminal-summary-strip--compact strategy-execution-strip ${
            selectedStrategyRuntimePreview.allowed === false ? 'strategy-execution-strip--blocked' : ''
          }`}
          title={
            selectedStrategyRuntimePreview.recommended_action
              ? `${selectedStrategyRuntimePreview.blocked_reason ?? selectedStrategyRuntimePreview.warnings?.[0] ?? selectedStrategyRuntimePreview.action ?? '等待执行预估'} 建议 ${selectedStrategyRuntimePreview.recommended_action}`
              : selectedStrategyRuntimePreview.blocked_reason ??
                selectedStrategyRuntimePreview.warnings?.[0] ??
                selectedStrategyRuntimePreview.action ??
                '等待执行预估'
          }
        >
          <div className="terminal-summary-strip__item">
            <span>执行预估</span>
            <strong
              className={
                selectedStrategyRuntimePreview.allowed === false
                  ? 'negative'
                  : selectedStrategyRuntimePreview.action
                    ? 'positive'
                    : ''
              }
            >
              {selectedStrategyRuntimePreview.action ?? '--'}
            </strong>
            <small>
              {selectedStrategyRuntimePreview.blocked_reason ??
                selectedStrategyRuntimePreview.warnings?.[0] ??
                `由策略运行态和当前${selectedMode === 'paper' ? '纸面' : selectedMode.toUpperCase()}执行链路共同给出`}
            </small>
            {selectedStrategyRuntimePreview.recommended_action && (
              <small>建议 {selectedStrategyRuntimePreview.recommended_action}</small>
            )}
          </div>
          <div className="terminal-summary-strip__item">
            <span>仓位影响</span>
            <strong>
              {selectedStrategyRuntimePreview.current_position_side &&
              selectedStrategyRuntimePreview.projected_position_side
                ? `${positionSideLabel(selectedStrategyRuntimePreview.current_position_side)} → ${positionSideLabel(selectedStrategyRuntimePreview.projected_position_side)}`
                : selectedStrategyRuntimePreview.current_position_side
                  ? positionSideLabel(selectedStrategyRuntimePreview.current_position_side)
                  : '--'}
            </strong>
            <small>
              {selectedStrategyRuntimePreview.current_position_size &&
              selectedStrategyRuntimePreview.projected_position_size
                ? `${selectedStrategyRuntimePreview.current_position_size} → ${selectedStrategyRuntimePreview.projected_position_size}`
                : selectedStrategyRuntimePreview.current_position_size
                  ? `当前 ${selectedStrategyRuntimePreview.current_position_size}`
                  : '等待后端返回执行预估'}
            </small>
          </div>
          <div className="terminal-summary-strip__item">
            <span>余额 / 盈亏</span>
            <strong>
              {selectedStrategyRuntimePreview.available_balance_before &&
              selectedStrategyRuntimePreview.available_balance_after
                ? `${selectedStrategyRuntimePreview.available_balance_before} → ${selectedStrategyRuntimePreview.available_balance_after}`
                : '--'}
            </strong>
            <small>
              {formatStrategySizingSummary(selectedStrategyRuntimePreview) ??
                selectedStrategyRuntimePreview.estimated_realized_pnl ??
                `预估已实现盈亏会在${selectedMode === 'paper' ? '执行预检' : `${selectedMode.toUpperCase()} 预检`}可用时显示`}
            </small>
          </div>
        </div>
      )}
    </>
  )
}
