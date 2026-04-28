import type {
  BuildWorkspaceSectionActionsResult,
} from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionStrategyConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'
import { buildBacktestWorkspaceSectionActions } from './buildBacktestWorkspaceSectionActions'
import { buildReplayWorkspaceSectionActions } from './buildReplayWorkspaceSectionActions'
import { buildStrategyWorkspaceSectionActions } from './buildStrategyWorkspaceSectionActions'

export type BuildWorkspaceStrategySectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'strategyWorkspaceActions' | 'backtestWorkspaceActions' | 'replayWorkspaceActions'
>

export function buildWorkspaceStrategySectionActions({
  ...consumerArgs
}: BuildWorkspaceSectionStrategyConsumerArgs): BuildWorkspaceStrategySectionActionsResult {
  return {
    ...buildStrategyWorkspaceSectionActions(consumerArgs),
    ...buildBacktestWorkspaceSectionActions(consumerArgs),
    ...buildReplayWorkspaceSectionActions(consumerArgs),
  }
}
