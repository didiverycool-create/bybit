import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import { buildAppOverlayPanelsSurfaceArgs } from './buildAppOverlayPanelsSurfaceArgs'
import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'
import { buildAppSurfaceOverlayPanelsDataArgs } from './buildAppSurfaceOverlayPanelsDataArgs'
import { buildAppSurfaceOverlayPanelsPanelArgs } from './buildAppSurfaceOverlayPanelsPanelArgs'

export type BuildAppSurfaceOverlayPanelsArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAppSurfaceOverlayPanelsArgs({
  source,
}: BuildAppSurfaceOverlayPanelsArgsInput): BuildAppSurfaceModelsArgsInput['appOverlayPanels'] {
  return buildAppOverlayPanelsSurfaceArgs({
    ...buildAppSurfaceOverlayPanelsPanelArgs({ source }),
    ...buildAppSurfaceOverlayPanelsDataArgs({ source }),
  })
}
