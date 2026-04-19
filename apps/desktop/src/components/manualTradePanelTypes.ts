import type { ExecutionPreview, Mode, OrderRecord } from '../types'

export type ManualOrderDraft = {
  side: 'buy' | 'sell'
  quantity: string
  price: string
  note: string
}

export type ManualTradeFormSectionProps = {
  editingOrder: OrderRecord | null
  manualOrder: ManualOrderDraft
  onManualOrderChange: (next: ManualOrderDraft) => void
}

export type ManualTradePreviewSectionProps = {
  selectedMode: Mode
  previewLoading: boolean
  preview?: ExecutionPreview
}

export type ManualTradeActionsSectionProps = {
  editingOrder: OrderRecord | null
  selectedMode: Mode
  blockedTitle: string
  blockedReason?: string | null
  serviceAvailable: boolean
  submitPending: boolean
  paperPending: boolean
  replacePending: boolean
  cancelPending: boolean
  onSubmitManual: () => void
  onSubmitPaper: () => void
  onReplace: () => void
  onCancelCurrent: () => void
}
