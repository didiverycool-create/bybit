import type { BuildTradingExecutionActionHandlersArgs } from './buildTradingExecutionActionHandlers'
import { clearManualOrderNote } from './tradingExecutionActionHelpers'
import { runTradingExecutionAction } from './tradingExecutionAsyncHelpers'

type TradingExecutionSubmissionActionArgs = Pick<
  BuildTradingExecutionActionHandlersArgs,
  | 'marketDetail'
  | 'selectedMode'
  | 'manualOrder'
  | 'manualOrderQuantity'
  | 'manualOrderPrice'
  | 'manualTradingBlockedReason'
  | 'setManualOrder'
  | 'showFeedback'
  | 'mutations'
>

function buildManualOrderRequest({
  marketDetail,
  selectedMode,
  manualOrder,
  manualOrderQuantity,
  manualOrderPrice,
}: Pick<
  TradingExecutionSubmissionActionArgs,
  'marketDetail' | 'selectedMode' | 'manualOrder' | 'manualOrderQuantity' | 'manualOrderPrice'
>) {
  if (!marketDetail) return null

  return {
    symbol: marketDetail.symbol,
    market: marketDetail.market,
    mode: selectedMode,
    side: manualOrder.side,
    quantity: manualOrderQuantity,
    price: manualOrderPrice,
    note: manualOrder.note,
  }
}

function buildSubmitManualOrderAction({
  marketDetail,
  selectedMode,
  manualOrder,
  manualOrderQuantity,
  manualOrderPrice,
  manualTradingBlockedReason,
  setManualOrder,
  showFeedback,
  mutations,
}: TradingExecutionSubmissionActionArgs) {
  return async () => {
    if (!marketDetail) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能提交手动交易', manualTradingBlockedReason)
      return
    }

    await runTradingExecutionAction({
      execute: async () => {
        const request = buildManualOrderRequest({
          marketDetail,
          selectedMode,
          manualOrder,
          manualOrderQuantity,
          manualOrderPrice,
        })
        if (!request) return null

        if (selectedMode === 'paper') {
          await mutations.manualTradeMutation.mutateAsync(request)
          return null
        }

        return mutations.exchangeOrderMutation.mutateAsync(request)
      },
      failureTitle: '手动交易提交失败',
      showFeedback,
      onSuccess: async (order) => {
        if (selectedMode === 'paper') {
          if (!marketDetail) return
          showFeedback(
            'success',
            '手动交易已写入量化控制链路',
            `${marketDetail.symbol} 的 Paper 手动交易已记录并写入审计日志。`,
          )
        } else if (order) {
          showFeedback(
            'success',
            `${selectedMode.toUpperCase()} 委托已提交`,
            `${order.symbol} 已向 Bybit 提交 ${order.side === 'buy' ? '买入' : '卖出'} 限价委托，订单号 ${order.order_id}。`,
          )
        }
        clearManualOrderNote(setManualOrder)
      },
    })
  }
}

function buildSubmitPaperOrderAction({
  marketDetail,
  selectedMode,
  manualOrder,
  manualOrderQuantity,
  manualOrderPrice,
  manualTradingBlockedReason,
  setManualOrder,
  showFeedback,
  mutations,
}: TradingExecutionSubmissionActionArgs) {
  return async () => {
    if (!marketDetail) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能创建本地限价委托', manualTradingBlockedReason)
      return
    }

    await runTradingExecutionAction({
      execute: async () => {
        const request = buildManualOrderRequest({
          marketDetail,
          selectedMode,
          manualOrder,
          manualOrderQuantity,
          manualOrderPrice,
        })
        if (!request) return null
        return mutations.paperOrderMutation.mutateAsync(request)
      },
      failureTitle: 'Paper 限价委托创建失败',
      showFeedback,
      onSuccess: (order) => {
        if (!order) return
        showFeedback(
          'success',
          'Paper 限价委托已挂入本地委托簿',
          `${order.symbol} ${order.side === 'buy' ? '买单' : '卖单'} 已进入未成交委托列表。`,
        )
        clearManualOrderNote(setManualOrder)
      },
    })
  }
}

export function buildTradingExecutionSubmissionActionHandlers({
  marketDetail,
  selectedMode,
  manualOrder,
  manualOrderQuantity,
  manualOrderPrice,
  manualTradingBlockedReason,
  setManualOrder,
  showFeedback,
  mutations,
}: TradingExecutionSubmissionActionArgs) {
  return {
    submitManualOrder: buildSubmitManualOrderAction({
      marketDetail,
      selectedMode,
      manualOrder,
      manualOrderQuantity,
      manualOrderPrice,
      manualTradingBlockedReason,
      setManualOrder,
      showFeedback,
      mutations,
    }),
    submitPaperOrder: buildSubmitPaperOrderAction({
      marketDetail,
      selectedMode,
      manualOrder,
      manualOrderQuantity,
      manualOrderPrice,
      manualTradingBlockedReason,
      setManualOrder,
      showFeedback,
      mutations,
    }),
  }
}
