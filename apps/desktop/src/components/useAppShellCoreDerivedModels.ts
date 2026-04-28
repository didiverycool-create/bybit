import { buildRuntimeAndSettingsModelArgs } from './buildRuntimeAndSettingsModelArgs'
import { buildStrategyWorkspaceCompositeModelArgs } from './buildStrategyWorkspaceCompositeModelArgs'
import type { UseAppShellCoreDerivedModelsArgs } from './useAppShellCoreEffects.types'
import { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'

export function useAppShellCoreDerivedModels({
  workspaceBootstrapState,
  controlDataQueryModel,
  marketWorkspaceModel,
}: UseAppShellCoreDerivedModelsArgs) {
  const coreQuerySource = {
    ...workspaceBootstrapState,
    ...controlDataQueryModel,
  }
  const runtimeAndSettingsSource = {
    ...coreQuerySource,
    ...marketWorkspaceModel,
  }
  const runtimeAndSettingsModel = useRuntimeAndSettingsModel(
    buildRuntimeAndSettingsModelArgs(runtimeAndSettingsSource),
  )
  const strategyWorkspaceCompositeModel = useStrategyWorkspaceCompositeModel(
    buildStrategyWorkspaceCompositeModelArgs(coreQuerySource),
  )

  return {
    runtimeAndSettingsModel,
    strategyWorkspaceCompositeModel,
  }
}
