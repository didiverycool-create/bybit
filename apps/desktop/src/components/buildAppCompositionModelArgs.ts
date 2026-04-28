import type {
  BuildAppCompositionModelArgs as AppCompositionModelArgs,
  BuildAppCompositionModelArgsInput,
} from './buildAppCompositionModelArgTypes'
import { buildAppCompositionReviewInspectorArgs } from './buildAppCompositionReviewInspectorArgs'
import { buildAppCompositionStrategyWorkspaceActionsArgs } from './buildAppCompositionStrategyWorkspaceActionsArgs'
import { buildAppCompositionStrategyWorkspaceDerivedStateArgs } from './buildAppCompositionStrategyWorkspaceDerivedStateArgs'
import { buildAppCompositionWorkspaceStatusArgs } from './buildAppCompositionWorkspaceStatusArgs'

export type { BuildAppCompositionModelArgsInput } from './buildAppCompositionModelArgTypes'

export function buildAppCompositionModelArgs(
  input: BuildAppCompositionModelArgsInput,
): AppCompositionModelArgs {
  return {
    reviewInspectorArgs: buildAppCompositionReviewInspectorArgs(input),
    strategyWorkspaceDerivedStateArgs:
      buildAppCompositionStrategyWorkspaceDerivedStateArgs(input),
    strategyWorkspaceActionsArgs: buildAppCompositionStrategyWorkspaceActionsArgs(input),
    workspaceStatusArgs: buildAppCompositionWorkspaceStatusArgs(input),
  }
}
