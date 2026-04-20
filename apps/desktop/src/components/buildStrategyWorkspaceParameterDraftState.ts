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

// Advanced-config keys (rounds 44-47) carry no baseline in ``strategy.parameters``
// so coerce via the draft text alone — numeric strings become numbers, literal
// ``true``/``false`` become booleans, and everything else stays as a string so
// the kernel selector and other enums round-trip verbatim.
function coerceAdvancedDraftValue(raw: string): string | number | boolean {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) return numeric
  }
  return raw
}

export function buildStrategyWorkspaceParameterDraftState({
  selectedStrategy,
  riskBudgetDraft,
  parameterDrafts,
}: BuildStrategyWorkspaceParameterDraftStateArgs): BuildStrategyWorkspaceParameterDraftStateResult {
  const parameterKeys = new Set(selectedStrategy?.parameters.map((parameter) => parameter.key) ?? [])
  const parameterDraftPatch = selectedStrategy
    ? {
        ...Object.fromEntries(
          selectedStrategy.parameters.flatMap((parameter) => {
            const draftValue = parameterDrafts[parameter.key]
            const normalizedCurrent = normalizeDraftValue(parameter.value)
            if (draftValue == null || draftValue === normalizedCurrent) {
              return []
            }
            return [[parameter.key, coerceParameterValue(parameter.value, draftValue)]]
          }),
        ),
        ...Object.fromEntries(
          Object.entries(parameterDrafts).flatMap(([key, value]) => {
            if (parameterKeys.has(key) || value == null || value.trim() === '') {
              return []
            }
            return [[key, coerceAdvancedDraftValue(value)]]
          }),
        ),
      }
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
