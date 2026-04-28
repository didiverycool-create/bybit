import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import { buildAppSurfaceOverlayPanelsArgs } from './buildAppSurfaceOverlayPanelsArgs'
import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'
import { buildAppSurfaceStrategyActivityFloatingPanelArgs } from './buildAppSurfaceStrategyActivityFloatingPanelArgs'

export type BuildAppSurfaceModelsSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAppSurfaceModelsSurfaceArgs({
  source,
}: BuildAppSurfaceModelsSurfaceArgsInput): BuildAppSurfaceModelsArgsInput {
  return {
    strategyActivityFloatingPanel: buildAppSurfaceStrategyActivityFloatingPanelArgs({ source }),
    appOverlayPanels: buildAppSurfaceOverlayPanelsArgs({ source }),
  }
}
