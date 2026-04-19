import { useMutation } from '@tanstack/react-query'

import { api } from '../api'

function useRefreshableMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  refreshControlData: () => Promise<void>,
) {
  return useMutation({
    mutationFn,
    onSuccess: refreshControlData,
  })
}

type UseTradingExecutionMutationsArgs = {
  refreshControlData: () => Promise<void>
}

export function useTradingExecutionMutations({ refreshControlData }: UseTradingExecutionMutationsArgs) {
  const manualTradeMutation = useRefreshableMutation(api.createManualTrade, refreshControlData)
  const exchangeOrderMutation = useRefreshableMutation(api.createExchangeOrder, refreshControlData)
  const replaceExchangeOrderMutation = useRefreshableMutation(
    ({ orderId, quantity, price }: { orderId: string; quantity: number; price: number }) =>
      api.replaceExchangeOrder(orderId, { quantity, price, requested_by: 'desktop_operator' }),
    refreshControlData,
  )
  const paperOrderMutation = useRefreshableMutation(api.createPaperOrder, refreshControlData)
  const closePaperPositionMutation = useRefreshableMutation(
    (symbol: string) => api.closePaperPosition(symbol, 'desktop_operator'),
    refreshControlData,
  )
  const closeExchangePositionMutation = useRefreshableMutation(
    (symbol: string) => api.closeExchangePosition(symbol, 'desktop_operator'),
    refreshControlData,
  )
  const closeAllPaperPositionsMutation = useRefreshableMutation(
    () => api.closeAllPaperPositions('desktop_operator'),
    refreshControlData,
  )
  const closeAllExchangePositionsMutation = useRefreshableMutation(
    () => api.closeAllExchangePositions('desktop_operator'),
    refreshControlData,
  )
  const cancelExchangeOrderMutation = useRefreshableMutation(
    (orderId: string) => api.cancelExchangeOrder(orderId, 'desktop_operator'),
    refreshControlData,
  )
  const cancelAllExchangeOrdersMutation = useRefreshableMutation(
    () => api.cancelAllExchangeOrders('desktop_operator'),
    refreshControlData,
  )
  const cancelPaperOrderMutation = useRefreshableMutation(
    (orderId: string) => api.cancelPaperOrder(orderId, 'desktop_operator'),
    refreshControlData,
  )
  const cancelAllPaperOrdersMutation = useRefreshableMutation(
    () => api.cancelAllPaperOrders('desktop_operator'),
    refreshControlData,
  )
  const replacePaperOrderMutation = useRefreshableMutation(
    ({ orderId, quantity, price }: { orderId: string; quantity: number; price: number }) =>
      api.replacePaperOrder(orderId, { quantity, price, requested_by: 'desktop_operator' }),
    refreshControlData,
  )
  const tradeProbeMutation = useMutation({
    mutationFn: api.probeBybitTradeRoute,
  })

  return {
    manualTradeMutation,
    exchangeOrderMutation,
    replaceExchangeOrderMutation,
    paperOrderMutation,
    closePaperPositionMutation,
    closeExchangePositionMutation,
    closeAllPaperPositionsMutation,
    closeAllExchangePositionsMutation,
    cancelExchangeOrderMutation,
    cancelAllExchangeOrdersMutation,
    cancelPaperOrderMutation,
    cancelAllPaperOrdersMutation,
    replacePaperOrderMutation,
    tradeProbeMutation,
  }
}
