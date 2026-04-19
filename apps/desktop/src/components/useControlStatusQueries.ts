import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

type UseControlStatusQueriesArgs = {
  grafanaPreviewOpen: boolean
}

export function useControlStatusQueries({
  grafanaPreviewOpen,
}: UseControlStatusQueriesArgs) {
  const healthQuery = useQuery({
    queryKey: ['service-health'],
    queryFn: api.getServiceHealth,
    retry: false,
    refetchInterval: 15000,
  })
  const runtimeWorkerStatusQuery = useQuery({
    queryKey: ['runtime-worker-status'],
    queryFn: api.getRuntimeWorkerStatus,
    enabled: Boolean(healthQuery.data?.ok),
    refetchInterval: 5000,
    staleTime: 0,
  })
  const snapshotQuery = useQuery({
    queryKey: ['snapshot'],
    queryFn: api.getControlSnapshot,
    refetchInterval: 12000,
  })
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 60000,
  })
  const grafanaQuery = useQuery({
    queryKey: ['grafana'],
    queryFn: api.getGrafanaStatus,
    staleTime: 60000,
  })
  const metricsPreviewQuery = useQuery({
    queryKey: ['metrics-preview'],
    queryFn: api.getPrometheusMetrics,
    enabled: grafanaPreviewOpen,
    staleTime: 15000,
  })
  const workspaceQuery = useQuery({
    queryKey: ['workspace'],
    queryFn: api.getWorkspacePreferences,
    staleTime: 30000,
    retry: false,
  })
  const openClawQuery = useQuery({
    queryKey: ['openclaw'],
    queryFn: api.getOpenClawStatus,
    refetchInterval: 20000,
  })
  const bybitPrivateQuery = useQuery({
    queryKey: ['bybit-private'],
    queryFn: api.getBybitPrivateStatus,
    refetchInterval: 20000,
  })
  const bybitPublicQuery = useQuery({
    queryKey: ['bybit-public'],
    queryFn: api.getBybitPublicStatus,
    refetchInterval: 20000,
  })

  return {
    healthQuery,
    runtimeWorkerStatusQuery,
    snapshotQuery,
    settingsQuery,
    grafanaQuery,
    metricsPreviewQuery,
    workspaceQuery,
    openClawQuery,
    bybitPrivateQuery,
    bybitPublicQuery,
  }
}
