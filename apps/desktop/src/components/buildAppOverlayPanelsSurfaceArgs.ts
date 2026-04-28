import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'
import {
  buildAppOverlayPanelsSurfaceDataArgs,
  type BuildAppOverlayPanelsSurfaceDataBundleArgsInput,
} from './buildAppOverlayPanelsSurfaceDataArgs'
import {
  buildAppOverlayPanelsSurfaceStateArgs,
  type BuildAppOverlayPanelsSurfaceStateArgsInput,
} from './buildAppOverlayPanelsSurfaceStateArgs'

type AppOverlayPanelsSurfaceArgs = BuildAppSurfaceModelsArgsInput['appOverlayPanels']

export type BuildAppOverlayPanelsSurfaceArgsInput =
  BuildAppOverlayPanelsSurfaceStateArgsInput & BuildAppOverlayPanelsSurfaceDataBundleArgsInput

export function buildAppOverlayPanelsSurfaceArgs({
  ...input
}: BuildAppOverlayPanelsSurfaceArgsInput): AppOverlayPanelsSurfaceArgs {
  return {
    ...buildAppOverlayPanelsSurfaceStateArgs(input),
    ...buildAppOverlayPanelsSurfaceDataArgs(input),
  }
}
