import type { ReactNode } from 'react'
import { AlertTriangle, Bot } from 'lucide-react'

import type { OpenClawStatus, SchedulerCommandType, SchedulerState } from '../../types'
import { formatTime, schedulerLabel } from '../../utils/app-helpers'

type SchedulerCommandBanner = {
  tone: 'warning' | 'success'
  commandLabel: string
  summary: string
  impactDetail?: string | null
  occurredAt: string
  actions: ReactNode
} | null

type SchedulerWorkspaceOverviewPanelProps = {
  schedulerState?: SchedulerState | null
  serviceAvailable: boolean
  schedulerMutationPending: boolean
  openClawStatus?: OpenClawStatus | null
  latestSchedulerCommandBanner: SchedulerCommandBanner
  onRunSchedulerCommand: (command: SchedulerCommandType, reason: string, jobId?: string) => void
  onOpenSchedulerControls: () => void
  onOpenGrafanaPreview: () => void
}

export default function SchedulerWorkspaceOverviewPanel({
  schedulerState,
  serviceAvailable,
  schedulerMutationPending,
  openClawStatus,
  latestSchedulerCommandBanner,
  onRunSchedulerCommand,
  onOpenSchedulerControls,
  onOpenGrafanaPreview,
}: SchedulerWorkspaceOverviewPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <span className="section-label">AI 调度</span>
          <h3>OpenClaw 编排与硬中断</h3>
        </div>
        <span className={`chip ${schedulerState?.status === 'manual_override' ? 'chip--warning' : 'chip--success'}`}>
          {schedulerLabel(schedulerState?.status ?? 'degraded')}
        </span>
      </div>
      <div className="hero-actions">
        <button
          type="button"
          className="primary-button"
          disabled={!serviceAvailable || schedulerMutationPending}
          onClick={() =>
            onRunSchedulerCommand(
              schedulerState?.status === 'paused' ? 'resume' : 'pause',
              schedulerState?.status === 'paused' ? '桌面端恢复 AI 调度' : '桌面端暂停 AI 调度',
            )
          }
        >
          {schedulerState?.status === 'paused' ? '恢复调度' : '暂停调度'}
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!serviceAvailable || schedulerMutationPending}
          onClick={() => onRunSchedulerCommand('cancel_job', '桌面端终止当前任务', schedulerState?.current_job_id ?? undefined)}
        >
          终止当前任务
        </button>
        <button type="button" className="ghost-button" onClick={onOpenSchedulerControls}>
          更多控制
        </button>
        <button type="button" className="ghost-button" onClick={onOpenGrafanaPreview}>
          监控预览
        </button>
      </div>
      {(schedulerState?.freeze_publish || schedulerState?.status === 'manual_override') && (
        <div className="service-banner service-banner--warning service-banner--inline">
          <AlertTriangle size={16} />
          <div>
            <strong>发布门禁已开启</strong>
            <p>
              {schedulerState?.status === 'manual_override'
                ? '当前处于人工接管状态，发布建议不会自动落地。'
                : '当前已冻结自动发布，发布建议需要先解除冻结后才能接受。'}
            </p>
          </div>
        </div>
      )}
      {latestSchedulerCommandBanner && (
        <div
          className={`service-banner service-banner--${latestSchedulerCommandBanner.tone === 'warning' ? 'warning' : 'success'} service-banner--inline`}
        >
          <Bot size={16} />
          <div>
            <strong>最近调度动作 · {latestSchedulerCommandBanner.commandLabel}</strong>
            <p>{latestSchedulerCommandBanner.summary}</p>
            {latestSchedulerCommandBanner.impactDetail && <p>{latestSchedulerCommandBanner.impactDetail}</p>}
            <p>发生于 {latestSchedulerCommandBanner.occurredAt}</p>
            {latestSchedulerCommandBanner.actions}
          </div>
        </div>
      )}
      <div className="terminal-summary-strip terminal-summary-strip--compact scheduler-summary-strip">
        <div className="terminal-summary-strip__item">
          <span>当前模式</span>
          <strong>{schedulerState?.current_mode?.toUpperCase()}</strong>
        </div>
        <div className="terminal-summary-strip__item">
          <span>OpenClaw</span>
          <strong>{openClawStatus?.reachable ? '已连通' : '待接通'}</strong>
        </div>
        <div className="terminal-summary-strip__item">
          <span>心跳</span>
          <strong>{formatTime(schedulerState?.last_heartbeat_at)}</strong>
        </div>
        <div className="terminal-summary-strip__item">
          <span>发布门禁</span>
          <strong>
            {schedulerState?.status === 'manual_override'
              ? '人工接管'
              : schedulerState?.freeze_publish
                ? '已冻结'
                : '开放'}
          </strong>
        </div>
      </div>
      {(!openClawStatus?.reachable || schedulerState?.status === 'degraded') &&
        (openClawStatus?.status_output || openClawStatus?.health_output) && (
          <div className="api-panel api-panel--bottom">
            <span className="section-label">OpenClaw 运行状态</span>
            <p>{openClawStatus.status_output ?? openClawStatus.health_output}</p>
          </div>
        )}
    </article>
  )
}
