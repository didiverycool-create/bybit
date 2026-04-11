type AuditSeverityFilter = 'all' | 'info' | 'warning' | 'error' | 'critical'
type AuditScopeFilter = 'all' | 'selected'

type AuditWorkspaceToolbarProps = {
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
}

const auditSeverityOptions: AuditSeverityFilter[] = ['all', 'info', 'warning', 'error', 'critical']

export default function AuditWorkspaceToolbar({
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
}: AuditWorkspaceToolbarProps) {
  return (
    <div className="ops-toolbar">
      <div className="ops-toolbar__group">
        <span className="section-label">级别</span>
        {auditSeverityOptions.map((value) => (
          <button
            key={value}
            type="button"
            className={`pill pill--compact ${auditSeverityFilter === value ? 'active' : ''}`}
            onClick={() => onAuditSeverityFilterChange(value)}
          >
            {value === 'all' ? '全部' : value}
          </button>
        ))}
      </div>
      <div className="ops-toolbar__group">
        <span className="section-label">来源</span>
        <button
          type="button"
          className={`pill pill--compact ${auditSourceFilter === 'all' ? 'active' : ''}`}
          onClick={() => onAuditSourceFilterChange('all')}
        >
          全部
        </button>
        {auditSourceOptions.map((source) => (
          <button
            key={source}
            type="button"
            className={`pill pill--compact ${auditSourceFilter === source ? 'active' : ''}`}
            onClick={() => onAuditSourceFilterChange(source)}
          >
            {source}
          </button>
        ))}
        <button
          type="button"
          className={`pill pill--compact ${auditScopeFilter === 'selected' ? 'active' : ''}`}
          onClick={onToggleAuditScopeFilter}
        >
          {auditScopeFilter === 'selected' ? selectedSymbol : '当前品种'}
        </button>
      </div>
      <div className="ops-toolbar__group ops-toolbar__group--search">
        <span className="section-label">检索</span>
        <input
          value={auditSearch}
          onChange={(event) => onAuditSearchChange(event.target.value)}
          placeholder="事件类型 / source / symbol"
        />
      </div>
    </div>
  )
}
