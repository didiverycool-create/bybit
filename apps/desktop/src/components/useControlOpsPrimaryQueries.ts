import { useQuery } from '@tanstack/react-query'

import { accountTradingApi } from '../apiAccountTrading'
import { aiWorkflowApi } from '../apiAiWorkflow'
import { opsMonitoringApi } from '../apiOpsMonitoring'

export function useControlOpsPrimaryQueries() {
  const schedulerQuery = useQuery({
    queryKey: ['scheduler'],
    queryFn: aiWorkflowApi.getScheduler,
    refetchInterval: 10000,
  })
  const newsQuery = useQuery({
    queryKey: ['news'],
    queryFn: opsMonitoringApi.getNews,
    refetchInterval: 20000,
  })
  const alertsQuery = useQuery({
    queryKey: ['alerts'],
    queryFn: opsMonitoringApi.getAlerts,
    refetchInterval: 15000,
  })
  const accountOverviewQuery = useQuery({
    queryKey: ['account-overview'],
    queryFn: accountTradingApi.getAccountOverview,
    refetchInterval: 15000,
  })
  const accountPositionsQuery = useQuery({
    queryKey: ['account-positions'],
    queryFn: accountTradingApi.getAccountPositions,
    refetchInterval: 15000,
  })
  const accountOrdersQuery = useQuery({
    queryKey: ['account-orders'],
    queryFn: accountTradingApi.getAccountOrders,
    refetchInterval: 15000,
  })
  const accountOrderHistoryQuery = useQuery({
    queryKey: ['account-order-history'],
    queryFn: accountTradingApi.getAccountOrderHistory,
    refetchInterval: 15000,
  })
  const tradesQuery = useQuery({
    queryKey: ['trades'],
    queryFn: accountTradingApi.getTrades,
    refetchInterval: 15000,
  })
  const auditQuery = useQuery({
    queryKey: ['audit'],
    queryFn: opsMonitoringApi.getAuditEvents,
    refetchInterval: 10000,
  })
  const changeRequestsQuery = useQuery({
    queryKey: ['change-requests'],
    queryFn: aiWorkflowApi.getChangeRequests,
    refetchInterval: 10000,
  })

  return {
    schedulerQuery,
    newsQuery,
    alertsQuery,
    accountOverviewQuery,
    accountPositionsQuery,
    accountOrdersQuery,
    accountOrderHistoryQuery,
    tradesQuery,
    auditQuery,
    changeRequestsQuery,
  }
}
