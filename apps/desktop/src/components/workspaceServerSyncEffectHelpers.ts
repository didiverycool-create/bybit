import { buildWorkspaceSignature } from '../utils/workspace-helpers'
import type { WorkspaceServerSyncEffectInput } from './workspaceServerSyncStateHelpers'

export function resolveWorkspaceServerSyncEffectState({
  workspaceQueryData,
  currentWorkspaceDraft,
  lastSyncedWorkspaceSignature,
}: WorkspaceServerSyncEffectInput) {
  if (!workspaceQueryData) {
    return { mode: 'skip' as const }
  }

  const serverSignature = buildWorkspaceSignature(workspaceQueryData)
  const currentSignature = buildWorkspaceSignature(currentWorkspaceDraft)

  if (serverSignature === lastSyncedWorkspaceSignature) {
    return { mode: 'synced' as const }
  }
  if (currentSignature !== lastSyncedWorkspaceSignature) {
    return { mode: 'conflict' as const }
  }

  return {
    mode: 'apply' as const,
    workspace: workspaceQueryData,
  }
}
