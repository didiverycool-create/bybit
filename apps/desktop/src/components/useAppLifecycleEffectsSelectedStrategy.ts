import { useEffect } from 'react'

import { resolveSelectedStrategyId } from './resolveSelectedStrategyId'
import type { UseAppLifecycleEffectsArgs } from './useAppLifecycleEffects.types'

export function useAppLifecycleEffectsSelectedStrategy({
  strategies,
  selectedStrategyId,
  setSelectedStrategyId,
}: Pick<
  UseAppLifecycleEffectsArgs,
  'strategies' | 'selectedStrategyId' | 'setSelectedStrategyId'
>) {
  useEffect(() => {
    const nextSelectedStrategyId = resolveSelectedStrategyId({
      strategies,
      selectedStrategyId,
    })
    if (nextSelectedStrategyId && nextSelectedStrategyId !== selectedStrategyId) {
      setSelectedStrategyId(nextSelectedStrategyId)
    }
  }, [selectedStrategyId, setSelectedStrategyId, strategies])
}
