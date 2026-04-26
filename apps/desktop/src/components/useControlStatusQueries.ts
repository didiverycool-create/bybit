import { useQuery } from '@tanstack/react-query'

import { controlRuntimeApi } from '../apiControlRuntime'
import { getServiceHealth } from '../apiHttp'
import { systemIntegrationApi } from '../apiSystemIntegration'

type UseControlStatusQueriesArgs = {
  grafanaPreviewOpen: boolean
}

export function useControlStatusQueries({
  grafanaPreviewOpen,
}: UseControlStatusQueriesArgs) {
  const healthQuery = useQuery({
    queryKey: ['service-health'],
    queryFn: getServiceHealth,
    retry: false,
    refetchInterval: 15000,
  })
  const runtimeWorkerStatusQuery = useQuery({
    queryKey: ['runtime-worker-status'],
    queryFn: controlRuntimeApi.getRuntimeWorkerStatus,
    enabled: Boolean(healthQuery.data?.ok),
    refetchInterval: 5000,
    staleTime: 0,
  })
  const snapshotQuery = useQuery({
    queryKey: ['snapshot'],
    queryFn: controlRuntimeApi.getControlSnapshot,
    refetchInterval: 12000,
  })
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: systemIntegrationApi.getSettings,
    staleTime: 60000,
  })
  const grafanaQuery = useQuery({
    queryKey: ['grafana'],
    queryFn: systemIntegrationApi.getGrafanaStatus,
    staleTime: 60000,
  })
  const metricsPreviewQuery = useQuery({
    queryKey: ['metrics-preview'],
    queryFn: systemIntegrationApi.getPrometheusMetrics,
    enabled: grafanaPreviewOpen,
    staleTime: 15000,
  })
  const workspaceQuery = useQuery({
    queryKey: ['workspace'],
    queryFn: systemIntegrationApi.getWorkspacePreferences,
    staleTime: 30000,
    retry: false,
  })
  const openClawQuery = useQuery({
    queryKey: ['openclaw'],
    queryFn: systemIntegrationApi.getOpenClawStatus,
    refetchInterval: 20000,
  })
  const bybitPrivateQuery = useQuery({
    queryKey: ['bybit-private'],
    queryFn: systemIntegrationApi.getBybitPrivateStatus,
    refetchInterval: 20000,
  })
  const bybitPublicQuery = useQuery({
    queryKey: ['bybit-public'],
    queryFn: systemIntegrationApi.getBybitPublicStatus,
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
