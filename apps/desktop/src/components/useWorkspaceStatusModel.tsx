import {
  buildWorkspaceStatusDerivedState,
  type BuildWorkspaceStatusDerivedStateArgs,
} from './buildWorkspaceStatusDerivedState'

type UseWorkspaceStatusModelArgs = BuildWorkspaceStatusDerivedStateArgs

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
  return buildWorkspaceStatusDerivedState({
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
  })
}
