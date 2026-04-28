import { useEffect } from 'react'

import { shouldResetEditingOrderState } from './shouldResetEditingOrderState'
import type { UseAppLifecycleEffectsArgs } from './useAppLifecycleEffects.types'

export function useAppLifecycleEffectsEditingOrder({
  editingOrderId,
  editingOrder,
  setEditingOrderId,
  setManualTradePanelOpen,
}: Pick<
  UseAppLifecycleEffectsArgs,
  'editingOrderId' | 'editingOrder' | 'setEditingOrderId' | 'setManualTradePanelOpen'
>) {
  useEffect(() => {
    if (shouldResetEditingOrderState({ editingOrderId, editingOrder })) {
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    }
  }, [editingOrder, editingOrderId, setEditingOrderId, setManualTradePanelOpen])
}
