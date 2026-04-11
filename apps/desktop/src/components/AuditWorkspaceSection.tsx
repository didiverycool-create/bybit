import type { ExecutionEvent } from '../types'
import {
} from '../utils/app-helpers'
import {
  AuditWorkspaceConfigSnapshotPanel,
  AuditWorkspaceEventList,
  AuditWorkspaceToolbar,
} from './audit-workspace'

type AuditSeverityFilter = 'all' | 'info' | 'warning' | 'error' | 'critical'
type AuditScopeFilter = 'all' | 'selected'

type AuditWorkspaceSectionProps = {
  warningCount: number
  criticalCount: number
  auditSeverityFilter: AuditSeverityFilter
  onAuditSeverityFilterChange: (value: AuditSeverityFilter) => void
  auditSourceFilter: string
  onAuditSourceFilterChange: (value: string) => void
  auditSourceOptions: string[]
  auditScopeFilter: AuditScopeFilter
  selectedSymbol: string
  onToggleAuditScopeFilter: () => void
  auditSearch: string
  onAuditSearchChange: (value: string) => void
  filteredAuditEvents: ExecutionEvent[]
  configWebEntry: string
  configApiBaseUrl: string
  configGatewayUrl: string
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
}

export default function AuditWorkspaceSection({
  warningCount,
  criticalCount,
  auditSeverityFilter,
  onAuditSeverityFilterChange,
  auditSourceFilter,
  onAuditSourceFilterChange,
  auditSourceOptions,
  auditScopeFilter,
  selectedSymbol,
  onToggleAuditScopeFilter,
  auditSearch,
  onAuditSearchChange,
  filteredAuditEvents,
  configWebEntry,
  configApiBaseUrl,
  configGatewayUrl,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
}: AuditWorkspaceSectionProps) {
  return (
    <section className="section-grid section-entrance">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">系统日志 / 审计</span>
            <h3>执行链路与历史追踪</h3>
          </div>
          <span className="chip chip--muted">warning {warningCount} · critical {criticalCount}</span>
        </div>
        <AuditWorkspaceToolbar
          auditSeverityFilter={auditSeverityFilter}
          onAuditSeverityFilterChange={onAuditSeverityFilterChange}
          auditSourceFilter={auditSourceFilter}
          onAuditSourceFilterChange={onAuditSourceFilterChange}
          auditSourceOptions={auditSourceOptions}
          auditScopeFilter={auditScopeFilter}
          selectedSymbol={selectedSymbol}
          onToggleAuditScopeFilter={onToggleAuditScopeFilter}
          auditSearch={auditSearch}
          onAuditSearchChange={onAuditSearchChange}
        />
        <AuditWorkspaceEventList
          filteredAuditEvents={filteredAuditEvents}
          onOpenAiSchedulerJob={onOpenAiSchedulerJob}
          onOpenReviewInspector={onOpenReviewInspector}
          onOpenBacktestDetail={onOpenBacktestDetail}
          onOpenSourceReview={onOpenSourceReview}
          onOpenStrategyProposal={onOpenStrategyProposal}
          onOpenStrategyActivity={onOpenStrategyActivity}
        />
        <AuditWorkspaceConfigSnapshotPanel
          configWebEntry={configWebEntry}
          configApiBaseUrl={configApiBaseUrl}
          configGatewayUrl={configGatewayUrl}
        />
      </article>
    </section>
  )
}
