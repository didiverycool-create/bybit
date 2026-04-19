import { buildWorkspaceSignature } from '../utils/workspace-helpers'
import type { UseWorkspacePersistenceActionsOptions } from './useWorkspacePersistenceActions.types'

export function buildSyncWorkspacePreferencesAction({
  currentWorkspaceDraft,
  serviceAvailable,
  saveWorkspacePreferences,
  setLastSyncedWorkspaceSignature,
  setWorkspaceSavedAt,
  setWorkspaceConflict,
  showFeedback,
}: UseWorkspacePersistenceActionsOptions) {
  return async (draft: typeof currentWorkspaceDraft = currentWorkspaceDraft) => {
    try {
      if (serviceAvailable) {
        const saved = await saveWorkspacePreferences(draft)
        setWorkspaceSavedAt(saved.updated_at)
        setWorkspaceConflict(false)
        showFeedback(
          'success',
          '工作台状态已同步',
          '控制端保存了最新布局、模式和关注品种。',
        )
        return
      }

      const localSavedAt = new Date().toISOString()
      setWorkspaceSavedAt(localSavedAt)
      setLastSyncedWorkspaceSignature(buildWorkspaceSignature(draft))
      setWorkspaceConflict(false)
      showFeedback(
        'warning',
        '已仅保存到本地缓存',
        '当前控制服务未连接，工作台状态尚未同步到本地控制端。',
      )
    } catch (error) {
      showFeedback(
        'error',
        '工作台同步失败',
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}
