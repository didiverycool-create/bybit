import { useEffect } from 'react'

import { buildOverviewCardRecoveryState } from '../utils/workspace-helpers'
import type { UseAppLifecycleEffectsArgs } from './useAppLifecycleEffects.types'

export function useAppLifecycleEffectsOverviewCards({
  workspaceBootstrapOverviewCardOrder,
  visibleOverviewCards,
  cardOrder,
  setCardOrder,
  setVisibleOverviewCards,
}: Pick<
  UseAppLifecycleEffectsArgs,
  | 'workspaceBootstrapOverviewCardOrder'
  | 'visibleOverviewCards'
  | 'cardOrder'
  | 'setCardOrder'
  | 'setVisibleOverviewCards'
>) {
  useEffect(() => {
    const recoveryState = buildOverviewCardRecoveryState({
      workspaceBootstrapOverviewCardOrder,
      visibleOverviewCards,
    })

    if (!recoveryState) {
      return
    }

    if (JSON.stringify(recoveryState.nextCardOrder) !== JSON.stringify(cardOrder)) {
      setCardOrder(recoveryState.nextCardOrder)
    }
    if (JSON.stringify(recoveryState.nextVisibleOverviewCards) !== JSON.stringify(visibleOverviewCards)) {
      setVisibleOverviewCards(recoveryState.nextVisibleOverviewCards)
    }
  }, [
    cardOrder,
    setCardOrder,
    setVisibleOverviewCards,
    visibleOverviewCards,
    workspaceBootstrapOverviewCardOrder,
  ])
}
