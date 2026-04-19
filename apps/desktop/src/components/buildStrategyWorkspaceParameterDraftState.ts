import type { StrategySummary } from '../types'
import { coerceParameterValue, normalizeDraftValue } from '../utils/app-helpers'

export type BuildStrategyWorkspaceParameterDraftStateArgs = {
  selectedStrategy: StrategySummary | null
  riskBudgetDraft: string
  parameterDrafts: Record<string, string>
}

export type BuildStrategyWorkspaceParameterDraftStateResult = {
  parameterDraftPatch: Record<string, string | number | boolean>
  parameterDraftChangeCount: number
  hasParameterDraftChanges: boolean
  riskBudgetChanged: boolean
}

export function buildStrategyWorkspaceParameterDraftState({
  selectedStrategy,
  riskBudgetDraft,
  parameterDrafts,
}: BuildStrategyWorkspaceParameterDraftStateArgs): BuildStrategyWorkspaceParameterDraftStateResult {
  const parameterDraftPatch = selectedStrategy
    ? Object.fromEntries(
        selectedStrategy.parameters.flatMap((parameter) => {
          const draftValue = parameterDrafts[parameter.key]
          const normalizedCurrent = normalizeDraftValue(parameter.value)
          if (draftValue == null || draftValue === normalizedCurrent) {
            return []
          }
          return [[parameter.key, coerceParameterValue(parameter.value, draftValue)]]
        }),
      )
    : {}
  const parameterDraftChangeCount = Object.keys(parameterDraftPatch).length
  const hasParameterDraftChanges = parameterDraftChangeCount > 0
  const riskBudgetChanged = Boolean(
    selectedStrategy && riskBudgetDraft.trim() && riskBudgetDraft !== selectedStrategy.risk_budget,
  )

  return {
    parameterDraftPatch,
    parameterDraftChangeCount,
    hasParameterDraftChanges,
    riskBudgetChanged,
  }
}
