import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceSectionActionsArgsInput } from './buildAppWorkspaceSectionActionsArgs'
import { buildWorkspaceSectionSurfaceSourceGroups } from './buildWorkspaceSectionSurfaceSourceGroups'

export function buildWorkspaceSectionSurfaceArgs(
  source: BuildAppPresentationModelsArgs,
): BuildAppWorkspaceSectionActionsArgsInput {
  const {
    workspaceSectionCoreSource,
    workspaceSectionActionSource,
    workspaceSectionSetterSource,
  } = buildWorkspaceSectionSurfaceSourceGroups(source)

  return {
    ...workspaceSectionCoreSource,
    ...workspaceSectionActionSource,
    setters: workspaceSectionSetterSource,
  }
}
