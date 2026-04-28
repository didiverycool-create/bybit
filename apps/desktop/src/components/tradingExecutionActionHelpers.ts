import { startTransition } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { OrderRecord } from '../types'
import { normalizeOrderInputValue } from '../utils/app-helpers'

export type ActionTone = 'success' | 'warning' | 'error'

export type ManualOrderState = {
  side: 'buy' | 'sell'
  quantity: string
  price: string
  note: string
}

type TradingEditorControls = {
  setEditingOrderId: Dispatch<SetStateAction<string | null>>
  setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
}

export function buildManualOrderDraft(order: OrderRecord): ManualOrderState {
  return {
    side: order.side,
    quantity: normalizeOrderInputValue(order.qty),
    price: normalizeOrderInputValue(order.price),
    note: '',
  }
}

export function clearManualOrderNote(setManualOrder: Dispatch<SetStateAction<ManualOrderState>>) {
  setManualOrder((current) => ({ ...current, note: '' }))
}

export function closeManualTradeEditor({
  setEditingOrderId,
  setManualTradePanelOpen,
}: TradingEditorControls) {
  setManualTradePanelOpen(false)
  setEditingOrderId(null)
}

export function closeManualTradeEditorIfEditing(
  editingOrderId: string | null,
  orderId: string,
  controls: TradingEditorControls,
) {
  if (editingOrderId !== orderId) return
  closeManualTradeEditor(controls)
}

export function resetManualTradeDraftAndCloseEditor(
  setManualOrder: Dispatch<SetStateAction<ManualOrderState>>,
  controls: TradingEditorControls,
) {
  clearManualOrderNote(setManualOrder)
  closeManualTradeEditor(controls)
}

export function buildTradeProbeTone(outcome: string): ActionTone {
  if (outcome === 'validation_rejected' || outcome === 'request_rejected') {
    return 'success'
  }
  if (outcome === 'permission_denied' || outcome === 'accepted_unexpectedly') {
    return 'warning'
  }
  return 'error'
}

export function syncManualOrderSymbol(
  setSelectedSymbol: Dispatch<SetStateAction<string>>,
  manualOrderSymbolRef: MutableRefObject<string | null>,
  symbol: string,
) {
  startTransition(() => setSelectedSymbol(symbol))
  manualOrderSymbolRef.current = symbol
}
