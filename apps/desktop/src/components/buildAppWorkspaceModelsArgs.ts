import type { BuildAppWorkspaceModelsArgs } from './buildAppWorkspaceModels'
import {
  buildAppBacktestWorkspaceModelArgs,
  type BuildAppBacktestWorkspaceModelArgsInput,
} from './buildAppBacktestWorkspaceModelArgs'
import { buildAppWorkspaceBaseArgs } from './buildAppWorkspaceBaseArgs'
import {
  buildAppWorkspaceSectionActionsArgs,
  type BuildAppWorkspaceSectionActionsArgsInput,
} from './buildAppWorkspaceSectionActionsArgs'

type StrategyWorkspaceInput = Omit<
  BuildAppWorkspaceModelsArgs['strategyWorkspace'],
  'baseArgs'
> &
  BuildAppWorkspaceModelsArgs['strategyWorkspace']['baseArgs']
type SchedulerWorkspaceInput = Omit<
  BuildAppWorkspaceModelsArgs['schedulerWorkspace'],
  'baseArgs'
> &
  BuildAppWorkspaceModelsArgs['schedulerWorkspace']['baseArgs']
type OverviewWorkspaceInput = Omit<
  BuildAppWorkspaceModelsArgs['overviewWorkspace'],
  'baseArgs'
> &
  BuildAppWorkspaceModelsArgs['overviewWorkspace']['baseArgs']
type SettingsWorkspaceInput = Omit<
  BuildAppWorkspaceModelsArgs['settingsWorkspace'],
  'baseArgs'
> &
  BuildAppWorkspaceModelsArgs['settingsWorkspace']['baseArgs']
type MarketWorkspaceInput = Omit<
  BuildAppWorkspaceModelsArgs['marketWorkspace'],
  'baseArgs'
> &
  BuildAppWorkspaceModelsArgs['marketWorkspace']['baseArgs']
type AlertsWorkspaceInput = Omit<
  BuildAppWorkspaceModelsArgs['alertsWorkspace'],
  'baseArgs'
> &
  BuildAppWorkspaceModelsArgs['alertsWorkspace']['baseArgs']
type TradesWorkspaceInput = Omit<
  BuildAppWorkspaceModelsArgs['tradesWorkspace'],
  'baseArgs'
> &
  BuildAppWorkspaceModelsArgs['tradesWorkspace']['baseArgs']
type ReplayWorkspaceInput = Omit<
  BuildAppWorkspaceModelsArgs['replayWorkspace'],
  'baseArgs'
> &
  BuildAppWorkspaceModelsArgs['replayWorkspace']['baseArgs']
type AuditWorkspaceInput = Omit<
  BuildAppWorkspaceModelsArgs['auditWorkspace'],
  'baseArgs'
> &
  BuildAppWorkspaceModelsArgs['auditWorkspace']['baseArgs']

export type BuildAppWorkspaceModelsArgsInput = {
  workspaceSection: BuildAppWorkspaceSectionActionsArgsInput
  strategyWorkspace: StrategyWorkspaceInput
  backtestWorkspace: BuildAppBacktestWorkspaceModelArgsInput
  schedulerWorkspace: SchedulerWorkspaceInput
  overviewWorkspace: OverviewWorkspaceInput
  settingsWorkspace: SettingsWorkspaceInput
  marketWorkspace: MarketWorkspaceInput
  alertsWorkspace: AlertsWorkspaceInput
  tradesWorkspace: TradesWorkspaceInput
  replayWorkspace: ReplayWorkspaceInput
  auditWorkspace: AuditWorkspaceInput
}

export function buildAppWorkspaceModelsArgs({
  workspaceSection,
  strategyWorkspace,
  backtestWorkspace,
  schedulerWorkspace,
  overviewWorkspace,
  settingsWorkspace,
  marketWorkspace,
  alertsWorkspace,
  tradesWorkspace,
  replayWorkspace,
  auditWorkspace,
}: BuildAppWorkspaceModelsArgsInput): BuildAppWorkspaceModelsArgs {
  return {
    workspaceSectionActionsArgs: buildAppWorkspaceSectionActionsArgs(workspaceSection),
    strategyWorkspace: buildAppWorkspaceBaseArgs(strategyWorkspace),
    backtestWorkspace: buildAppBacktestWorkspaceModelArgs(backtestWorkspace),
    schedulerWorkspace: buildAppWorkspaceBaseArgs(schedulerWorkspace),
    overviewWorkspace: buildAppWorkspaceBaseArgs(overviewWorkspace),
    settingsWorkspace: buildAppWorkspaceBaseArgs(settingsWorkspace),
    marketWorkspace: buildAppWorkspaceBaseArgs(marketWorkspace),
    alertsWorkspace: buildAppWorkspaceBaseArgs(alertsWorkspace),
    tradesWorkspace: buildAppWorkspaceBaseArgs(tradesWorkspace),
    replayWorkspace: buildAppWorkspaceBaseArgs(replayWorkspace),
    auditWorkspace: buildAppWorkspaceBaseArgs(auditWorkspace),
  }
}
