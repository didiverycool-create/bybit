import { buildRestoredWorkspaceDraft } from '../utils/workspace-helpers'
import type { UseWorkspacePersistenceActionsOptions } from './useWorkspacePersistenceActions.types'

export function buildRestoreDefaultWorkspaceAction({
  applyWorkspaceStateWithMarketPrefetch,
  watchlistFirstSymbol,
  strategiesFirstId,
  syncWorkspacePreferences,
}: UseWorkspacePersistenceActionsOptions & {
  syncWorkspacePreferences: (draft?: UseWorkspacePersistenceActionsOptions['currentWorkspaceDraft']) => Promise<void>
}) {
  return async () => {
    const nextDraft = buildRestoredWorkspaceDraft({
      selectedSymbol: watchlistFirstSymbol,
      selectedStrategyId: strategiesFirstId,
    })
    await applyWorkspaceStateWithMarketPrefetch(nextDraft)
    await syncWorkspacePreferences(nextDraft)
  }
}
