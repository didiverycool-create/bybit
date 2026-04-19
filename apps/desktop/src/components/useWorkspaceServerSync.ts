import { useWorkspaceServerStateBridge } from './useWorkspaceServerStateBridge'
import type {
  UseWorkspaceServerStateBridgeArgs,
  UseWorkspaceServerStateBridgeResult,
} from './workspaceServerStateBridge.types'

export function useWorkspaceServerSync({
  ...args
}: UseWorkspaceServerSyncArgs): UseWorkspaceServerSyncResult {
  return useWorkspaceServerStateBridge(args)
}

export type UseWorkspaceServerSyncArgs = UseWorkspaceServerStateBridgeArgs

export type UseWorkspaceServerSyncResult = UseWorkspaceServerStateBridgeResult
