import { useEffect } from 'react'

import type { StrategyParameter } from '../types'
import { normalizeDraftValue } from '../utils/app-helpers'

type UseWorkspaceDraftSyncStrategyEditorArgs = {
  selectedStrategyParameters: StrategyParameter[]
  selectedStrategyRiskBudget: string
  selectedStrategyId: string | null
  selectedStrategyParameterSignature: string
  strategyEditorDraftStrategyId: string | null
  strategyEditorOpen: boolean
  setParameterDrafts: (drafts: Record<string, string>) => void
  setRiskBudgetDraft: (value: string) => void
  setStrategyEditorDraftStrategyId: (value: string | null) => void
}

export function useWorkspaceDraftSyncStrategyEditor({
  selectedStrategyParameters,
  selectedStrategyRiskBudget,
  selectedStrategyId,
  selectedStrategyParameterSignature,
  strategyEditorDraftStrategyId,
  strategyEditorOpen,
  setParameterDrafts,
  setRiskBudgetDraft,
  setStrategyEditorDraftStrategyId,
}: UseWorkspaceDraftSyncStrategyEditorArgs) {
  useEffect(() => {
    if (!selectedStrategyId || selectedStrategyParameters.length === 0) {
      setParameterDrafts({})
      setRiskBudgetDraft('')
      setStrategyEditorDraftStrategyId(null)
      return
    }

    if (strategyEditorDraftStrategyId === selectedStrategyId) {
      return
    }

    if (!strategyEditorOpen) {
      setParameterDrafts({})
      setRiskBudgetDraft('')
      setStrategyEditorDraftStrategyId(null)
      return
    }

    setParameterDrafts(
      Object.fromEntries(
        selectedStrategyParameters.map((parameter) => [parameter.key, normalizeDraftValue(parameter.value)]),
      ),
    )
    setRiskBudgetDraft(selectedStrategyRiskBudget)
    setStrategyEditorDraftStrategyId(selectedStrategyId)
  }, [
    selectedStrategyId,
    selectedStrategyParameterSignature,
    selectedStrategyParameters,
    selectedStrategyRiskBudget,
    strategyEditorDraftStrategyId,
    strategyEditorOpen,
    setParameterDrafts,
    setRiskBudgetDraft,
    setStrategyEditorDraftStrategyId,
  ])
}
