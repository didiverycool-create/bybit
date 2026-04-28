import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'
import { buildAlertsWorkspaceSurfaceArgs } from './buildAlertsWorkspaceSurfaceArgs'
import { buildBacktestWorkspaceSurfaceArgs } from './buildBacktestWorkspaceSurfaceArgs'
import { buildStrategyWorkspaceSurfaceArgs } from './buildStrategyWorkspaceSurfaceArgs'
import { buildMarketWorkspaceSurfaceArgs } from './buildMarketWorkspaceSurfaceArgs'
import { buildOverviewWorkspaceSurfaceArgs } from './buildOverviewWorkspaceSurfaceArgs'
import { buildAuditWorkspaceSurfaceArgs } from './buildAuditWorkspaceSurfaceArgs'
import { buildReplayWorkspaceSurfaceArgs } from './buildReplayWorkspaceSurfaceArgs'
import { buildTradesWorkspaceSurfaceArgs } from './buildTradesWorkspaceSurfaceArgs'
import { buildSchedulerWorkspaceSurfaceArgs } from './buildSchedulerWorkspaceSurfaceArgs'
import { buildSettingsWorkspaceSurfaceArgs } from './buildSettingsWorkspaceSurfaceArgs'
import { buildWorkspaceSectionSurfaceArgs } from './buildWorkspaceSectionSurfaceArgs'

export type BuildAppWorkspaceModelsSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAppWorkspaceModelsSurfaceArgs({
  source,
}: BuildAppWorkspaceModelsSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput {
  return {
    workspaceSection: buildWorkspaceSectionSurfaceArgs(source),
    strategyWorkspace: buildStrategyWorkspaceSurfaceArgs({ source }),
    backtestWorkspace: buildBacktestWorkspaceSurfaceArgs({ source }),
    schedulerWorkspace: buildSchedulerWorkspaceSurfaceArgs({ source }),
    overviewWorkspace: buildOverviewWorkspaceSurfaceArgs({ source }),
    settingsWorkspace: buildSettingsWorkspaceSurfaceArgs({ source }),
    marketWorkspace: buildMarketWorkspaceSurfaceArgs({ source }),
    alertsWorkspace: buildAlertsWorkspaceSurfaceArgs({ source }),
    tradesWorkspace: buildTradesWorkspaceSurfaceArgs({ source }),
    replayWorkspace: buildReplayWorkspaceSurfaceArgs({ source }),
    auditWorkspace: buildAuditWorkspaceSurfaceArgs({ source }),
  }
}
