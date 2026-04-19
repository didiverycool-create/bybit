import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { ChangeRequest, StrategySummary } from '../types'
import { useWorkspaceFocusSyncEffect } from './useWorkspaceFocusSyncEffect'
import { syncWorkspaceFocusFromChangeRequest } from './workspaceFocusSyncHelpers'

type WorkspaceFocusSelectionArgs = {
  strategies: StrategySummary[]
  selectedStrategyCurrentId: string | null
  selectedStrategyId: string | null
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
}

export type WorkspaceFocusChangeRequestSyncArgs = WorkspaceFocusSelectionArgs & {
  activeSection: string
  changeRequests: ChangeRequest[]
  selectedChangeRequestId: string | null
}

export function useWorkspaceChangeRequestFocusSync({
  activeSection,
  changeRequests,
  selectedChangeRequestId,
  selectedStrategyCurrentId,
  selectedStrategyId,
  setSelectedStrategyId,
  strategies,
}: WorkspaceFocusChangeRequestSyncArgs) {
  const dependencies = useMemo(
    () => [
      changeRequests,
      selectedChangeRequestId,
      selectedStrategyCurrentId,
      selectedStrategyId,
      setSelectedStrategyId,
      strategies,
    ],
    [
      changeRequests,
      selectedChangeRequestId,
      selectedStrategyCurrentId,
      selectedStrategyId,
      setSelectedStrategyId,
      strategies,
    ],
  )

  useWorkspaceFocusSyncEffect({
    enabled: activeSection === 'strategy' && Boolean(selectedChangeRequestId),
    dependencies,
    sync: () => {
      if (!selectedChangeRequestId) {
        return
      }
      syncWorkspaceFocusFromChangeRequest({
        changeRequests,
        selectedChangeRequestId,
        strategies,
        selectedStrategyCurrentId,
        selectedStrategyId,
        setSelectedStrategyId,
      })
    },
  })
}
