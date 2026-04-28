import type { WorkspaceStatusActionFeedback, WorkspaceStatusHeadlineAlert } from './buildWorkspaceStatusDerivedState'

type BuildWorkspaceStatusInspectorMetaArgs = {
  actionFeedback: WorkspaceStatusActionFeedback | null
  headlineAlert: WorkspaceStatusHeadlineAlert | null
  serviceAvailable: boolean
  schedulerLabel: (status: string) => string
  schedulerStatus: string
  schedulerQueueDepth: number
  schedulerFreezePublish: boolean
  workspaceDirty: boolean
  workspaceConflict: boolean
  pendingAlertsCount: number
}

export type WorkspaceStatusInspectorMeta = {
  schedulerNeedsAttention: boolean
  statusInspectorHasNotice: boolean
  statusInspectorButtonTitle: string
  statusInspectorMessageCount: number
  schedulerControlsPublishGateLabel: string
}

export function buildWorkspaceStatusInspectorMeta({
  actionFeedback,
  headlineAlert,
  serviceAvailable,
  schedulerLabel,
  schedulerStatus,
  schedulerQueueDepth,
  schedulerFreezePublish,
  workspaceDirty,
  workspaceConflict,
  pendingAlertsCount,
}: BuildWorkspaceStatusInspectorMetaArgs): WorkspaceStatusInspectorMeta {
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

  const statusInspectorButtonTitle = `打开运行状态窗口：AI ${schedulerLabel(
    schedulerStatus,
  )}，队列 ${schedulerQueueDepth} 个，未处理提醒 ${pendingAlertsCount} 条。`

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
    statusInspectorButtonTitle,
    statusInspectorMessageCount,
    schedulerControlsPublishGateLabel,
  }
}
