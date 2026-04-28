import type { AppOverlayPanelsContainerProps } from './AppOverlayPanelsContainer.types'
import type { AppOverlayPanelsHostProps } from './AppOverlayPanelsHost'

type AppOverlayPanelsTradingAccountHostPropsArgs = Pick<
  AppOverlayPanelsContainerProps,
  'manualTradeState' | 'manualTradeActions' | 'orderHistoryState' | 'orderHistoryActions' | 'accountInspectorState' | 'accountInspectorActions'
>

export function buildAppOverlayPanelsTradingAccountHostProps({
  manualTradeState,
  manualTradeActions,
  orderHistoryState,
  orderHistoryActions,
  accountInspectorState,
  accountInspectorActions,
}: AppOverlayPanelsTradingAccountHostPropsArgs): Pick<
  AppOverlayPanelsHostProps,
  'manualTradePanelProps' | 'orderHistoryPanelProps' | 'accountInspectorPanelProps'
> {
  return {
    manualTradePanelProps: {
      ...manualTradeState,
      onClose: manualTradeActions.onClose,
      onManualOrderChange: manualTradeActions.setManualOrder,
      onSubmitManual: manualTradeActions.onSubmitManual,
      onSubmitPaper: manualTradeActions.onSubmitPaper,
      onReplace: manualTradeActions.onReplace,
      onCancelCurrent: manualTradeActions.onCancelCurrent,
    },
    orderHistoryPanelProps: {
      ...orderHistoryState,
      onClose: () => orderHistoryActions.setOpen(false),
      onTradeOriginFilterChange: orderHistoryActions.setTradeOriginFilter,
      onTradeScopeToggle: () =>
        orderHistoryActions.setTradeScopeFilter((current) => (current === 'selected' ? 'all' : 'selected')),
    },
    accountInspectorPanelProps: {
      ...accountInspectorState,
      onClose: () => accountInspectorActions.setOpen(false),
      onProbeTradeRoute: accountInspectorActions.onProbeTradeRoute,
    },
  }
}
