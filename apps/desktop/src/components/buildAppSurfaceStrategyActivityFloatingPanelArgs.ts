import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import { buildAppSurfaceStrategyActivityFloatingPanelActionArgs } from './buildAppSurfaceStrategyActivityFloatingPanelActionArgs'
import { buildAppSurfaceStrategyActivityFloatingPanelDataArgs } from './buildAppSurfaceStrategyActivityFloatingPanelDataArgs'
import { buildStrategyActivityFloatingPanelSurfaceArgs } from './buildStrategyActivityFloatingPanelSurfaceArgs'
import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'

export type BuildAppSurfaceStrategyActivityFloatingPanelArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAppSurfaceStrategyActivityFloatingPanelArgs({
  source,
}: BuildAppSurfaceStrategyActivityFloatingPanelArgsInput): BuildAppSurfaceModelsArgsInput['strategyActivityFloatingPanel'] {
  return buildStrategyActivityFloatingPanelSurfaceArgs({
    ...buildAppSurfaceStrategyActivityFloatingPanelDataArgs({ source }),
    ...buildAppSurfaceStrategyActivityFloatingPanelActionArgs({ source }),
  })
}
