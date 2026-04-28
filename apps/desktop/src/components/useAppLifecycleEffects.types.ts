import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { MarketDetail } from '../types'

export type ManualOrderState = {
  side: 'buy' | 'sell'
  quantity: string
  price: string
  note: string
}

export type UseAppLifecycleEffectsArgs = {
  workspaceBootstrapOverviewCardOrder: string[]
  visibleOverviewCards: string[]
  cardOrder: string[]
  setCardOrder: Dispatch<SetStateAction<string[]>>
  setVisibleOverviewCards: Dispatch<SetStateAction<string[]>>
  strategies: Array<{ id: string }> | undefined
  selectedStrategyId: string | null
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  marketDetail: MarketDetail | null
  manualOrderSymbolRef: MutableRefObject<string | null>
  setManualOrder: Dispatch<SetStateAction<ManualOrderState>>
  activeStrategyId: string | null
  strategyActivityQueryErrored: boolean
  strategyActivityQueryErrorMessage: string | null
  editingOrderId: string | null
  editingOrder: unknown
  setEditingOrderId: Dispatch<SetStateAction<string | null>>
  setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
}
