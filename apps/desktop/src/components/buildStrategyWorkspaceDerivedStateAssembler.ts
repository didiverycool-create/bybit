import type { BuildStrategyWorkspaceParameterDraftStateResult } from './buildStrategyWorkspaceParameterDraftState'
import {
  buildStrategyWorkspaceCurrentPanelState,
  type StrategyWorkspaceCurrentPanelState,
} from './buildStrategyWorkspaceCurrentPanelState'
import type { StrategyWorkspaceExecutionContextState } from './buildStrategyWorkspaceExecutionContextState'
import type { BuildStrategyWorkspaceDerivedStateArgs } from './buildStrategyWorkspaceDerivedState'
import {
  buildStrategyWorkspaceDerivedStateExecutionContextState,
} from './buildStrategyWorkspaceDerivedStateExecutionContextState'
import {
  buildStrategyWorkspaceDerivedStateParameterDraftState,
} from './buildStrategyWorkspaceDerivedStateParameterDraftState'

export type BuildStrategyWorkspaceDerivedStateAssemblerArgs = BuildStrategyWorkspaceDerivedStateArgs

export type BuildStrategyWorkspaceDerivedStateAssemblerResult = {
  parameterDraftPatch: BuildStrategyWorkspaceParameterDraftStateResult['parameterDraftPatch']
  parameterDraftChangeCount: number
  hasParameterDraftChanges: boolean
  riskBudgetChanged: boolean
  currentPanelState: StrategyWorkspaceCurrentPanelState
  executionContextState: StrategyWorkspaceExecutionContextState | null
}

export function buildStrategyWorkspaceDerivedStateAssembler({
  parameterDraftState,
  currentPanelState,
  executionContextState,
}: BuildStrategyWorkspaceDerivedStateAssemblerArgs): BuildStrategyWorkspaceDerivedStateAssemblerResult {
  const parameterDraftStateModel = buildStrategyWorkspaceDerivedStateParameterDraftState(
    parameterDraftState,
  )

  const currentPanelStateModel = buildStrategyWorkspaceCurrentPanelState({
    ...currentPanelState,
    hasParameterDraftChanges: parameterDraftStateModel.hasParameterDraftChanges,
    parameterDraftChangeCount: parameterDraftStateModel.parameterDraftChangeCount,
    riskBudgetChanged: parameterDraftStateModel.riskBudgetChanged,
  })

  const executionContextStateModel = buildStrategyWorkspaceDerivedStateExecutionContextState(
    executionContextState,
  )

  return {
    parameterDraftPatch: parameterDraftStateModel.parameterDraftPatch,
    parameterDraftChangeCount: parameterDraftStateModel.parameterDraftChangeCount,
    hasParameterDraftChanges: parameterDraftStateModel.hasParameterDraftChanges,
    riskBudgetChanged: parameterDraftStateModel.riskBudgetChanged,
    currentPanelState: currentPanelStateModel,
    executionContextState: executionContextStateModel,
  }
}
