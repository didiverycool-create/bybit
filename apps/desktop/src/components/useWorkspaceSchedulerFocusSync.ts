import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { AgentJob, StrategySummary } from '../types'
import { useWorkspaceFocusSyncEffect } from './useWorkspaceFocusSyncEffect'
import { syncWorkspaceFocusFromScheduler } from './workspaceFocusSyncHelpers'

type WorkspaceFocusSelectionArgs = {
  strategies: StrategySummary[]
  selectedStrategyCurrentId: string | null
  selectedStrategyId: string | null
  selectedSymbol: string
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
}

export type WorkspaceFocusSchedulerSyncArgs = WorkspaceFocusSelectionArgs & {
  activeSection: string
  aiSchedulerFocusedJobId: string | null
  schedulerJobs: AgentJob[]
}

export function useWorkspaceSchedulerFocusSync({
  activeSection,
  aiSchedulerFocusedJobId,
  schedulerJobs,
  strategies,
  selectedStrategyCurrentId,
  selectedStrategyId,
  selectedSymbol,
  setSelectedStrategyId,
  setSelectedSymbol,
}: WorkspaceFocusSchedulerSyncArgs) {
  const dependencies = useMemo(
    () => [
      aiSchedulerFocusedJobId,
      schedulerJobs,
      selectedStrategyCurrentId,
      selectedStrategyId,
      selectedSymbol,
      setSelectedStrategyId,
      setSelectedSymbol,
      strategies,
    ],
    [
      aiSchedulerFocusedJobId,
      schedulerJobs,
      selectedStrategyCurrentId,
      selectedStrategyId,
      selectedSymbol,
      setSelectedStrategyId,
      setSelectedSymbol,
      strategies,
    ],
  )

  useWorkspaceFocusSyncEffect({
    enabled: activeSection === 'scheduler' && Boolean(aiSchedulerFocusedJobId),
    dependencies,
    sync: () => {
      if (!aiSchedulerFocusedJobId) {
        return
      }
      syncWorkspaceFocusFromScheduler({
        schedulerJobs,
        aiSchedulerFocusedJobId,
        strategies,
        selectedStrategyCurrentId,
        selectedStrategyId,
        selectedSymbol,
        setSelectedStrategyId,
        setSelectedSymbol,
      })
    },
  })
}
