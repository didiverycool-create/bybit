import { formatTime, schedulerLabel } from '../utils/app-helpers'
import type { BuildAppCompositionModelArgs, BuildAppCompositionModelArgsInput } from './buildAppCompositionModelArgTypes'

const defaultOpenClawGatewayUrl =
  (import.meta.env.VITE_OPENCLAW_GATEWAY_URL as string | undefined) ?? 'ws://127.0.0.1:18789'

export function buildAppCompositionWorkspaceStatusArgs({
  actionFeedback,
  headlineAlert,
  latestSchedulerCommand,
  serviceAvailable,
  selectedMode,
  workspaceDirty,
  workspaceConflict,
  workspaceSavedAt,
  pendingAlertsCount,
  applyServerWorkspace,
  snapshot,
  openClawStatus,
  settings,
  workspacePreferences,
}: BuildAppCompositionModelArgsInput): BuildAppCompositionModelArgs['workspaceStatusArgs'] {
  return {
    actionFeedback,
    headlineAlert,
    latestSchedulerCommand,
    serviceAvailable,
    selectedMode,
    workspaceDirty,
    workspaceConflict,
    workspaceSavedAt,
    pendingAlertsCount,
    applyServerWorkspace,
    formatTime,
    schedulerLabel,
    schedulerStatus: snapshot?.scheduler.status ?? 'degraded',
    schedulerQueueDepth: snapshot?.scheduler.queue_depth ?? 0,
    schedulerFreezePublish: Boolean(snapshot?.scheduler.freeze_publish),
    openClawReachable: Boolean(openClawStatus?.reachable),
    openClawGatewayUrl:
      openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? defaultOpenClawGatewayUrl,
    workspaceUpdatedAt: workspacePreferences?.updated_at,
  }
}
