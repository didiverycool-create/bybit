import type { ComponentType, ReactNode } from 'react'

type WorkspaceStatusInlineToast = {
  tone: 'success' | 'warning' | 'error'
  title: string
  detail: string
  icon: ComponentType<{ size?: number | string }>
}

type WorkspaceStatusInspectorCard = {
  key: string
  icon: ComponentType<{ size?: number | string }>
  label: string
  value: string
  detail: string
  tone: 'warn' | 'good' | 'muted'
}

type WorkspaceStatusInspectorMessage = {
  key: string
  icon: ComponentType<{ size?: number | string }>
  title: string
  detail: string
  actions?: ReactNode
}

type WorkspaceStatusLatestSchedulerCommandBanner = {
  tone: 'warning' | 'success'
  commandLabel: string
  summary: string
  impactDetail?: string | null
  occurredAt: string
  actions: ReactNode
}

type BuildWorkspaceStatusDerivedStateAssemblerArgs = {
  schedulerNeedsAttention: boolean
  statusInspectorHasNotice: boolean
  inlineToast: WorkspaceStatusInlineToast | null
  statusInspectorButtonTitle: string
  statusInspectorCards: readonly WorkspaceStatusInspectorCard[]
  latestSchedulerCommandBanner: WorkspaceStatusLatestSchedulerCommandBanner | null
  statusInspectorMessages: readonly WorkspaceStatusInspectorMessage[]
  statusInspectorMessageCount: number
  schedulerControlsPublishGateLabel: string
}

export function buildWorkspaceStatusDerivedStateAssembler({
  schedulerNeedsAttention,
  statusInspectorHasNotice,
  inlineToast,
  statusInspectorButtonTitle,
  statusInspectorCards,
  latestSchedulerCommandBanner,
  statusInspectorMessages,
  statusInspectorMessageCount,
  schedulerControlsPublishGateLabel,
}: BuildWorkspaceStatusDerivedStateAssemblerArgs) {
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
