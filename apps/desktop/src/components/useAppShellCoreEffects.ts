import { useAppShellCoreDerivedModels } from './useAppShellCoreDerivedModels'
import { useAppShellCoreNotificationEffects } from './useAppShellCoreNotificationEffects'
import { useAppShellCoreRealtimeEffects } from './useAppShellCoreRealtimeEffects'
import type { UseAppShellCoreEffectsArgs } from './useAppShellCoreEffects.types'

export type { UseAppShellCoreEffectsArgs } from './useAppShellCoreEffects.types'

export function useAppShellCoreEffects({
  queryClient,
  workspaceBootstrapState,
  controlDataQueryModel,
  desktopUiActions,
  marketWorkspaceModel,
}: UseAppShellCoreEffectsArgs) {
  const coreEffectsSource = {
    queryClient,
    workspaceBootstrapState,
    controlDataQueryModel,
    marketWorkspaceModel,
  }
  useAppShellCoreRealtimeEffects(coreEffectsSource)

  const appShellCoreDerivedModels = useAppShellCoreDerivedModels({
    workspaceBootstrapState,
    controlDataQueryModel,
    marketWorkspaceModel,
  })

  const notificationEffectsSource = {
    workspaceBootstrapState,
    controlDataQueryModel,
    desktopUiActions,
    runtimeAndSettingsModel: appShellCoreDerivedModels.runtimeAndSettingsModel,
  }
  useAppShellCoreNotificationEffects(notificationEffectsSource)

  return {
    ...appShellCoreDerivedModels,
  }
}
