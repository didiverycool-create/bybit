import type { ReactNode } from 'react'
import { Activity, AlertTriangle, Bell, Bot, CandlestickChart, Save, ShieldAlert } from 'lucide-react'

type ActionFeedback = {
  tone: 'success' | 'warning' | 'error'
  title: string
  detail: string
}

type HeadlineAlert = {
  id?: string | null
  severity: 'P0' | 'P1' | 'P2'
  symbol: string
  title: string
  suggested_action: string
}

type LatestSchedulerCommandMeta = {
  commandLabel: string
  summary: string
  impactDetail?: string | null
  occurredAt: string
  tone: 'warning' | 'success'
} | null

type UseWorkspaceStatusModelArgs = {
  actionFeedback: ActionFeedback | null
  headlineAlert: HeadlineAlert | null
  latestSchedulerCommand: LatestSchedulerCommandMeta
  latestSchedulerCommandActions: ReactNode
  serviceAvailable: boolean
  selectedMode: string
  schedulerStatus: string
  schedulerQueueDepth: number
  schedulerFreezePublish: boolean
  openClawReachable: boolean
  openClawGatewayUrl: string
  workspaceDirty: boolean
  workspaceConflict: boolean
  workspaceSavedAt?: string | null
  workspaceUpdatedAt?: string | null
  pendingAlertsCount: number
  applyServerWorkspace: () => void
  formatTime: (value?: string | null) => string
  schedulerLabel: (status: string) => string
}

export function useWorkspaceStatusModel({
  actionFeedback,
  headlineAlert,
  latestSchedulerCommand,
  latestSchedulerCommandActions,
  serviceAvailable,
  selectedMode,
  schedulerStatus,
  schedulerQueueDepth,
  schedulerFreezePublish,
  openClawReachable,
  openClawGatewayUrl,
  workspaceDirty,
  workspaceConflict,
  workspaceSavedAt,
  workspaceUpdatedAt,
  pendingAlertsCount,
  applyServerWorkspace,
  formatTime,
  schedulerLabel,
}: UseWorkspaceStatusModelArgs) {
  const schedulerNeedsAttention =
    ['paused', 'manual_override', 'degraded'].includes(schedulerStatus) || Boolean(schedulerFreezePublish)

  const statusInspectorHasNotice =
    !serviceAvailable ||
    workspaceDirty ||
    workspaceConflict ||
    Boolean(actionFeedback) ||
    Boolean(headlineAlert) ||
    schedulerNeedsAttention ||
    pendingAlertsCount > 0

  const inlineToast = actionFeedback
    ? {
        tone: actionFeedback.tone === 'error' ? 'error' : actionFeedback.tone === 'warning' ? 'warning' : 'success',
        title: actionFeedback.title,
        detail: actionFeedback.detail,
        icon: actionFeedback.tone === 'error' ? AlertTriangle : Bell,
      }
    : headlineAlert && ['P0', 'P1'].includes(headlineAlert.severity)
      ? {
          tone: headlineAlert.severity === 'P0' ? 'error' : 'warning',
          title: headlineAlert.title,
          detail: `${headlineAlert.symbol} · ${headlineAlert.suggested_action}`,
          icon: Bell,
        }
      : null

  const statusInspectorButtonTitle = `打开运行状态窗口：AI ${schedulerLabel(
    schedulerStatus,
  )}，队列 ${schedulerQueueDepth} 个，未处理提醒 ${pendingAlertsCount} 条。`

  const statusInspectorCards = [
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
      detail: workspaceDirty ? '当前本地布局和控制端保存状态不同' : `上次保存 ${formatTime(workspaceSavedAt ?? workspaceUpdatedAt)}`,
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

  const latestSchedulerCommandBanner = latestSchedulerCommand
    ? {
        tone: latestSchedulerCommand.tone === 'warning' ? 'warning' : 'success',
        commandLabel: latestSchedulerCommand.commandLabel,
        summary: latestSchedulerCommand.summary,
        impactDetail: latestSchedulerCommand.impactDetail,
        occurredAt: formatTime(latestSchedulerCommand.occurredAt),
        actions: latestSchedulerCommandActions,
      }
    : null

  const statusInspectorMessages = [
    ...(!serviceAvailable
      ? [
          {
            key: 'service-offline',
            icon: AlertTriangle,
            title: '服务 · 本地控制服务未连通',
            detail: '启动 `python3 services/control-api/main.py` 后，桌面端会自动切回真实数据与命令通道。',
          },
        ]
      : []),
    ...(actionFeedback
      ? [
          {
            key: 'action-feedback',
            icon: Bell,
            title: `提示 · ${actionFeedback.title}`,
            detail: actionFeedback.detail,
          },
        ]
      : []),
    ...(workspaceConflict
      ? [
          {
            key: 'workspace-conflict',
            icon: Save,
            title: '工作台 · 检测到控制端状态冲突',
            detail: '当前先保留你的本地调整；你也可以直接应用控制端版本。',
            actions: (
              <button type="button" className="ghost-button ghost-button--inline" onClick={applyServerWorkspace}>
                应用控制端状态
              </button>
            ),
          },
        ]
      : []),
    ...(headlineAlert
      ? [
          {
            key: `headline-alert-${headlineAlert.id ?? headlineAlert.symbol}`,
            icon: Bell,
            title: `提醒 · ${headlineAlert.title}`,
            detail: `${headlineAlert.symbol} · ${headlineAlert.suggested_action}`,
          },
        ]
      : []),
  ]

  const statusInspectorMessageCount = [
    !serviceAvailable,
    Boolean(actionFeedback),
    workspaceConflict,
    Boolean(headlineAlert),
    pendingAlertsCount > 0,
  ].filter(Boolean).length

  const schedulerControlsPublishGateLabel =
    schedulerStatus === 'manual_override' ? '人工接管' : schedulerFreezePublish ? '已冻结' : '开放'

  return {
    schedulerNeedsAttention,
    statusInspectorHasNotice,
    inlineToast,
    statusInspectorButtonTitle,
    statusInspectorCards,
    latestSchedulerCommandBanner,
    statusInspectorMessages,
    statusInspectorMessageCount,
    schedulerControlsPublishGateLabel,
  }
}
