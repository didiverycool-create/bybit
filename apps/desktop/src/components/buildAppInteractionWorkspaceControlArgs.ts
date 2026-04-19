import type {
  AppInteractionWorkspaceControlArgs,
} from './buildAppInteractionModelsArgsShared'
import type { AppInteractionWorkspaceControlSource } from './buildAppInteractionModelsSourceGroups'

export function buildAppInteractionWorkspaceControlArgs({
  ...source
}: AppInteractionWorkspaceControlSource): AppInteractionWorkspaceControlArgs {
  return source
}
