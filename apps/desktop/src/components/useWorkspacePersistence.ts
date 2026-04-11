import { useCallback, useEffect } from 'react'

import type { WorkspacePreferences } from '../types'
import type {
  WorkspaceBootstrap,
} from '../utils/workspace-helpers'
import {
  buildRestoredWorkspaceDraft,
  buildWorkspacePersistedState,
  buildWorkspaceSignature,
  persistLocalWorkspace,
} from '../utils/workspace-helpers'

type WorkspaceFeedbackTone = 'success' | 'warning' | 'error'

export type UseWorkspacePersistenceOptions = {
  currentWorkspaceDraft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>
  workspaceSavedAt: string | null
  lastSyncedWorkspaceSignature: string
  workspaceQueryData: WorkspaceBootstrap | WorkspacePreferences | null | undefined
  serviceAvailable: boolean
  saveWorkspacePreferences: (draft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>) => Promise<
    Pick<WorkspaceBootstrap, 'updated_at'>
  >
  setLastSyncedWorkspaceSignature: (signature: string) => void
  applyWorkspaceStateWithMarketPrefetch: (next: WorkspaceBootstrap | WorkspacePreferences) => Promise<void>
  setWorkspaceSavedAt: (value: string | null) => void
  setWorkspaceConflict: (value: boolean) => void
  showFeedback: (tone: WorkspaceFeedbackTone, title: string, detail: string) => void
  watchlistFirstSymbol: string | null | undefined
  strategiesFirstId: string | null | undefined
}

export function useWorkspacePersistence(options: UseWorkspacePersistenceOptions) {
  const {
    currentWorkspaceDraft,
    workspaceSavedAt,
    lastSyncedWorkspaceSignature,
    workspaceQueryData,
    serviceAvailable,
    saveWorkspacePreferences,
    setLastSyncedWorkspaceSignature,
    applyWorkspaceStateWithMarketPrefetch,
    setWorkspaceSavedAt,
    setWorkspaceConflict,
    showFeedback,
    watchlistFirstSymbol,
    strategiesFirstId,
  } = options

  useEffect(() => {
    persistLocalWorkspace(buildWorkspacePersistedState(currentWorkspaceDraft, workspaceSavedAt))
  }, [currentWorkspaceDraft, workspaceSavedAt])

  const syncWorkspacePreferences = useCallback(
    async (draft: typeof currentWorkspaceDraft = currentWorkspaceDraft) => {
      try {
        if (serviceAvailable) {
          const saved = await saveWorkspacePreferences(draft)
          setWorkspaceSavedAt(saved.updated_at)
          setWorkspaceConflict(false)
          showFeedback('success', '工作台状态已同步', '控制端保存了最新布局、模式和关注品种。')
          return
        }

        const localSavedAt = new Date().toISOString()
        setWorkspaceSavedAt(localSavedAt)
        setLastSyncedWorkspaceSignature(buildWorkspaceSignature(draft))
        setWorkspaceConflict(false)
        showFeedback('warning', '已仅保存到本地缓存', '当前控制服务未连接，工作台状态尚未同步到本地控制端。')
      } catch (error) {
        showFeedback('error', '工作台同步失败', error instanceof Error ? error.message : String(error))
      }
    },
    [
      currentWorkspaceDraft,
      saveWorkspacePreferences,
      serviceAvailable,
      setLastSyncedWorkspaceSignature,
      setWorkspaceConflict,
      setWorkspaceSavedAt,
      showFeedback,
    ],
  )

  const restoreDefaultWorkspace = useCallback(async () => {
    const nextDraft = buildRestoredWorkspaceDraft({
      selectedSymbol: watchlistFirstSymbol,
      selectedStrategyId: strategiesFirstId,
    })
    await applyWorkspaceStateWithMarketPrefetch(nextDraft)
    await syncWorkspacePreferences(nextDraft)
  }, [
    applyWorkspaceStateWithMarketPrefetch,
    strategiesFirstId,
    syncWorkspacePreferences,
    watchlistFirstSymbol,
  ])

  const applyServerWorkspace = useCallback(async () => {
    if (!workspaceQueryData) return
    await applyWorkspaceStateWithMarketPrefetch(workspaceQueryData)
    setWorkspaceConflict(false)
    showFeedback('success', '已应用控制端状态', '当前界面已切换到服务端保存的工作台配置。')
  }, [
    applyWorkspaceStateWithMarketPrefetch,
    setWorkspaceConflict,
    showFeedback,
    workspaceQueryData,
  ])

  const workspaceDirty =
    buildWorkspaceSignature(currentWorkspaceDraft) !== lastSyncedWorkspaceSignature

  return {
    currentWorkspaceDraft,
    workspaceDirty,
    syncWorkspacePreferences,
    restoreDefaultWorkspace,
    applyServerWorkspace,
  }
}
