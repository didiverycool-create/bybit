import { startTransition } from 'react'

import { normalizeDraftValue } from '../utils/app-helpers'

import type { BuildWorkspaceStrategyNavigationActionsArgs } from './buildWorkspaceStrategyNavigationActions.types'

export function buildWorkspaceStrategyEditorNavigationAction({
  strategies,
  selectedStrategy,
  selectedStrategyId,
  strategyEditorDraftStrategyId,
  parameterDrafts,
  setParameterDrafts,
  setRiskBudgetDraft,
  setStrategyEditorDraftStrategyId,
  setActiveSection,
  setSelectedStrategyId,
  setSelectedSymbol,
  setStrategyActivityPanelOpen,
  setStrategyTrackingPanelOpen,
  setStrategyEditorOpen,
}: BuildWorkspaceStrategyNavigationActionsArgs) {
  return (strategyId?: string | null) => {
    const nextStrategyId = strategyId ?? selectedStrategy?.id ?? selectedStrategyId
    if (!nextStrategyId) {
      return
    }
    const nextStrategy = strategies.find((item) => item.id === nextStrategyId) ?? null
    const nextSymbol = nextStrategy?.symbols[0] ?? null
    if (
      nextStrategy &&
      (strategyEditorDraftStrategyId !== nextStrategy.id || Object.keys(parameterDrafts).length === 0)
    ) {
      setParameterDrafts(
        Object.fromEntries(
          nextStrategy.parameters.map((parameter) => [parameter.key, normalizeDraftValue(parameter.value)]),
        ),
      )
      setRiskBudgetDraft(nextStrategy.risk_budget ?? '')
      setStrategyEditorDraftStrategyId(nextStrategy.id)
    }
    startTransition(() => {
      setActiveSection('strategy')
      setSelectedStrategyId(nextStrategyId)
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setStrategyActivityPanelOpen(false)
      setStrategyTrackingPanelOpen(false)
      setStrategyEditorOpen(true)
    })
  }
}
