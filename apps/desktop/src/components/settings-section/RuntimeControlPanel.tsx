import type {
  ExecutionHealthSummary,
  LayoutPreset,
  Mode,
  RuntimeWorkerStatus,
  SchedulerCommandType,
} from '../../types'
import {
  runtimeWorkerStatusDetail,
  runtimeWorkerStatusLabel,
  runtimeWorkerStatusTooltip,
} from '../../utils/app-helpers'

export type RuntimeControlPanelProps = {
  workspaceDirty: boolean
  selectedMode: Mode
  onSelectMode: (mode: Mode) => void
  layoutPreset: LayoutPreset
  onSelectLayoutPreset: (layout: LayoutPreset) => void
  serviceAvailable: boolean
  schedulerMutationPending: boolean
  currentSchedulerJobId?: string | null
  schedulerFreezePublish?: boolean
  onRunSchedulerCommand: (command: SchedulerCommandType, reason: string, jobId?: string) => void
  runtimeWorkerNeedsRecovery: boolean
  runtimeWorkerRestartPending: boolean
  runtimeWorkerRestoreHint: string
  onRestartRuntimeWorker: () => void
  runtimeWorkerStatus?: RuntimeWorkerStatus | null
  snapshotExecutionHealth?: ExecutionHealthSummary | null
  onTriggerDesktopNotificationTest: () => void
  workspaceMutationPending: boolean
  onSyncWorkspacePreferences: () => void
  onRestoreDefaultWorkspace: () => void
}

export default function RuntimeControlPanel({
  workspaceDirty,
  selectedMode,
  onSelectMode,
  layoutPreset,
  onSelectLayoutPreset,
  serviceAvailable,
  schedulerMutationPending,
  currentSchedulerJobId,
  schedulerFreezePublish,
  onRunSchedulerCommand,
  runtimeWorkerNeedsRecovery,
  runtimeWorkerRestartPending,
  runtimeWorkerRestoreHint,
  onRestartRuntimeWorker,
  runtimeWorkerStatus,
  snapshotExecutionHealth,
  onTriggerDesktopNotificationTest,
  workspaceMutationPending,
  onSyncWorkspacePreferences,
  onRestoreDefaultWorkspace,
}: RuntimeControlPanelProps) {
  return (
    <article className="panel" data-settings-current-panel="1">
      <div className="panel-head">
        <div>
          <span className="section-label">运行控制</span>
          <h3>模式、调度与人工接管</h3>
        </div>
        <span className={`chip ${workspaceDirty ? 'chip--warning' : 'chip--success'}`}>
          {workspaceDirty ? '有未同步改动' : '已同步'}
        </span>
      </div>
      <div className="settings-grid">
        <div className="settings-block">
          <span className="section-label">运行模式</span>
          <div className="compact-switch settings-switch">
            {(['paper', 'demo', 'live'] as Mode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={selectedMode === mode ? 'pill pill--compact active' : 'pill pill--compact'}
                onClick={() => onSelectMode(mode)}
              >
                {mode === 'paper' ? '模拟' : mode === 'demo' ? 'Demo' : '实盘'}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-block">
          <span className="section-label">首页布局</span>
          <div className="compact-switch settings-switch">
            {(['balanced', 'focus', 'dense'] as LayoutPreset[]).map((layout) => (
              <button
                key={layout}
                type="button"
                className={layoutPreset === layout ? 'pill pill--compact active' : 'pill pill--compact'}
                onClick={() => onSelectLayoutPreset(layout)}
              >
                {layout === 'balanced' ? '均衡' : layout === 'focus' ? '专注' : '紧凑'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="hero-actions">
        <button
          type="button"
          className="primary-button"
          disabled={!serviceAvailable || schedulerMutationPending}
          onClick={() => onRunSchedulerCommand('pause', '设置页暂停 AI 调度')}
        >
          暂停调度
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!serviceAvailable || schedulerMutationPending}
          onClick={() => onRunSchedulerCommand('resume', '设置页恢复 AI 调度')}
        >
          恢复调度
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!serviceAvailable || schedulerMutationPending}
          onClick={() => onRunSchedulerCommand('cancel_job', '设置页终止当前任务', currentSchedulerJobId ?? undefined)}
        >
          终止当前任务
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!serviceAvailable || schedulerMutationPending}
          onClick={() =>
            onRunSchedulerCommand(
              'freeze_publish',
              schedulerFreezePublish ? '设置页解除自动发布冻结' : '设置页冻结自动发布',
            )
          }
        >
          {schedulerFreezePublish ? '解除冻结发布' : '冻结自动发布'}
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!serviceAvailable || schedulerMutationPending}
          onClick={() => onRunSchedulerCommand('enter_manual_override', '设置页进入人工接管')}
        >
          进入人工接管
        </button>
        {runtimeWorkerNeedsRecovery && (
          <button
            type="button"
            className="ghost-button"
            disabled={!serviceAvailable || runtimeWorkerRestartPending}
            title={runtimeWorkerRestoreHint}
            onClick={onRestartRuntimeWorker}
          >
            恢复运行线程
          </button>
        )}
      </div>
      <p className="runtime-worker-note" title={runtimeWorkerStatusTooltip(runtimeWorkerStatus, snapshotExecutionHealth)}>
        <strong>{runtimeWorkerStatusLabel(runtimeWorkerStatus, snapshotExecutionHealth)}</strong>
        <span>{runtimeWorkerStatusDetail(runtimeWorkerStatus, snapshotExecutionHealth)}</span>
      </p>
      <div className="inline-actions">
        <button
          type="button"
          className="ghost-button ghost-button--inline"
          onClick={onTriggerDesktopNotificationTest}
        >
          测试通知
        </button>
        <button
          type="button"
          className="ghost-button ghost-button--inline"
          disabled={workspaceMutationPending}
          onClick={onSyncWorkspacePreferences}
        >
          同步到控制端
        </button>
        <button
          type="button"
          className="ghost-button ghost-button--inline"
          disabled={workspaceMutationPending}
          onClick={onRestoreDefaultWorkspace}
        >
          恢复首页默认
        </button>
      </div>
    </article>
  )
}
