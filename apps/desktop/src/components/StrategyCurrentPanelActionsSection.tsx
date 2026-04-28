import type { Mode } from '../types'

export type StrategyCurrentPanelActionsSectionProps = {
  serviceAvailable: boolean
  executeStrategySignalPending: boolean
  strategyTrackingPending: boolean
  restartRuntimeWorkerPending: boolean
  backtestMutationPending: boolean
  changeRequestMutationPending: boolean
  selectedStrategyNeedsRuntimeRecovery: boolean
  runtimeWorkerRestoreHint: string
  selectedMode: Mode
  selectedStrategyRuntimePreviewAllowed: boolean | null | undefined
  onOpenStrategyEditor: () => void
  onExecuteSelectedStrategySignal: () => void
  onOpenStrategyActivityPanel: () => void
  onOpenStrategyTrackingPanel: (kind?: 'issue' | 'change') => void
  onRestartStrategyRuntimeWorker: () => void | Promise<void>
  onSubmitBacktest: () => void | Promise<void>
  onToggleStrategyStatus: () => void | Promise<void>
}

export default function StrategyCurrentPanelActionsSection({
  serviceAvailable,
  executeStrategySignalPending,
  strategyTrackingPending,
  restartRuntimeWorkerPending,
  backtestMutationPending,
  changeRequestMutationPending,
  selectedStrategyNeedsRuntimeRecovery,
  runtimeWorkerRestoreHint,
  selectedMode,
  selectedStrategyRuntimePreviewAllowed,
  onOpenStrategyEditor,
  onExecuteSelectedStrategySignal,
  onOpenStrategyActivityPanel,
  onOpenStrategyTrackingPanel,
  onRestartStrategyRuntimeWorker,
  onSubmitBacktest,
  onToggleStrategyStatus,
}: StrategyCurrentPanelActionsSectionProps) {
  return (
    <div className="hero-actions">
      <button type="button" className="primary-button" onClick={onOpenStrategyEditor}>
        编辑参数 / 风控
      </button>
      <button
        type="button"
        className="ghost-button"
        disabled={!serviceAvailable || executeStrategySignalPending || !selectedStrategyRuntimePreviewAllowed}
        title={
          !selectedStrategyRuntimePreviewAllowed
            ? '等待策略运行态返回执行预估'
            : selectedMode === 'paper'
              ? '按当前策略信号写入一笔 Paper 执行'
              : '按当前策略信号向 Bybit 提交真实委托'
        }
        onClick={onExecuteSelectedStrategySignal}
      >
        {selectedMode === 'paper' ? '执行当前信号' : '提交真实委托'}
      </button>
      <button type="button" className="ghost-button" data-open-strategy-activity="1" onClick={onOpenStrategyActivityPanel}>
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
  )
}
