import { Activity, Bell, Bot, CandlestickChart, Save, ShieldAlert } from 'lucide-react'

import type { WorkspaceStatusHeadlineAlert } from './buildWorkspaceStatusDerivedState'

type BuildWorkspaceStatusInspectorCardsArgs = {
  schedulerNeedsAttention: boolean
  selectedMode: string
  schedulerStatus: string
  schedulerQueueDepth: number
  schedulerFreezePublish: boolean
  serviceAvailable: boolean
  openClawReachable: boolean
  openClawGatewayUrl: string
  workspaceDirty: boolean
  workspaceSavedAt?: string | null
  workspaceUpdatedAt?: string | null
  pendingAlertsCount: number
  headlineAlert: WorkspaceStatusHeadlineAlert | null
  formatTime: (value?: string | null) => string
  schedulerLabel: (status: string) => string
}

export function buildWorkspaceStatusInspectorCards({
  schedulerNeedsAttention,
  selectedMode,
  schedulerStatus,
  schedulerQueueDepth,
  schedulerFreezePublish,
  serviceAvailable,
  openClawReachable,
  openClawGatewayUrl,
  workspaceDirty,
  workspaceSavedAt,
  workspaceUpdatedAt,
  pendingAlertsCount,
  headlineAlert,
  formatTime,
  schedulerLabel,
}: BuildWorkspaceStatusInspectorCardsArgs) {
  return [
    {
      key: 'scheduler',
      icon: Bot,
      label: 'AI 调度',
      value: `${schedulerLabel(schedulerStatus)} · 队列 ${schedulerQueueDepth}`,
      detail: schedulerFreezePublish ? '自动发布已冻结' : '自动发布开放',
      tone: schedulerNeedsAttention ? 'warn' : 'good',
    },
    {
      key: 'mode',
      icon: CandlestickChart,
      label: '当前模式',
      value: selectedMode.toUpperCase(),
      detail: 'Paper / Demo / Live 三路径隔离',
      tone: 'muted',
    },
    {
      key: 'service',
      icon: Activity,
      label: '本地服务',
      value: serviceAvailable ? '在线' : '回退中',
      detail: serviceAvailable ? '当前正在读取真实服务数据' : '当前展示 fallback 数据',
      tone: serviceAvailable ? 'good' : 'warn',
    },
    {
      key: 'claw',
      icon: ShieldAlert,
      label: 'OpenClaw',
      value: openClawReachable ? '已连通' : '待接通',
      detail: openClawGatewayUrl,
      tone: openClawReachable ? 'good' : 'muted',
    },
    {
      key: 'workspace',
      icon: Save,
      label: '工作台同步',
      value: workspaceDirty ? '有未同步草稿' : '已同步',
      detail: workspaceDirty
        ? '当前本地布局和控制端保存状态不同'
        : `上次保存 ${formatTime(workspaceSavedAt ?? workspaceUpdatedAt)}`,
      tone: workspaceDirty ? 'warn' : 'muted',
    },
    {
      key: 'alerts',
      icon: Bell,
      label: '提醒中心',
      value: pendingAlertsCount ? `${pendingAlertsCount} 条待处理` : '暂无待处理',
      detail: headlineAlert ? `${headlineAlert.severity} · ${headlineAlert.symbol}` : '无最高优先级提醒',
      tone: pendingAlertsCount ? 'warn' : 'good',
    },
  ] as const
}
