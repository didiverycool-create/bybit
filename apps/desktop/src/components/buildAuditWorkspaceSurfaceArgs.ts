import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildAuditWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAuditWorkspaceSurfaceArgs({
  source,
}: BuildAuditWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['auditWorkspace'] {
  const { opsLive, auditSeverityFilter, auditSourceFilter, auditSourceOptions, auditScopeFilter, selectedSymbol, auditSearch, filteredAuditEvents, settings, openClawStatus } = source

  return {
    summaryState: {
      warningCount: opsLive?.summary.audit_warnings ?? 0,
      criticalCount: opsLive?.summary.audit_critical ?? 0,
    },
    filterState: {
      auditSeverityFilter,
      auditSourceFilter,
      auditSourceOptions,
      auditScopeFilter,
      selectedSymbol,
      auditSearch,
    },
    eventState: {
      filteredAuditEvents,
      configWebEntry: settings?.bybit_web_entry ?? 'https://www.bybit-global.com/',
      configApiBaseUrl: settings?.api_base_url ?? 'https://api.bybit.com',
      configGatewayUrl: openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? 'ws://127.0.0.1:18789',
    },
  }
}
