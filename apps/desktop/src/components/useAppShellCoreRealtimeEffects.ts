import { buildAppLifecycleEffectsArgs } from './buildAppLifecycleEffectsArgs'
import { buildLiveControlStreamsArgs } from './buildLiveControlStreamsArgs'
import { useAppLifecycleEffects } from './useAppLifecycleEffects'
import { useLiveControlStreams } from './useLiveControlStreams'
import type { UseAppShellCoreEffectsArgs } from './useAppShellCoreEffects.types'

type UseAppShellCoreRealtimeEffectsArgs = Pick<
  UseAppShellCoreEffectsArgs,
  'queryClient' | 'workspaceBootstrapState' | 'controlDataQueryModel' | 'marketWorkspaceModel'
>

export function useAppShellCoreRealtimeEffects({
  queryClient,
  workspaceBootstrapState,
  controlDataQueryModel,
  marketWorkspaceModel,
}: UseAppShellCoreRealtimeEffectsArgs) {
  const appLifecycleSource = {
    ...workspaceBootstrapState,
    ...controlDataQueryModel,
    ...marketWorkspaceModel,
  }
  useAppLifecycleEffects(
    buildAppLifecycleEffectsArgs(appLifecycleSource),
  )
  const liveControlStreamsSource = {
    ...workspaceBootstrapState,
    ...marketWorkspaceModel,
    queryClient,
  }
  useLiveControlStreams(
    buildLiveControlStreamsArgs(liveControlStreamsSource),
  )
}
