import StrategyExecutionContextSection, {
  type StrategyExecutionContextSectionProps,
} from './StrategyExecutionContextSection'

import type { ExecutionPreview, Mode, ReviewDocument, StrategyRuntimeSnapshot, StrategySummary } from '../types'
import {
  formatStrategySizingSummary,
  positionSideLabel,
  strategyCurrentPositionLabel,
  strategyPositionAlignmentLabel,
  strategyRuntimeGuardLabel,
  strategyRuntimeSignalLabel,
  strategyRuntimeSignalToneClass,
  strategyStatusLabel,
} from '../utils/app-helpers'

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

type ReviewLineageMeta = {
  label: string
  detail: string
} | null

export type StrategyCurrentPanelProps = {
  selectedStrategy: StrategySummary
  latestStrategyBacktestAnnualReturn?: string | null
  latestStrategyBacktestDecisionMeta: BacktestDecisionMeta
  latestStrategyBacktestWindowMeta: BacktestWindowMeta
  latestStrategyBacktestSampleMeta: BacktestSampleMeta
  openStrategyProposalsCount: number
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  selectedStrategyRuntimePreview: ExecutionPreview | null
  selectedMode: Mode
  serviceAvailable: boolean
  executeStrategySignalPending: boolean
  strategyTrackingPending: boolean
  restartRuntimeWorkerPending: boolean
  backtestMutationPending: boolean
  changeRequestMutationPending: boolean
  selectedStrategyNeedsRuntimeRecovery: boolean
  runtimeWorkerRestoreHint: string
  hasParameterDraftChanges: boolean
  parameterDraftChangeCount: number
  riskBudgetChanged: boolean
  selectedStrategyReview: ReviewDocument | null
  selectedStrategyReviewDecisionMeta: BacktestDecisionMeta
  selectedStrategyReviewLineageMeta: ReviewLineageMeta
  executionContextProps: StrategyExecutionContextSectionProps
  onOpenStrategyEditor: (strategyId?: string | null) => void
  onExecuteSelectedStrategySignal: () => void
  onOpenStrategyActivityPanel: () => void
  onOpenStrategyTrackingPanel: (kind?: 'issue' | 'change') => void
  onRestartStrategyRuntimeWorker: () => void | Promise<void>
  onSubmitBacktest: () => void | Promise<void>
  onToggleStrategyStatus: () => void | Promise<void>
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void | Promise<void>
}

