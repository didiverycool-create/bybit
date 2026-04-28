import type { StrategySummary } from '../types'
import type { BuildStrategyWorkspaceParameterDraftStateResult } from './buildStrategyWorkspaceParameterDraftState'
import { buildStrategyWorkspaceParameterDraftState } from './buildStrategyWorkspaceParameterDraftState'

export type BuildStrategyWorkspaceDerivedStateParameterDraftStateArgs = {
  selectedStrategy: StrategySummary | null
  riskBudgetDraft: string
  parameterDrafts: Record<string, string>
}

export function buildStrategyWorkspaceDerivedStateParameterDraftState({
  selectedStrategy,
  riskBudgetDraft,
  parameterDrafts,
}: BuildStrategyWorkspaceDerivedStateParameterDraftStateArgs): BuildStrategyWorkspaceParameterDraftStateResult {
  return buildStrategyWorkspaceParameterDraftState({
    selectedStrategy,
    riskBudgetDraft,
    parameterDrafts,
  })
}
