import type { ComponentProps } from 'react'

import AuditWorkspaceSection from './AuditWorkspaceSection'

type AuditWorkspaceSectionProps = ComponentProps<typeof AuditWorkspaceSection>

type AuditWorkspaceContainerProps = {
  summaryState: {
    warningCount: AuditWorkspaceSectionProps['warningCount']
    criticalCount: AuditWorkspaceSectionProps['criticalCount']
  }
  filterState: {
    auditSeverityFilter: AuditWorkspaceSectionProps['auditSeverityFilter']
    auditSourceFilter: AuditWorkspaceSectionProps['auditSourceFilter']
    auditSourceOptions: AuditWorkspaceSectionProps['auditSourceOptions']
    auditScopeFilter: AuditWorkspaceSectionProps['auditScopeFilter']
    selectedSymbol: AuditWorkspaceSectionProps['selectedSymbol']
    auditSearch: AuditWorkspaceSectionProps['auditSearch']
  }
  eventState: {
    filteredAuditEvents: AuditWorkspaceSectionProps['filteredAuditEvents']
    configWebEntry: AuditWorkspaceSectionProps['configWebEntry']
    configApiBaseUrl: AuditWorkspaceSectionProps['configApiBaseUrl']
    configGatewayUrl: AuditWorkspaceSectionProps['configGatewayUrl']
  }
  actions: Pick<
    AuditWorkspaceSectionProps,
    | 'onAuditSeverityFilterChange'
    | 'onAuditSourceFilterChange'
    | 'onToggleAuditScopeFilter'
    | 'onAuditSearchChange'
    | 'onOpenAiSchedulerJob'
    | 'onOpenReviewInspector'
    | 'onOpenBacktestDetail'
    | 'onOpenSourceReview'
    | 'onOpenStrategyProposal'
    | 'onOpenStrategyActivity'
  >
}

export default function AuditWorkspaceContainer({
  summaryState,
  filterState,
  eventState,
  actions,
}: AuditWorkspaceContainerProps) {
  return (
    <AuditWorkspaceSection
      warningCount={summaryState.warningCount}
      criticalCount={summaryState.criticalCount}
      auditSeverityFilter={filterState.auditSeverityFilter}
      onAuditSeverityFilterChange={actions.onAuditSeverityFilterChange}
      auditSourceFilter={filterState.auditSourceFilter}
      onAuditSourceFilterChange={actions.onAuditSourceFilterChange}
      auditSourceOptions={filterState.auditSourceOptions}
      auditScopeFilter={filterState.auditScopeFilter}
      selectedSymbol={filterState.selectedSymbol}
      onToggleAuditScopeFilter={actions.onToggleAuditScopeFilter}
      auditSearch={filterState.auditSearch}
      onAuditSearchChange={actions.onAuditSearchChange}
      filteredAuditEvents={eventState.filteredAuditEvents}
      configWebEntry={eventState.configWebEntry}
      configApiBaseUrl={eventState.configApiBaseUrl}
      configGatewayUrl={eventState.configGatewayUrl}
      onOpenAiSchedulerJob={actions.onOpenAiSchedulerJob}
      onOpenReviewInspector={actions.onOpenReviewInspector}
      onOpenBacktestDetail={actions.onOpenBacktestDetail}
      onOpenSourceReview={actions.onOpenSourceReview}
      onOpenStrategyProposal={actions.onOpenStrategyProposal}
      onOpenStrategyActivity={actions.onOpenStrategyActivity}
    />
  )
}
