import type { ReactNode } from 'react'

import { buildWorkspaceStatusDerivedStateAssembler } from './buildWorkspaceStatusDerivedStateAssembler'
import { buildWorkspaceStatusInspectorCards } from './buildWorkspaceStatusInspectorCards'
import { buildWorkspaceStatusInspectorMeta } from './buildWorkspaceStatusInspectorMeta'
import { buildWorkspaceStatusInlineToast } from './buildWorkspaceStatusInlineToast'
import { buildWorkspaceStatusLatestSchedulerCommandBanner } from './buildWorkspaceStatusLatestSchedulerCommandBanner'
import { buildWorkspaceStatusMessages } from './buildWorkspaceStatusMessages'

export type WorkspaceStatusActionFeedback = {
  tone: 'success' | 'warning' | 'error'
  title: string
  detail: string
}

export type WorkspaceStatusHeadlineAlert = {
  id?: string | null
  severity: 'P0' | 'P1' | 'P2'
  symbol: string
  title: string
  suggested_action: string
}

export type WorkspaceStatusLatestSchedulerCommandMeta = {
  commandLabel: string
  summary: string
  impactDetail?: string | null
  occurredAt: string
  tone: 'warning' | 'success'
} | null

export type BuildWorkspaceStatusDerivedStateArgs = {
  actionFeedback: WorkspaceStatusActionFeedback | null
  headlineAlert: WorkspaceStatusHeadlineAlert | null
  latestSchedulerCommand: WorkspaceStatusLatestSchedulerCommandMeta
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

export function buildWorkspaceStatusDerivedState({
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
}: BuildWorkspaceStatusDerivedStateArgs) {
  const workspaceStatusSource = {
    actionFeedback,
    headlineAlert,
    serviceAvailable,
    workspaceConflict,
    workspaceDirty,
    pendingAlertsCount,
  }
  const schedulerStatusSource = {
    schedulerStatus,
    schedulerQueueDepth,
    schedulerFreezePublish,
    schedulerLabel,
  }
  const inspectorMeta = buildWorkspaceStatusInspectorMeta({
    ...workspaceStatusSource,
    ...schedulerStatusSource,
  })
  const inlineToast = buildWorkspaceStatusInlineToast({
    actionFeedback,
    headlineAlert,
  })
  const statusInspectorCards = buildWorkspaceStatusInspectorCards({
    schedulerNeedsAttention: inspectorMeta.schedulerNeedsAttention,
    selectedMode,
    ...schedulerStatusSource,
    serviceAvailable,
    openClawReachable,
    openClawGatewayUrl,
    workspaceDirty,
    workspaceSavedAt,
    workspaceUpdatedAt,
    pendingAlertsCount,
    headlineAlert,
    formatTime,
  })
  const latestSchedulerCommandBanner = buildWorkspaceStatusLatestSchedulerCommandBanner({
    latestSchedulerCommand,
    latestSchedulerCommandActions,
    formatTime,
  })
  const statusInspectorMessages = buildWorkspaceStatusMessages({
    serviceAvailable,
    actionFeedback,
    workspaceConflict,
    headlineAlert,
    applyServerWorkspace,
  })

  return buildWorkspaceStatusDerivedStateAssembler({
    ...inspectorMeta,
    inlineToast,
    statusInspectorCards,
    latestSchedulerCommandBanner,
    statusInspectorMessages,
  })
}
