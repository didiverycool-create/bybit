import type { ReactNode } from 'react'
import { AlertTriangle, Bell, Save } from 'lucide-react'

import type { WorkspaceStatusActionFeedback, WorkspaceStatusHeadlineAlert } from './buildWorkspaceStatusDerivedState'

type BuildWorkspaceStatusMessagesArgs = {
  serviceAvailable: boolean
  actionFeedback: WorkspaceStatusActionFeedback | null
  workspaceConflict: boolean
  headlineAlert: WorkspaceStatusHeadlineAlert | null
  applyServerWorkspace: () => void
}

type WorkspaceStatusMessage = {
  key: string
  icon: typeof AlertTriangle | typeof Bell | typeof Save
  title: string
  detail: string
  actions?: ReactNode
}

export function buildWorkspaceStatusMessages({
  serviceAvailable,
  actionFeedback,
  workspaceConflict,
  headlineAlert,
  applyServerWorkspace,
}: BuildWorkspaceStatusMessagesArgs): WorkspaceStatusMessage[] {
  return [
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
}
