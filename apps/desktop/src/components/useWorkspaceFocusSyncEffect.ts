import { useEffect, useEffectEvent } from 'react'
import type { DependencyList } from 'react'

type UseWorkspaceFocusSyncEffectArgs = {
  enabled: boolean
  dependencies: DependencyList
  sync: () => void
}

export function useWorkspaceFocusSyncEffect({
  enabled,
  dependencies,
  sync,
}: UseWorkspaceFocusSyncEffectArgs) {
  const runSync = useEffectEvent(sync)

  useEffect(() => {
    if (!enabled) {
      return
    }
    runSync()
  }, [enabled, dependencies, runSync])
}
