import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { StrategyProposal, StrategySummary } from '../types'
import { useWorkspaceFocusSyncEffect } from './useWorkspaceFocusSyncEffect'
import { syncWorkspaceFocusFromProposal } from './workspaceFocusSyncHelpers'

type WorkspaceFocusSelectionArgs = {
  strategies: StrategySummary[]
  selectedStrategyCurrentId: string | null
  selectedStrategyId: string | null
  selectedSymbol: string
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
}

export type WorkspaceFocusProposalSyncArgs = WorkspaceFocusSelectionArgs & {
  activeSection: string
  selectedChangeRequestId: string | null
  selectedProposalId: string | null
  proposalCatalog: StrategyProposal[]
}

export function useWorkspaceProposalFocusSync({
  activeSection,
  selectedChangeRequestId,
  selectedProposalId,
  proposalCatalog,
  strategies,
  selectedStrategyCurrentId,
  selectedStrategyId,
  selectedSymbol,
  setSelectedStrategyId,
  setSelectedSymbol,
}: WorkspaceFocusProposalSyncArgs) {
  const dependencies = useMemo(
    () => [
      proposalCatalog,
      selectedProposalId,
      selectedStrategyCurrentId,
      selectedStrategyId,
      selectedSymbol,
      setSelectedStrategyId,
      setSelectedSymbol,
      strategies,
    ],
    [
      proposalCatalog,
      selectedProposalId,
      selectedStrategyCurrentId,
      selectedStrategyId,
      selectedSymbol,
      setSelectedStrategyId,
      setSelectedSymbol,
      strategies,
    ],
  )

  useWorkspaceFocusSyncEffect({
    enabled: activeSection === 'strategy' && !selectedChangeRequestId && Boolean(selectedProposalId),
    dependencies,
    sync: () => {
      if (!selectedProposalId) {
        return
      }
      syncWorkspaceFocusFromProposal({
        proposalCatalog,
        selectedProposalId,
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
