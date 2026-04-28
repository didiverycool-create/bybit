import { buildAppSurfaceModels } from './buildAppSurfaceModels'
import { buildAppSurfaceModelsArgs } from './buildAppSurfaceModelsArgs'
import { buildAppSurfaceModelsSurfaceArgs } from './buildAppSurfaceModelsSurfaceArgs'
import { buildAppWorkspaceModels } from './buildAppWorkspaceModels'
import { buildAppWorkspaceModelsArgs } from './buildAppWorkspaceModelsArgs'
import { buildAppWorkspaceModelsSurfaceArgs } from './buildAppWorkspaceModelsSurfaceArgs'
import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'

export type BuildAppPresentationModelsSurfaceWorkspaceProps = {
  appOverlayPanelsProps: ReturnType<typeof buildAppSurfaceModels>['appOverlayPanelsProps']
  strategyActivityFloatingPanelProps: ReturnType<typeof buildAppSurfaceModels>['strategyActivityFloatingPanelProps']
  appWorkspaceSectionOutletProps: {
    overviewWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['overviewWorkspaceProps']
    settingsWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['settingsWorkspaceProps']
    marketWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['marketWorkspaceProps']
    strategyWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['strategyWorkspaceProps']
    backtestWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['backtestWorkspaceProps']
    schedulerWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['schedulerWorkspaceProps']
    newsWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['newsWorkspaceProps']
    alertsWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['alertsWorkspaceProps']
    tradesWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['tradesWorkspaceProps']
    replayWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['replayWorkspaceProps']
    auditWorkspaceProps: ReturnType<typeof buildAppWorkspaceModels>['auditWorkspaceProps']
  }
}

export function buildAppPresentationModelsSurfaceWorkspaceProps(
  source: BuildAppPresentationModelsArgs,
): BuildAppPresentationModelsSurfaceWorkspaceProps {
  const { strategyActivityFloatingPanelProps, appOverlayPanelsProps } =
    buildAppSurfaceModels(buildAppSurfaceModelsArgs(buildAppSurfaceModelsSurfaceArgs({ source })))
  const {
    strategyWorkspaceProps,
    backtestWorkspaceProps,
    schedulerWorkspaceProps,
    overviewWorkspaceProps,
    settingsWorkspaceProps,
    marketWorkspaceProps,
    alertsWorkspaceProps,
    tradesWorkspaceProps,
    replayWorkspaceProps,
    auditWorkspaceProps,
    newsWorkspaceProps,
  } = buildAppWorkspaceModels(
    buildAppWorkspaceModelsArgs(buildAppWorkspaceModelsSurfaceArgs({ source })),
  )

  return {
    appOverlayPanelsProps,
    strategyActivityFloatingPanelProps,
    appWorkspaceSectionOutletProps: {
      overviewWorkspaceProps,
      settingsWorkspaceProps,
      marketWorkspaceProps,
      strategyWorkspaceProps,
      backtestWorkspaceProps,
      schedulerWorkspaceProps,
      newsWorkspaceProps,
      alertsWorkspaceProps,
      tradesWorkspaceProps,
      replayWorkspaceProps,
      auditWorkspaceProps,
    },
  }
}
