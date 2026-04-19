import type {
  AppInteractionStrategyWorkflowArgs,
} from './buildAppInteractionModelsArgsShared'
import type { AppInteractionStrategyWorkflowSource } from './buildAppInteractionModelsSourceGroups'

export function buildAppInteractionStrategyWorkflowArgs({
  ...source
}: AppInteractionStrategyWorkflowSource): AppInteractionStrategyWorkflowArgs {
  return source
}
