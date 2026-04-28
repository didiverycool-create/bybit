import { useMutation } from '@tanstack/react-query'

import { accountTradingApi } from '../apiAccountTrading'
import { systemIntegrationApi } from '../apiSystemIntegration'

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
  const manualTradeMutation = useRefreshableMutation(accountTradingApi.createManualTrade, refreshControlData)
  const exchangeOrderMutation = useRefreshableMutation(accountTradingApi.createExchangeOrder, refreshControlData)
  const replaceExchangeOrderMutation = useRefreshableMutation(
    ({ orderId, quantity, price }: { orderId: string; quantity: number; price: number }) =>
      accountTradingApi.replaceExchangeOrder(orderId, { quantity, price, requested_by: 'desktop_operator' }),
    refreshControlData,
  )
  const paperOrderMutation = useRefreshableMutation(accountTradingApi.createPaperOrder, refreshControlData)
  const closePaperPositionMutation = useRefreshableMutation(
    (symbol: string) => accountTradingApi.closePaperPosition(symbol, 'desktop_operator'),
    refreshControlData,
  )
  const closeExchangePositionMutation = useRefreshableMutation(
    (symbol: string) => accountTradingApi.closeExchangePosition(symbol, 'desktop_operator'),
    refreshControlData,
  )
  const closeAllPaperPositionsMutation = useRefreshableMutation(
    () => accountTradingApi.closeAllPaperPositions('desktop_operator'),
    refreshControlData,
  )
  const closeAllExchangePositionsMutation = useRefreshableMutation(
    () => accountTradingApi.closeAllExchangePositions('desktop_operator'),
    refreshControlData,
  )
  const cancelExchangeOrderMutation = useRefreshableMutation(
    (orderId: string) => accountTradingApi.cancelExchangeOrder(orderId, 'desktop_operator'),
    refreshControlData,
  )
  const cancelAllExchangeOrdersMutation = useRefreshableMutation(
    () => accountTradingApi.cancelAllExchangeOrders('desktop_operator'),
    refreshControlData,
  )
  const cancelPaperOrderMutation = useRefreshableMutation(
    (orderId: string) => accountTradingApi.cancelPaperOrder(orderId, 'desktop_operator'),
    refreshControlData,
  )
  const cancelAllPaperOrdersMutation = useRefreshableMutation(
    () => accountTradingApi.cancelAllPaperOrders('desktop_operator'),
    refreshControlData,
  )
  const replacePaperOrderMutation = useRefreshableMutation(
    ({ orderId, quantity, price }: { orderId: string; quantity: number; price: number }) =>
      accountTradingApi.replacePaperOrder(orderId, { quantity, price, requested_by: 'desktop_operator' }),
    refreshControlData,
  )
  const tradeProbeMutation = useMutation({
    mutationFn: systemIntegrationApi.probeBybitTradeRoute,
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
