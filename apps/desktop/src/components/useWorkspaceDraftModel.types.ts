import type { LayoutPreset, Mode, SectionKey, StrategySummary } from '../types'
import type { MarketTimeframe, WorkspaceBootstrap } from '../utils/workspace-helpers'

export type UseWorkspaceDraftModelArgs = {
  activeSection: SectionKey
  layoutPreset: LayoutPreset
  selectedMode: Mode
  selectedSymbol: string
  selectedMarketTimeframe: MarketTimeframe
  selectedStrategy: StrategySummary | null
  selectedStrategyId: string | null
  selectedBacktestId: string | null
  aiSchedulerFocusedJobId: string | null
  strategyActivityPanelOpen: boolean
  strategyTrackingPanelOpen: boolean
  strategyEditorOpen: boolean
  strategyTrackingKind: WorkspaceBootstrap['selected_strategy_tracking_kind']
  strategyTrackingSummary: string
  strategyTrackingDetail: string
  strategyEditorDraftStrategyId: string | null
  parameterDrafts: Record<string, string>
  riskBudgetDraft: string
  reviewInspectorOpen: boolean
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
  replayFocusedReviewId: string | null
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  backtestFilter: WorkspaceBootstrap['backtest_filter']
  replayTrackingScope: WorkspaceBootstrap['replay_tracking_scope']
  alertSeverityFilter: WorkspaceBootstrap['alert_severity_filter']
  alertStatusFilter: WorkspaceBootstrap['alert_status_filter']
  alertScopeFilter: WorkspaceBootstrap['alert_scope_filter']
  tradeModeFilter: WorkspaceBootstrap['trade_mode_filter']
  tradeOriginFilter: WorkspaceBootstrap['trade_origin_filter']
  tradeScopeFilter: WorkspaceBootstrap['trade_scope_filter']
  auditSeverityFilter: WorkspaceBootstrap['audit_severity_filter']
  auditSourceFilter: string
  auditScopeFilter: WorkspaceBootstrap['audit_scope_filter']
  auditSearch: string
  cardOrder: string[]
  visibleOverviewCards: string[]
  collapsedOverviewCards: string[]
}

export type UseWorkspaceDraftModelResult = {
  currentWorkspaceDraft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>
  selectedStrategyWorkspaceId: string | null
  selectedStrategyDetailPanel: WorkspaceBootstrap['selected_strategy_detail_panel']
  persistedStrategyEditorDraftStrategyId: string | null
  persistedStrategyEditorParameterDrafts: Record<string, string>
  persistedStrategyEditorRiskBudgetDraft: string
}
