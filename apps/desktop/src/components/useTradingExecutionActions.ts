import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { MarketDetail, Mode } from '../types'

import type { ActionTone, ManualOrderState } from './tradingExecutionActionHelpers'
import { buildTradingExecutionActionHandlers } from './buildTradingExecutionActionHandlers'
import { useTradingExecutionMutations } from './useTradingExecutionMutations'

type UseTradingExecutionActionsArgs = {
  refreshControlData: () => Promise<void>
  marketDetail: MarketDetail | null | undefined
  selectedMode: Mode
  manualOrder: ManualOrderState
  manualOrderQuantity: number
  manualOrderPrice: number
  manualTradingBlockedReason: string | null
  editingOrderId: string | null
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setManualOrder: Dispatch<SetStateAction<ManualOrderState>>
  setEditingOrderId: Dispatch<SetStateAction<string | null>>
  setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
  manualOrderSymbolRef: MutableRefObject<string | null>
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
}

export function useTradingExecutionActions(args: UseTradingExecutionActionsArgs) {
  const mutations = useTradingExecutionMutations({
    refreshControlData: args.refreshControlData,
  })

  return buildTradingExecutionActionHandlers({
    ...args,
    mutations,
  })
}
