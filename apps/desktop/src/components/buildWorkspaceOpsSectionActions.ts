import type {
  BuildWorkspaceSectionActionsResult,
} from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionOpsConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'
import { buildWorkspaceAlertsSectionActions } from './buildWorkspaceAlertsSectionActions'
import { buildWorkspaceAuditSectionActions } from './buildWorkspaceAuditSectionActions'
import { buildWorkspaceMarketSectionActions } from './buildWorkspaceMarketSectionActions'
import { buildWorkspaceNewsSectionActions } from './buildWorkspaceNewsSectionActions'
import { buildWorkspaceOverviewSectionActions } from './buildWorkspaceOverviewSectionActions'
import { buildWorkspaceSchedulerSectionActions } from './buildWorkspaceSchedulerSectionActions'
import { buildWorkspaceSettingsSectionActions } from './buildWorkspaceSettingsSectionActions'
import { buildWorkspaceTradesSectionActions } from './buildWorkspaceTradesSectionActions'

export type BuildWorkspaceOpsSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  | 'schedulerWorkspaceActions'
  | 'overviewWorkspaceActions'
  | 'settingsWorkspaceActions'
  | 'marketWorkspaceActions'
  | 'alertsWorkspaceActions'
  | 'tradesWorkspaceActions'
  | 'auditWorkspaceActions'
  | 'newsWorkspaceProps'
>

export function buildWorkspaceOpsSectionActions(
  args: BuildWorkspaceSectionOpsConsumerArgs,
): BuildWorkspaceOpsSectionActionsResult {
  return {
    ...buildWorkspaceSchedulerSectionActions(args),
    ...buildWorkspaceOverviewSectionActions(args),
    ...buildWorkspaceSettingsSectionActions(args),
    ...buildWorkspaceMarketSectionActions(args),
    ...buildWorkspaceAlertsSectionActions(args),
    ...buildWorkspaceTradesSectionActions(args),
    ...buildWorkspaceAuditSectionActions(args),
    ...buildWorkspaceNewsSectionActions(args),
  }
}
