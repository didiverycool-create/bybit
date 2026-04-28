import { useEffect } from 'react'

import type { UseWorkspaceDraftSelectionCleanupArgs } from './useWorkspaceDraftSelectionCleanup.types'

type UseWorkspaceDraftSelectionCleanupBacktestArgs = Pick<
  UseWorkspaceDraftSelectionCleanupArgs,
  'backtestsForWorkspace' | 'selectedBacktestId' | 'setSelectedBacktestId'
>

export function useWorkspaceDraftSelectionCleanupBacktest({
  backtestsForWorkspace,
  selectedBacktestId,
  setSelectedBacktestId,
}: UseWorkspaceDraftSelectionCleanupBacktestArgs) {
  useEffect(() => {
    if (backtestsForWorkspace.length === 0) {
      setSelectedBacktestId(null)
      return
    }

    const exists = backtestsForWorkspace.some((item) => item.id === selectedBacktestId)
    if (!selectedBacktestId || !exists) {
      setSelectedBacktestId(backtestsForWorkspace[0].id)
    }
  }, [backtestsForWorkspace, selectedBacktestId, setSelectedBacktestId])
}
