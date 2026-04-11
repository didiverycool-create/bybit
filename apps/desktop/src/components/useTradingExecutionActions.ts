import { startTransition } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useMutation } from '@tanstack/react-query'

import { api } from '../api'
import type { MarketDetail, Mode, OrderRecord } from '../types'
import { normalizeOrderInputValue, resolveErrorMessage } from '../utils/app-helpers'

type ActionTone = 'success' | 'warning' | 'error'

type ManualOrderState = {
  side: 'buy' | 'sell'
  quantity: string
  price: string
  note: string
}

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

export function useTradingExecutionActions({
  refreshControlData,
  marketDetail,
  selectedMode,
  manualOrder,
  manualOrderQuantity,
  manualOrderPrice,
  manualTradingBlockedReason,
  editingOrderId,
  setSelectedSymbol,
  setManualOrder,
  setEditingOrderId,
  setManualTradePanelOpen,
  manualOrderSymbolRef,
  showFeedback,
}: UseTradingExecutionActionsArgs) {
  const manualTradeMutation = useMutation({
    mutationFn: api.createManualTrade,
    onSuccess: refreshControlData,
  })

  const exchangeOrderMutation = useMutation({
    mutationFn: api.createExchangeOrder,
    onSuccess: refreshControlData,
  })

  const replaceExchangeOrderMutation = useMutation({
    mutationFn: ({ orderId, quantity, price }: { orderId: string; quantity: number; price: number }) =>
      api.replaceExchangeOrder(orderId, { quantity, price, requested_by: 'desktop_operator' }),
    onSuccess: refreshControlData,
  })

  const paperOrderMutation = useMutation({
    mutationFn: api.createPaperOrder,
    onSuccess: refreshControlData,
  })

  const closePaperPositionMutation = useMutation({
    mutationFn: (symbol: string) => api.closePaperPosition(symbol, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const closeExchangePositionMutation = useMutation({
    mutationFn: (symbol: string) => api.closeExchangePosition(symbol, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const closeAllPaperPositionsMutation = useMutation({
    mutationFn: () => api.closeAllPaperPositions('desktop_operator'),
    onSuccess: refreshControlData,
  })

  const closeAllExchangePositionsMutation = useMutation({
    mutationFn: () => api.closeAllExchangePositions('desktop_operator'),
    onSuccess: refreshControlData,
  })

  const cancelExchangeOrderMutation = useMutation({
    mutationFn: (orderId: string) => api.cancelExchangeOrder(orderId, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const cancelAllExchangeOrdersMutation = useMutation({
    mutationFn: () => api.cancelAllExchangeOrders('desktop_operator'),
    onSuccess: refreshControlData,
  })

  const cancelPaperOrderMutation = useMutation({
    mutationFn: (orderId: string) => api.cancelPaperOrder(orderId, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const cancelAllPaperOrdersMutation = useMutation({
    mutationFn: () => api.cancelAllPaperOrders('desktop_operator'),
    onSuccess: refreshControlData,
  })

  const replacePaperOrderMutation = useMutation({
    mutationFn: ({ orderId, quantity, price }: { orderId: string; quantity: number; price: number }) =>
      api.replacePaperOrder(orderId, { quantity, price, requested_by: 'desktop_operator' }),
    onSuccess: refreshControlData,
  })

  const tradeProbeMutation = useMutation({
    mutationFn: api.probeBybitTradeRoute,
  })

  const closeManualTradePanel = () => {
    setManualTradePanelOpen(false)
    setEditingOrderId(null)
  }

  const openOrderEditor = (order: OrderRecord) => {
    startTransition(() => setSelectedSymbol(order.symbol))
    manualOrderSymbolRef.current = order.symbol
    setManualOrder({
      side: order.side,
      quantity: normalizeOrderInputValue(order.qty),
      price: normalizeOrderInputValue(order.price),
      note: '',
    })
    setEditingOrderId(order.order_id)
    setManualTradePanelOpen(true)
  }

  const submitManualOrder = async () => {
    if (!marketDetail) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能提交手动交易', manualTradingBlockedReason)
      return
    }

    try {
      if (selectedMode === 'paper') {
        await manualTradeMutation.mutateAsync({
          symbol: marketDetail.symbol,
          market: marketDetail.market,
          mode: selectedMode,
          side: manualOrder.side,
          quantity: manualOrderQuantity,
          price: manualOrderPrice,
          note: manualOrder.note,
        })
        showFeedback('success', '手动交易已写入量化控制链路', `${marketDetail.symbol} 的 Paper 手动交易已记录并写入审计日志。`)
      } else {
        const order = await exchangeOrderMutation.mutateAsync({
          symbol: marketDetail.symbol,
          market: marketDetail.market,
          mode: selectedMode,
          side: manualOrder.side,
          quantity: manualOrderQuantity,
          price: manualOrderPrice,
          note: manualOrder.note,
        })
        showFeedback(
          'success',
          `${selectedMode.toUpperCase()} 委托已提交`,
          `${order.symbol} 已向 Bybit 提交 ${order.side === 'buy' ? '买入' : '卖出'} 限价委托，订单号 ${order.order_id}。`,
        )
      }
      setManualOrder((current) => ({ ...current, note: '' }))
    } catch (error) {
      showFeedback('error', '手动交易提交失败', resolveErrorMessage(error))
    }
  }

  const closePaperPosition = async (symbol: string) => {
    try {
      const trade = await closePaperPositionMutation.mutateAsync(symbol)
      showFeedback('success', 'Paper 持仓已平仓', `${trade.symbol} 已按当前参考价写入一笔纸面平仓。`)
    } catch (error) {
      showFeedback('error', 'Paper 平仓失败', resolveErrorMessage(error))
    }
  }

  const closeExchangePosition = async (symbol: string) => {
    try {
      const order = await closeExchangePositionMutation.mutateAsync(symbol)
      showFeedback(
        'success',
        '真实持仓平仓委托已提交',
        `${order.symbol} 的平仓限价委托已提交到 Bybit，订单号 ${order.order_id}。`,
      )
    } catch (error) {
      showFeedback('error', '真实持仓平仓失败', resolveErrorMessage(error))
    }
  }

  const closeAllPaperPositions = async () => {
    try {
      const result = await closeAllPaperPositionsMutation.mutateAsync()
      showFeedback(
        'success',
        result.closed_count > 0 ? '已批量平掉 Paper 持仓' : '当前没有可平的 Paper 持仓',
        result.closed_count > 0
          ? `本次共按参考价平掉 ${result.closed_count} 个本地持仓方向。`
          : 'Paper 持仓当前为空。',
      )
    } catch (error) {
      showFeedback('error', '批量平仓失败', resolveErrorMessage(error))
    }
  }

  const closeAllExchangePositions = async () => {
    try {
      const result = await closeAllExchangePositionsMutation.mutateAsync()
      showFeedback(
        'success',
        result.submitted_count > 0 ? '已批量提交真实持仓平仓委托' : '当前没有可平的真实持仓',
        result.submitted_count > 0
          ? `本次共向 Bybit 提交 ${result.submitted_count} 条真实平仓委托。`
          : '当前真实持仓为空。',
      )
    } catch (error) {
      showFeedback('error', '批量提交真实平仓委托失败', resolveErrorMessage(error))
    }
  }

  const submitPaperOrder = async () => {
    if (!marketDetail) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能创建本地限价委托', manualTradingBlockedReason)
      return
    }

    try {
      const order = await paperOrderMutation.mutateAsync({
        symbol: marketDetail.symbol,
        market: marketDetail.market,
        mode: selectedMode,
        side: manualOrder.side,
        quantity: manualOrderQuantity,
        price: manualOrderPrice,
        note: manualOrder.note,
      })
      showFeedback('success', 'Paper 限价委托已挂入本地委托簿', `${order.symbol} ${order.side === 'buy' ? '买单' : '卖单'} 已进入未成交委托列表。`)
      setManualOrder((current) => ({ ...current, note: '' }))
    } catch (error) {
      showFeedback('error', 'Paper 限价委托创建失败', resolveErrorMessage(error))
    }
  }

  const cancelPaperOrder = async (orderId: string) => {
    try {
      const order = await cancelPaperOrderMutation.mutateAsync(orderId)
      showFeedback('success', 'Paper 委托已取消', `${order.symbol} 的本地限价委托已取消。`)
      if (editingOrderId === orderId) {
        setEditingOrderId(null)
        setManualTradePanelOpen(false)
      }
    } catch (error) {
      showFeedback('error', '取消 Paper 委托失败', resolveErrorMessage(error))
    }
  }

  const cancelExchangeOrder = async (orderId: string) => {
    try {
      const order = await cancelExchangeOrderMutation.mutateAsync(orderId)
      showFeedback('success', '真实委托已撤销', `${order.symbol} 的 Bybit 委托 ${order.order_id} 已提交撤单。`)
      if (editingOrderId === orderId) {
        setEditingOrderId(null)
        setManualTradePanelOpen(false)
      }
    } catch (error) {
      showFeedback('error', '真实委托撤单失败', resolveErrorMessage(error))
    }
  }

  const cancelAllExchangeOrders = async () => {
    try {
      const result = await cancelAllExchangeOrdersMutation.mutateAsync()
      showFeedback(
        'success',
        result.cancelled_count > 0 ? '已批量撤销真实委托' : '当前没有可撤的真实委托',
        result.cancelled_count > 0
          ? `本次共向 Bybit 提交 ${result.cancelled_count} 条真实委托撤单。`
          : '当前未成交真实委托为空。',
      )
    } catch (error) {
      showFeedback('error', '批量撤销真实委托失败', resolveErrorMessage(error))
    }
  }

  const cancelAllPaperOrders = async () => {
    try {
      const result = await cancelAllPaperOrdersMutation.mutateAsync()
      showFeedback(
        'success',
        result.cancelled_count > 0 ? '已批量取消 Paper 委托' : '当前没有可取消的 Paper 委托',
        result.cancelled_count > 0
          ? `本次共取消 ${result.cancelled_count} 笔本地限价委托。`
          : '未成交委托列表当前为空。',
      )
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    } catch (error) {
      showFeedback('error', '批量取消 Paper 委托失败', resolveErrorMessage(error))
    }
  }

  const replacePaperOrder = async () => {
    if (!editingOrderId) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能修改本地限价委托', manualTradingBlockedReason)
      return
    }

    try {
      const order = await replacePaperOrderMutation.mutateAsync({
        orderId: editingOrderId,
        quantity: manualOrderQuantity,
        price: manualOrderPrice,
      })
      showFeedback(
        'success',
        order.status === 'Filled' ? 'Paper 委托已修改并成交' : 'Paper 委托已修改',
        order.status === 'Filled'
          ? `${order.symbol} 的本地限价委托在改价后已立即成交。`
          : `${order.symbol} 的本地限价委托已更新到新价格和数量。`,
      )
      setManualOrder((current) => ({ ...current, note: '' }))
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    } catch (error) {
      showFeedback('error', 'Paper 委托修改失败', resolveErrorMessage(error))
    }
  }

  const replaceExchangeOrder = async () => {
    if (!editingOrderId) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能修改真实委托', manualTradingBlockedReason)
      return
    }

    try {
      const order = await replaceExchangeOrderMutation.mutateAsync({
        orderId: editingOrderId,
        quantity: manualOrderQuantity,
        price: manualOrderPrice,
      })
      showFeedback(
        'success',
        '真实委托已修改',
        `${order.symbol} 的 Bybit 委托 ${order.order_id} 已更新为价格 ${order.price}、数量 ${order.qty}。`,
      )
      setManualOrder((current) => ({ ...current, note: '' }))
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    } catch (error) {
      showFeedback('error', '真实委托修改失败', resolveErrorMessage(error))
    }
  }

  const probeBybitTradeRoute = async () => {
    try {
      const result = await tradeProbeMutation.mutateAsync()
      const tone =
        result.outcome === 'validation_rejected' || result.outcome === 'request_rejected'
          ? 'success'
          : result.outcome === 'permission_denied'
            ? 'warning'
            : result.outcome === 'accepted_unexpectedly'
              ? 'warning'
              : 'error'
      showFeedback(tone, '真实交易链路探测已完成', result.detail)
    } catch (error) {
      showFeedback('error', '真实交易链路探测失败', resolveErrorMessage(error))
    }
  }

  return {
    tradeProbeResult: tradeProbeMutation.data,
    tradeProbePending: tradeProbeMutation.isPending,
    manualTradeMutationPending: manualTradeMutation.isPending,
    exchangeOrderMutationPending: exchangeOrderMutation.isPending,
    paperOrderMutationPending: paperOrderMutation.isPending,
    replacePaperOrderPending: replacePaperOrderMutation.isPending,
    replaceExchangeOrderPending: replaceExchangeOrderMutation.isPending,
    cancelPaperOrderPending: cancelPaperOrderMutation.isPending,
    cancelExchangeOrderPending: cancelExchangeOrderMutation.isPending,
    cancelAllPaperOrdersPending: cancelAllPaperOrdersMutation.isPending,
    cancelAllExchangeOrdersPending: cancelAllExchangeOrdersMutation.isPending,
    closeAllPaperPositionsPending: closeAllPaperPositionsMutation.isPending,
    closeAllExchangePositionsPending: closeAllExchangePositionsMutation.isPending,
    closePaperPositionPending: closePaperPositionMutation.isPending,
    closeExchangePositionPending: closeExchangePositionMutation.isPending,
    closeManualTradePanel,
    openOrderEditor,
    submitManualOrder,
    closePaperPosition,
    closeExchangePosition,
    closeAllPaperPositions,
    closeAllExchangePositions,
    submitPaperOrder,
    cancelPaperOrder,
    cancelExchangeOrder,
    cancelAllExchangeOrders,
    cancelAllPaperOrders,
    replacePaperOrder,
    replaceExchangeOrder,
    probeBybitTradeRoute,
  }
}