export default function StrategyCurrentPanel({
  selectedStrategy,
  latestStrategyBacktestAnnualReturn,
  latestStrategyBacktestDecisionMeta,
  latestStrategyBacktestWindowMeta,
  latestStrategyBacktestSampleMeta,
  openStrategyProposalsCount,
  selectedStrategyRuntime,
  selectedStrategyRuntimePreview,
  selectedMode,
  serviceAvailable,
  executeStrategySignalPending,
  strategyTrackingPending,
  restartRuntimeWorkerPending,
  backtestMutationPending,
  changeRequestMutationPending,
  selectedStrategyNeedsRuntimeRecovery,
  runtimeWorkerRestoreHint,
  hasParameterDraftChanges,
  parameterDraftChangeCount,
  riskBudgetChanged,
  selectedStrategyReview,
  selectedStrategyReviewDecisionMeta,
  selectedStrategyReviewLineageMeta,
  executionContextProps,
  onOpenStrategyEditor,
  onExecuteSelectedStrategySignal,
  onOpenStrategyActivityPanel,
  onOpenStrategyTrackingPanel,
  onRestartStrategyRuntimeWorker,
  onSubmitBacktest,
  onToggleStrategyStatus,
  onOpenReplayReview,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onRerunBacktestFromReview,
}: StrategyCurrentPanelProps) {
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
          <small>
            {latestStrategyBacktestDecisionMeta && latestStrategyBacktestDecisionMeta.label !== '可继续判断'
              ? latestStrategyBacktestDecisionMeta.description
              : latestStrategyBacktestWindowMeta?.attention
                ? latestStrategyBacktestWindowMeta.description
                : latestStrategyBacktestSampleMeta?.description ?? '等待回测结果'}
          </small>
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

      <div className="hero-actions">
        <button type="button" className="primary-button" onClick={() => onOpenStrategyEditor(selectedStrategy.id)}>
          编辑参数 / 风控
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={
            !serviceAvailable ||
            executeStrategySignalPending ||
            !selectedStrategyRuntimePreview ||
            !selectedStrategyRuntimePreview.allowed
          }
          title={
            !selectedStrategyRuntimePreview
              ? '等待策略运行态返回执行预估'
              : !selectedStrategyRuntimePreview.allowed
                ? selectedStrategyRuntimePreview.recommended_action
                  ? `${selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过'} 建议 ${selectedStrategyRuntimePreview.recommended_action}`
                  : selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过'
                : selectedMode === 'paper'
                  ? '按当前策略信号写入一笔 Paper 执行'
                  : '按当前策略信号向 Bybit 提交真实委托'
          }
          onClick={onExecuteSelectedStrategySignal}
        >
          {selectedMode === 'paper' ? '执行当前信号' : '提交真实委托'}
        </button>
        <button
          type="button"
          className="ghost-button"
          data-open-strategy-activity="1"
          onClick={onOpenStrategyActivityPanel}
        >
          最近活动
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!serviceAvailable || strategyTrackingPending}
          onClick={() => onOpenStrategyTrackingPanel('issue')}
        >
          发起跟踪
        </button>
        {selectedStrategyNeedsRuntimeRecovery && (
          <button
            type="button"
            className="ghost-button"
            disabled={!serviceAvailable || restartRuntimeWorkerPending}
            title={runtimeWorkerRestoreHint}
            onClick={() => {
              void onRestartStrategyRuntimeWorker()
            }}
          >
            恢复运行线程
          </button>
        )}
        <button
          type="button"
          className="ghost-button"
          disabled={!serviceAvailable || backtestMutationPending}
          onClick={() => {
            void onSubmitBacktest()
          }}
        >
          发起回测
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!serviceAvailable || changeRequestMutationPending}
          onClick={() => {
            void onToggleStrategyStatus()
          }}
        >
          启停策略
        </button>
      </div>

      {(hasParameterDraftChanges || riskBudgetChanged) && (
        <p className="panel-note">
          当前有未提交修改: 参数 {parameterDraftChangeCount} 项，风险预算 {riskBudgetChanged ? '已修改' : '未修改'}。
        </p>
      )}

      {selectedStrategyRuntime && (
        <p className="panel-note">
          运行态:{' '}
          {strategyRuntimeGuardLabel(selectedStrategyRuntime)
            ? `${strategyRuntimeGuardLabel(selectedStrategyRuntime)} · ${selectedStrategyRuntime.note}`
            : selectedStrategyRuntime.note}{' '}
          · 仓位 {strategyPositionAlignmentLabel(selectedStrategyRuntime)}
          {selectedStrategyRuntime.position_alignment_detail
            ? ` (${selectedStrategyRuntime.position_alignment_detail})`
            : ''}
          {strategyCurrentPositionLabel(selectedStrategyRuntime)
            ? ` · ${strategyCurrentPositionLabel(selectedStrategyRuntime)}`
            : ''}
          {' '}
          下一步 {selectedStrategyRuntime.next_action}
          {selectedStrategyRuntime.active_order
            ? ` · 关联委托 ${selectedStrategyRuntime.active_order.side === 'buy' ? '买入' : '卖出'} ${selectedStrategyRuntime.active_order.qty}@${selectedStrategyRuntime.active_order.price} (${selectedStrategyRuntime.active_order.status})`
            : selectedStrategyRuntime.active_order_count > 0
              ? ` · 当前关联委托 ${selectedStrategyRuntime.active_order_count} 笔`
              : ''}
        </p>
      )}

      {selectedStrategyReview && (
        <>
          <p className="panel-note">
            最近 AI 复盘: {selectedStrategyReview.summary}
            {selectedStrategyReviewDecisionMeta ? ` · 结论门禁 ${selectedStrategyReviewDecisionMeta.description}` : ''}
            {selectedStrategyReviewLineageMeta ? ` · ${selectedStrategyReviewLineageMeta.detail}` : ''}
          </p>
          <div className="inline-actions inline-actions--tight">
            <button
              type="button"
              className="micro-action"
              onClick={() => onOpenReplayReview(selectedStrategyReview.id, selectedStrategy.id, 'selected')}
            >
              打开复盘
            </button>
            {selectedStrategyReview.source_change_request_id && (
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenChangeRequest(selectedStrategyReview.source_change_request_id, selectedStrategy.id)}
              >
                来源变更
              </button>
            )}
            {selectedStrategyReview.source_backtest_id && (
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenBacktestDetail(selectedStrategyReview.source_backtest_id, selectedStrategy.id)}
              >
                来源回测
              </button>
            )}
            {selectedStrategyReview.source_review_id && (
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenSourceReview(selectedStrategyReview.source_review_id, selectedStrategy.id)}
              >
                来源复盘
              </button>
            )}
            {selectedStrategyReview.source_proposal_id && (
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenStrategyProposal(selectedStrategyReview.source_proposal_id, selectedStrategy.id)}
              >
                来源提案
              </button>
            )}
            {selectedStrategyReviewDecisionMeta?.recommendedRange &&
              selectedStrategyReviewDecisionMeta?.recommendedTimeframe && (
                <button
                  type="button"
                  className="micro-action"
                  disabled={!serviceAvailable || backtestMutationPending}
                  onClick={() => {
                    void onRerunBacktestFromReview(selectedStrategyReview)
                  }}
                >
                  按建议重跑
                </button>
              )}
          </div>
        </>
      )}

      <StrategyExecutionContextSection {...executionContextProps} />
    </>
  )
}
