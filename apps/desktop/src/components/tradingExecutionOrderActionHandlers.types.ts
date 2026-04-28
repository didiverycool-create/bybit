import type { BuildTradingExecutionActionHandlersArgs } from './buildTradingExecutionActionHandlers'

type TradingExecutionEditorControls = Pick<
  BuildTradingExecutionActionHandlersArgs,
  'setEditingOrderId' | 'setManualTradePanelOpen'
>

export type TradingExecutionOrderActionArgs = Pick<
  BuildTradingExecutionActionHandlersArgs,
  | 'editingOrderId'
  | 'manualOrderQuantity'
  | 'manualOrderPrice'
  | 'manualTradingBlockedReason'
  | 'setManualOrder'
  | 'showFeedback'
  | 'mutations'
> & {
  manualTradeEditorControls: TradingExecutionEditorControls
}
