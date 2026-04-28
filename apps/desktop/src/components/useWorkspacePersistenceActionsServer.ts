import type { UseWorkspacePersistenceActionsOptions } from './useWorkspacePersistenceActions.types'

export function buildApplyServerWorkspaceAction({
  applyWorkspaceStateWithMarketPrefetch,
  setWorkspaceConflict,
  showFeedback,
  workspaceQueryData,
}: UseWorkspacePersistenceActionsOptions) {
  return async () => {
    if (!workspaceQueryData) {
      return
    }
    await applyWorkspaceStateWithMarketPrefetch(workspaceQueryData)
    setWorkspaceConflict(false)
    showFeedback(
      'success',
      '已应用控制端状态',
      '当前界面已切换到服务端保存的工作台配置。',
    )
  }
}
