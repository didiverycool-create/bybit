import { buildDesktopNotificationEffectsArgs } from './buildDesktopNotificationEffectsArgs'
import type { UseAppShellCoreEffectsArgs } from './useAppShellCoreEffects.types'
import { useDesktopNotificationEffects } from './useDesktopNotificationEffects'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'

type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>

type UseAppShellCoreNotificationEffectsArgs = Pick<
  UseAppShellCoreEffectsArgs,
  'workspaceBootstrapState' | 'controlDataQueryModel' | 'desktopUiActions'
> & {
  runtimeAndSettingsModel: RuntimeAndSettingsModel
}

export function useAppShellCoreNotificationEffects({
  workspaceBootstrapState,
  controlDataQueryModel,
  desktopUiActions,
  runtimeAndSettingsModel,
}: UseAppShellCoreNotificationEffectsArgs) {
  const desktopNotificationSource = {
    ...workspaceBootstrapState,
    ...controlDataQueryModel,
    ...runtimeAndSettingsModel,
    ...desktopUiActions,
  }

  useDesktopNotificationEffects(
    buildDesktopNotificationEffectsArgs(desktopNotificationSource),
  )
}
