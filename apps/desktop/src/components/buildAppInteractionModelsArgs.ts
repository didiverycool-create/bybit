import { buildAppInteractionNavigationArgs } from './buildAppInteractionNavigationArgs'
import {
  buildAppInteractionStrategyWorkflowSource,
  buildAppInteractionWorkspaceControlSource,
} from './buildAppInteractionModelsSourceGroups'
import { buildAppInteractionStrategyWorkflowArgs } from './buildAppInteractionStrategyWorkflowArgs'
import { buildAppInteractionWorkspaceControlArgs } from './buildAppInteractionWorkspaceControlArgs'
import type { BuildAppInteractionModelsArgsInput } from './buildAppInteractionModelsArgsShared'
import type { useAppInteractionModels } from './useAppInteractionModels'

type BuildAppInteractionModelsArgs = Parameters<typeof useAppInteractionModels>[0]

export function buildAppInteractionModelsArgs({
  ...input
}: BuildAppInteractionModelsArgsInput): BuildAppInteractionModelsArgs {
  const navigationSource = input
  const strategyWorkflowSource =
    buildAppInteractionStrategyWorkflowSource(input)
  const workspaceControlSource =
    buildAppInteractionWorkspaceControlSource(input)

  return {
    navigationArgs: buildAppInteractionNavigationArgs(navigationSource),
    strategyWorkflowArgs: buildAppInteractionStrategyWorkflowArgs(
      strategyWorkflowSource,
    ),
    workspaceControlArgs: buildAppInteractionWorkspaceControlArgs(
      workspaceControlSource,
    ),
  }
}
