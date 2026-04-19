import { useMemo } from 'react'

import { buildControlOpsQueryDerivedState } from './buildControlOpsQueryDerivedState'
import { useControlOpsLiveQueries } from './useControlOpsLiveQueries'
import { useControlOpsPrimaryQueries } from './useControlOpsPrimaryQueries'
import type { UseControlOpsQueriesArgs } from './useControlOpsQueries.types'

export function useControlOpsQueries({
  activeSection,
  editingOrderId,
}: UseControlOpsQueriesArgs) {
  const liveAiEnabled = activeSection === 'overview' || activeSection === 'scheduler'
  const liveOpsEnabled =
    activeSection === 'overview' ||
    activeSection === 'alerts' ||
    activeSection === 'trades' ||
    activeSection === 'audit'
  const liveAccountEnabled = activeSection === 'overview' || activeSection === 'trades'
  const primaryQueries = useControlOpsPrimaryQueries()
  const liveQueries = useControlOpsLiveQueries({
    liveAiEnabled,
    liveOpsEnabled,
    liveAccountEnabled,
  })

  const derivedState = useMemo(
    () =>
      buildControlOpsQueryDerivedState({
        schedulerQueryData: primaryQueries.schedulerQuery.data,
        aiLiveQueryData: liveQueries.aiLiveQuery.data,
        opsLiveQueryData: liveQueries.opsLiveQuery.data,
        alertsQueryData: primaryQueries.alertsQuery.data,
        accountLiveQueryData: liveQueries.accountLiveQuery.data,
        accountOverviewQueryData: primaryQueries.accountOverviewQuery.data,
        accountPositionsQueryData: primaryQueries.accountPositionsQuery.data,
        accountOrdersQueryData: primaryQueries.accountOrdersQuery.data,
        accountOrderHistoryQueryData: primaryQueries.accountOrderHistoryQuery.data,
        tradesQueryData: primaryQueries.tradesQuery.data,
        auditQueryData: primaryQueries.auditQuery.data,
        changeRequestsQueryData: primaryQueries.changeRequestsQuery.data,
        editingOrderId,
        schedulerQueryFetched: primaryQueries.schedulerQuery.isFetched,
        aiLiveQueryFetched: liveQueries.aiLiveQuery.isFetched,
        opsLiveQueryFetched: liveQueries.opsLiveQuery.isFetched,
        alertsQueryFetched: primaryQueries.alertsQuery.isFetched,
        auditQueryFetched: primaryQueries.auditQuery.isFetched,
        newsQueryData: primaryQueries.newsQuery.data,
      }),
    [
      editingOrderId,
      liveQueries.accountLiveQuery.data,
      liveQueries.aiLiveQuery.data,
      liveQueries.aiLiveQuery.isFetched,
      liveQueries.opsLiveQuery.data,
      liveQueries.opsLiveQuery.isFetched,
      primaryQueries.accountOrderHistoryQuery.data,
      primaryQueries.accountOrdersQuery.data,
      primaryQueries.accountOverviewQuery.data,
      primaryQueries.accountPositionsQuery.data,
      primaryQueries.alertsQuery.data,
      primaryQueries.alertsQuery.isFetched,
      primaryQueries.auditQuery.data,
      primaryQueries.auditQuery.isFetched,
      primaryQueries.changeRequestsQuery.data,
      primaryQueries.newsQuery.data,
      primaryQueries.schedulerQuery.data,
      primaryQueries.schedulerQuery.isFetched,
      primaryQueries.tradesQuery.data,
    ],
  )

  return {
    ...primaryQueries,
    ...liveQueries,
    accountOrderHistory: derivedState.accountOrderHistory,
    accountOrders: derivedState.accountOrders,
    accountOverview: derivedState.accountOverview,
    accountPositions: derivedState.accountPositions,
    alerts: derivedState.alerts,
    alertsNotificationBootstrapReady: derivedState.alertsNotificationBootstrapReady,
    auditEvents: derivedState.auditEvents,
    changeRequests: derivedState.changeRequests,
    editingOrder: derivedState.editingOrder,
    jobsNotificationBootstrapReady: derivedState.jobsNotificationBootstrapReady,
    news: derivedState.news,
    opsLive: derivedState.opsLive,
    opsNotificationBootstrapReady: derivedState.opsNotificationBootstrapReady,
    scheduler: derivedState.scheduler,
    trades: derivedState.trades,
  }
}
