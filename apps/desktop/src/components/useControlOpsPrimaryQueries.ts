import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

export function useControlOpsPrimaryQueries() {
  const schedulerQuery = useQuery({
    queryKey: ['scheduler'],
    queryFn: api.getScheduler,
    refetchInterval: 10000,
  })
  const newsQuery = useQuery({
    queryKey: ['news'],
    queryFn: api.getNews,
    refetchInterval: 20000,
  })
  const alertsQuery = useQuery({
    queryKey: ['alerts'],
    queryFn: api.getAlerts,
    refetchInterval: 15000,
  })
  const accountOverviewQuery = useQuery({
    queryKey: ['account-overview'],
    queryFn: api.getAccountOverview,
    refetchInterval: 15000,
  })
  const accountPositionsQuery = useQuery({
    queryKey: ['account-positions'],
    queryFn: api.getAccountPositions,
    refetchInterval: 15000,
  })
  const accountOrdersQuery = useQuery({
    queryKey: ['account-orders'],
    queryFn: api.getAccountOrders,
    refetchInterval: 15000,
  })
  const accountOrderHistoryQuery = useQuery({
    queryKey: ['account-order-history'],
    queryFn: api.getAccountOrderHistory,
    refetchInterval: 15000,
  })
  const tradesQuery = useQuery({
    queryKey: ['trades'],
    queryFn: api.getTrades,
    refetchInterval: 15000,
  })
  const auditQuery = useQuery({
    queryKey: ['audit'],
    queryFn: api.getAuditEvents,
    refetchInterval: 10000,
  })
  const changeRequestsQuery = useQuery({
    queryKey: ['change-requests'],
    queryFn: api.getChangeRequests,
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
