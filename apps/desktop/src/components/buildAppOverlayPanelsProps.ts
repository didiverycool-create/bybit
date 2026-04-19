import {
  buildAppOverlayPanelsAssembler,
  type BuildAppOverlayPanelsAssemblerArgs,
} from './buildAppOverlayPanelsAssembler'

export type BuildAppOverlayPanelsPropsArgs = BuildAppOverlayPanelsAssemblerArgs

export function buildAppOverlayPanelsProps(args: BuildAppOverlayPanelsPropsArgs) {
  return buildAppOverlayPanelsAssembler(args)
}
