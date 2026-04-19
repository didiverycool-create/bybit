import type {
  AppInteractionNavigationArgs,
  BuildAppInteractionModelsArgsInput,
} from './buildAppInteractionModelsArgsShared'
import {
  buildAppInteractionNavigationReviewArgs,
  type BuildAppInteractionNavigationReviewArgs,
} from './buildAppInteractionNavigationReviewArgs'
import {
  buildAppInteractionNavigationScopeArgs,
  type BuildAppInteractionNavigationScopeArgs,
} from './buildAppInteractionNavigationScopeArgs'
import {
  buildAppInteractionNavigationSelectionArgs,
  type BuildAppInteractionNavigationSelectionArgs,
} from './buildAppInteractionNavigationSelectionArgs'

export function buildAppInteractionNavigationArgs({
  ...input
}: BuildAppInteractionModelsArgsInput): AppInteractionNavigationArgs {
  const selectionArgs: BuildAppInteractionNavigationSelectionArgs =
    buildAppInteractionNavigationSelectionArgs(input)
  const reviewArgs: BuildAppInteractionNavigationReviewArgs =
    buildAppInteractionNavigationReviewArgs(input)
  const scopeArgs: BuildAppInteractionNavigationScopeArgs =
    buildAppInteractionNavigationScopeArgs(input)

  return {
    ...selectionArgs,
    ...reviewArgs,
    ...scopeArgs,
  }
}
