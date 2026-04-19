import type { ComponentProps, Dispatch, SetStateAction } from 'react'

import AppOverlayPanelsContainer from './AppOverlayPanelsContainer'
import type { useTradingExecutionActions } from './useTradingExecutionActions'

type AppOverlayPanelsProps = ComponentProps<typeof AppOverlayPanelsContainer>
type TradingExecutionActionsModel = ReturnType<typeof useTradingExecutionActions>
type ManualOrderState = AppOverlayPanelsProps['manualTradeState']['manualOrder']

export type BuildAppOverlayPanelsTradingAccountPropsArgs = {
  panelState: {
    manualTradePanelOpen: boolean
    orderHistoryPanelOpen: boolean
    accountInspectorOpen: boolean
  }
  panelSetters: {
    setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
    setOrderHistoryPanelOpen: Dispatch<SetStateAction<boolean>>
    setAccountInspectorOpen: Dispatch<SetStateAction<boolean>>
    setManualOrder: Dispatch<SetStateAction<ManualOrderState>>
    setTradeOriginFilter: Dispatch<SetStateAction<'all' | 'manual' | 'strategy' | 'exchange'>>
    setTradeScopeFilter: Dispatch<SetStateAction<'all' | 'selected'>>
  }
  tradingExecutionActions: TradingExecutionActionsModel
  dataState: {
    serviceAvailable: boolean
    settings: {
      bybit_web_entry?: string | null
    } | null | undefined
    selectedMode: AppOverlayPanelsProps['manualTradeState']['selectedMode']
    selectedSymbol: string
    editingOrder: AppOverlayPanelsProps['manualTradeState']['editingOrder']
    manualOrder: ManualOrderState
    manualTradePreviewLoading: boolean
    manualTradePreview: AppOverlayPanelsProps['manualTradeState']['preview']
    manualTradingBlockedReason: string | null
    accountOverview: AppOverlayPanelsProps['accountInspectorState']['accountOverview']
    bybitPrivateStatus: AppOverlayPanelsProps['accountInspectorState']['bybitPrivateStatus']
    bybitPublicStatus: AppOverlayPanelsProps['accountInspectorState']['bybitPublicStatus']
    tradeProbeResult: AppOverlayPanelsProps['accountInspectorState']['tradeProbeResult']
    tradeProbePending: AppOverlayPanelsProps['accountInspectorState']['tradeProbePending']
    tradeOriginFilter: AppOverlayPanelsProps['orderHistoryState']['tradeOriginFilter']
    tradeScopeFilter: AppOverlayPanelsProps['orderHistoryState']['tradeScopeFilter']
    filteredOrderHistory: AppOverlayPanelsProps['orderHistoryState']['filteredOrderHistory']
  }
  pendingState: {
    manualTradeMutationPending: boolean
    exchangeOrderMutationPending: boolean
    paperOrderMutationPending: boolean
    replacePaperOrderPending: boolean
    replaceExchangeOrderPending: boolean
    cancelPaperOrderPending: boolean
    cancelExchangeOrderPending: boolean
  }
}

export function buildAppOverlayPanelsTradingAccountProps({
  panelState,
  panelSetters,
  tradingExecutionActions,
  dataState,
  pendingState,
}: BuildAppOverlayPanelsTradingAccountPropsArgs): Pick<
  AppOverlayPanelsProps,
  | 'manualTradeState'
  | 'manualTradeActions'
  | 'orderHistoryState'
  | 'orderHistoryActions'
  | 'accountInspectorState'
  | 'accountInspectorActions'
> {
  const manualTradeSubmitPending = Boolean(
    dataState.manualTradingBlockedReason ||
      pendingState.manualTradeMutationPending ||
      pendingState.exchangeOrderMutationPending,
  )
  const manualTradePaperPending = Boolean(
    dataState.manualTradingBlockedReason || pendingState.paperOrderMutationPending,
  )
  const manualTradeReplacePending = Boolean(
    dataState.manualTradingBlockedReason ||
      pendingState.replacePaperOrderPending ||
      pendingState.replaceExchangeOrderPending,
  )
  const manualTradeCancelPending = Boolean(
    !dataState.serviceAvailable ||
      pendingState.cancelPaperOrderPending ||
      pendingState.cancelExchangeOrderPending,
  )

  return {
    manualTradeState: {
      open: panelState.manualTradePanelOpen,
      selectedMode: dataState.selectedMode,
      selectedSymbol: dataState.selectedSymbol,
      editingOrder: dataState.editingOrder,
      manualOrder: dataState.manualOrder,
      previewLoading: dataState.manualTradePreviewLoading,
      preview: dataState.manualTradePreview,
      blockedReason: dataState.manualTradingBlockedReason,
      serviceAvailable: dataState.serviceAvailable,
      submitPending: manualTradeSubmitPending,
      paperPending: manualTradePaperPending,
      replacePending: manualTradeReplacePending,
      cancelPending: manualTradeCancelPending,
    },
    manualTradeActions: {
      onClose: tradingExecutionActions.closeManualTradePanel,
      setManualOrder: panelSetters.setManualOrder,
      onSubmitManual: tradingExecutionActions.submitManualOrder,
      onSubmitPaper: tradingExecutionActions.submitPaperOrder,
      onReplace:
        dataState.editingOrder?.source === 'paper'
          ? tradingExecutionActions.replacePaperOrder
          : tradingExecutionActions.replaceExchangeOrder,
      onCancelCurrent: () => {
        if (!dataState.editingOrder) {
          return
        }
        if (dataState.editingOrder.source === 'paper') {
          void tradingExecutionActions.cancelPaperOrder(dataState.editingOrder.order_id)
          return
        }
        void tradingExecutionActions.cancelExchangeOrder(dataState.editingOrder.order_id)
      },
    },
    orderHistoryState: {
      open: panelState.orderHistoryPanelOpen,
      tradeOriginFilter: dataState.tradeOriginFilter,
      tradeScopeFilter: dataState.tradeScopeFilter,
      selectedSymbol: dataState.selectedSymbol,
      accountSource: dataState.accountOverview?.source,
      bybitWebEntry: dataState.settings?.bybit_web_entry ?? 'https://www.bybit-global.com/',
      filteredOrderHistory: dataState.filteredOrderHistory,
    },
    orderHistoryActions: {
      setOpen: panelSetters.setOrderHistoryPanelOpen,
      setTradeOriginFilter: panelSetters.setTradeOriginFilter,
      setTradeScopeFilter: panelSetters.setTradeScopeFilter,
    },
    accountInspectorState: {
      open: panelState.accountInspectorOpen,
      accountOverview: dataState.accountOverview,
      bybitPrivateStatus: dataState.bybitPrivateStatus,
      bybitPublicStatus: dataState.bybitPublicStatus,
      bybitWebEntry: dataState.settings?.bybit_web_entry ?? 'https://www.bybit-global.com/',
      tradeProbeResult: dataState.tradeProbeResult,
      tradeProbePending: dataState.tradeProbePending,
    },
    accountInspectorActions: {
      setOpen: panelSetters.setAccountInspectorOpen,
      onProbeTradeRoute: () => {
        void tradingExecutionActions.probeBybitTradeRoute()
      },
    },
  }
}
