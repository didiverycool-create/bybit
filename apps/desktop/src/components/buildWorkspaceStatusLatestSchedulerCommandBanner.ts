import type { ReactNode } from 'react'

import type { WorkspaceStatusLatestSchedulerCommandMeta } from './buildWorkspaceStatusDerivedState'

type BuildWorkspaceStatusLatestSchedulerCommandBannerArgs = {
  latestSchedulerCommand: WorkspaceStatusLatestSchedulerCommandMeta
  latestSchedulerCommandActions: ReactNode
  formatTime: (value?: string | null) => string
}

type WorkspaceStatusLatestSchedulerCommandBanner = {
  tone: 'warning' | 'success'
  commandLabel: string
  summary: string
  impactDetail?: string | null
  occurredAt: string
  actions: ReactNode
}

export function buildWorkspaceStatusLatestSchedulerCommandBanner({
  latestSchedulerCommand,
  latestSchedulerCommandActions,
  formatTime,
}: BuildWorkspaceStatusLatestSchedulerCommandBannerArgs): WorkspaceStatusLatestSchedulerCommandBanner | null {
  return latestSchedulerCommand
    ? {
        tone: latestSchedulerCommand.tone === 'warning' ? 'warning' : 'success',
        commandLabel: latestSchedulerCommand.commandLabel,
        summary: latestSchedulerCommand.summary,
        impactDetail: latestSchedulerCommand.impactDetail,
        occurredAt: formatTime(latestSchedulerCommand.occurredAt),
        actions: latestSchedulerCommandActions,
      }
    : null
}
