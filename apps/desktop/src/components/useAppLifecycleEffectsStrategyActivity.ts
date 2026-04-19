import { useEffect } from 'react'

import type { UseAppLifecycleEffectsArgs } from './useAppLifecycleEffects.types'

export function useAppLifecycleEffectsStrategyActivity({
  strategyActivityQueryErrored,
  strategyActivityQueryErrorMessage,
  activeStrategyId,
}: Pick<
  UseAppLifecycleEffectsArgs,
  'strategyActivityQueryErrored' | 'strategyActivityQueryErrorMessage' | 'activeStrategyId'
>) {
  useEffect(() => {
    if (!strategyActivityQueryErrored) {
      return
    }
    console.error('[strategy-activity-query:error]', {
      strategyId: activeStrategyId,
      message: strategyActivityQueryErrorMessage || 'unknown error',
    })
  }, [activeStrategyId, strategyActivityQueryErrored, strategyActivityQueryErrorMessage])
}
