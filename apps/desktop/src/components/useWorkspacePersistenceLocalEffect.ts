import { useEffect } from 'react'

import type { WorkspaceBootstrap } from '../utils/workspace-helpers'
import {
  buildWorkspacePersistedState,
  persistLocalWorkspace,
} from '../utils/workspace-helpers'

type UseWorkspacePersistenceLocalEffectArgs = {
  currentWorkspaceDraft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>
  workspaceSavedAt: string | null
}

export function useWorkspacePersistenceLocalEffect({
  currentWorkspaceDraft,
  workspaceSavedAt,
}: UseWorkspacePersistenceLocalEffectArgs) {
  useEffect(() => {
    persistLocalWorkspace(
      buildWorkspacePersistedState(currentWorkspaceDraft, workspaceSavedAt),
    )
  }, [currentWorkspaceDraft, workspaceSavedAt])
}
