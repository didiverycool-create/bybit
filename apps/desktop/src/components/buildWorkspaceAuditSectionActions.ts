import type { BuildWorkspaceSectionActionsResult } from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionOpsConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

type BuildWorkspaceAuditSectionActionsArgs = Pick<
  BuildWorkspaceSectionOpsConsumerArgs,
  'navigationActions' | 'setters'
>

export type BuildWorkspaceAuditSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'auditWorkspaceActions'
>

export function buildWorkspaceAuditSectionActions({
  navigationActions,
  setters,
}: BuildWorkspaceAuditSectionActionsArgs): BuildWorkspaceAuditSectionActionsResult {
  return {
    auditWorkspaceActions: {
      onAuditSeverityFilterChange: setters.setAuditSeverityFilter,
      onAuditSourceFilterChange: setters.setAuditSourceFilter,
      onToggleAuditScopeFilter: () =>
        setters.setAuditScopeFilter((current) => (current === 'selected' ? 'all' : 'selected')),
      onAuditSearchChange: setters.setAuditSearch,
      onOpenAiSchedulerJob: navigationActions.openAiSchedulerJob,
      onOpenReviewInspector: navigationActions.openReviewInspector,
      onOpenBacktestDetail: navigationActions.openBacktestDetail,
      onOpenSourceReview: navigationActions.openSourceReview,
      onOpenStrategyProposal: navigationActions.openStrategyProposal,
      onOpenStrategyActivity: navigationActions.openStrategyActivity,
    },
  }
}
