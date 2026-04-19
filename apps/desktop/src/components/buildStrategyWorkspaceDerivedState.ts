import type { BuildStrategyWorkspaceDerivedStateAssemblerResult } from './buildStrategyWorkspaceDerivedStateAssembler'
import { buildStrategyWorkspaceDerivedStateAssembler } from './buildStrategyWorkspaceDerivedStateAssembler'
import type { BuildStrategyWorkspaceCurrentPanelStateArgs } from './buildStrategyWorkspaceCurrentPanelState'
import type { BuildStrategyWorkspaceDerivedStateExecutionContextStateArgs } from './buildStrategyWorkspaceDerivedStateExecutionContextState'
import type { BuildStrategyWorkspaceDerivedStateParameterDraftStateArgs } from './buildStrategyWorkspaceDerivedStateParameterDraftState'

export type BuildStrategyWorkspaceDerivedStateParameterDraftArgs =
  BuildStrategyWorkspaceDerivedStateParameterDraftStateArgs

export type BuildStrategyWorkspaceDerivedStateCurrentPanelArgs = Omit<
  BuildStrategyWorkspaceCurrentPanelStateArgs,
  'hasParameterDraftChanges' | 'parameterDraftChangeCount' | 'riskBudgetChanged'
>

export type BuildStrategyWorkspaceDerivedStateExecutionContextArgs =
  BuildStrategyWorkspaceDerivedStateExecutionContextStateArgs

export type BuildStrategyWorkspaceDerivedStateArgs = {
  parameterDraftState: BuildStrategyWorkspaceDerivedStateParameterDraftArgs
  currentPanelState: BuildStrategyWorkspaceDerivedStateCurrentPanelArgs
  executionContextState: BuildStrategyWorkspaceDerivedStateExecutionContextArgs
}

export type BuildStrategyWorkspaceDerivedStateResult = {
  parameterDraftPatch: BuildStrategyWorkspaceDerivedStateAssemblerResult['parameterDraftPatch']
  parameterDraftChangeCount: number
  hasParameterDraftChanges: boolean
  riskBudgetChanged: boolean
  currentPanelState: BuildStrategyWorkspaceDerivedStateAssemblerResult['currentPanelState']
  executionContextState: BuildStrategyWorkspaceDerivedStateAssemblerResult['executionContextState']
}

export function buildStrategyWorkspaceDerivedState(
  args: BuildStrategyWorkspaceDerivedStateArgs,
): BuildStrategyWorkspaceDerivedStateResult {
  return buildStrategyWorkspaceDerivedStateAssembler(args)
}
