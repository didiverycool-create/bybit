import { useState } from 'react'
import {
  readWorkspaceBootstrap,
  type WorkspaceBootstrap,
} from '../utils/workspace-helpers'
import { useWorkspaceDraftAndFilterState } from './useWorkspaceDraftAndFilterState'
import { useWorkspaceLayoutState } from './useWorkspaceLayoutState'
import { useWorkspaceNotificationRefs } from './useWorkspaceNotificationRefs'
import { useWorkspacePanelState } from './useWorkspacePanelState'
import { useWorkspaceStrategyActivityState } from './useWorkspaceStrategyActivityState'

type UseAppWorkspaceBootstrapStateArgs = {
  defaultBacktestRange: string
  defaultBacktestTimeframe: string
}

export function createStrategyTrackingRequestKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAppWorkspaceBootstrapState({
  defaultBacktestRange,
  defaultBacktestTimeframe,
}: UseAppWorkspaceBootstrapStateArgs) {
  const [workspaceBootstrap] = useState<WorkspaceBootstrap>(() => readWorkspaceBootstrap())
  const workspaceLayoutState = useWorkspaceLayoutState({
    workspaceBootstrap,
  })
  const workspacePanelState = useWorkspacePanelState({
    workspaceBootstrap,
  })
  const workspaceStrategyActivityState = useWorkspaceStrategyActivityState({
    workspaceBootstrap,
    createTrackingRequestKey: createStrategyTrackingRequestKey,
  })
  const workspaceDraftAndFilterState = useWorkspaceDraftAndFilterState({
    workspaceBootstrap,
    defaultBacktestRange,
    defaultBacktestTimeframe,
  })
  const workspaceNotificationRefs = useWorkspaceNotificationRefs()

  return {
    workspaceBootstrap,
    ...workspaceLayoutState,
    ...workspacePanelState,
    ...workspaceStrategyActivityState,
    ...workspaceDraftAndFilterState,
    ...workspaceNotificationRefs,
  }
}
