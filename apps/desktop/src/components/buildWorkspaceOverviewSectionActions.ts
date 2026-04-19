import type { BuildWorkspaceSectionActionsResult } from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionOpsConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

type BuildWorkspaceOverviewSectionActionsArgs = Pick<
  BuildWorkspaceSectionOpsConsumerArgs,
  'navigationActions' | 'marketSelectionActions'
>

export type BuildWorkspaceOverviewSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'overviewWorkspaceActions'
>

export function buildWorkspaceOverviewSectionActions({
  navigationActions,
  marketSelectionActions,
}: BuildWorkspaceOverviewSectionActionsArgs): BuildWorkspaceOverviewSectionActionsResult {
  return {
    overviewWorkspaceActions: {
      onSelectMarketSymbol: marketSelectionActions.onSelectMarketSymbol,
      onSelectMarketTimeframe: marketSelectionActions.onSelectMarketTimeframe,
      onOpenReviewInspector: navigationActions.openReviewInspector,
      onOpenBacktestDetail: navigationActions.openBacktestDetail,
      onOpenSourceReview: navigationActions.openSourceReview,
      onOpenStrategyProposal: navigationActions.openStrategyProposal,
      onOpenStrategyActivity: navigationActions.openStrategyActivity,
      onOpenAiSchedulerJob: navigationActions.openAiSchedulerJob,
    },
  }
}
