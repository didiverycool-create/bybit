import { useDesktopNotificationChannelsCoordinator } from './useDesktopNotificationChannelsCoordinator'
import type { UseDesktopNotificationEffectsArgs } from './useDesktopNotificationEffects.types'

export type { UseDesktopNotificationEffectsArgs } from './useDesktopNotificationEffects.types'

export function useDesktopNotificationEffects({
  ...args
}: UseDesktopNotificationEffectsArgs) {
  useDesktopNotificationChannelsCoordinator(args)
}
