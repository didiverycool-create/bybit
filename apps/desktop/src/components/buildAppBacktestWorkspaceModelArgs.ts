import type { BuildAppWorkspaceModelsArgs } from './buildAppWorkspaceModels'

type BuildBacktestWorkspaceArgs = BuildAppWorkspaceModelsArgs['backtestWorkspace']

export type BuildAppBacktestWorkspaceModelArgsInput = Omit<
  BuildBacktestWorkspaceArgs,
  'baseArgs'
> &
  BuildBacktestWorkspaceArgs['baseArgs']

export function buildAppBacktestWorkspaceModelArgs({
  selectionState,
  serviceState,
  derivedStateArgs,
}: BuildAppBacktestWorkspaceModelArgsInput): BuildBacktestWorkspaceArgs {
  return {
    baseArgs: {
      selectionState,
      serviceState,
    },
    derivedStateArgs,
  }
}
