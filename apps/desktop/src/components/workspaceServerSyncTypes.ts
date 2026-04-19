import type { Dispatch, SetStateAction } from 'react'

import type { LayoutPreset, Mode, SectionKey, WorkspacePreferences } from '../types'
import type { MarketTimeframe, WorkspaceBootstrap } from '../utils/workspace-helpers'

export type WorkspaceServerSyncWorkspace = WorkspaceBootstrap | WorkspacePreferences

export type WorkspaceServerSyncSetters = {
  setWorkspaceSavedAt: Dispatch<SetStateAction<string | null>>
  setLastSyncedWorkspaceSignature: Dispatch<SetStateAction<string>>
  setActiveSection: Dispatch<SetStateAction<SectionKey>>
  setLayoutPreset: Dispatch<SetStateAction<LayoutPreset>>
  setSelectedMode: Dispatch<SetStateAction<Mode>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setSelectedMarketTimeframe: Dispatch<SetStateAction<MarketTimeframe>>
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedBacktestId: Dispatch<SetStateAction<string | null>>
  setAiSchedulerFocusedJobId: Dispatch<SetStateAction<string | null>>
  setStrategyActivityPanelOpen: Dispatch<SetStateAction<boolean>>
  setStrategyTrackingPanelOpen: Dispatch<SetStateAction<boolean>>
  setStrategyEditorOpen: Dispatch<SetStateAction<boolean>>
  setStrategyTrackingKind: Dispatch<
    SetStateAction<WorkspaceBootstrap['selected_strategy_tracking_kind']>
  >
  setStrategyTrackingSummary: Dispatch<SetStateAction<string>>
  setStrategyTrackingDetail: Dispatch<SetStateAction<string>>
  setParameterDrafts: Dispatch<SetStateAction<Record<string, string>>>
  setRiskBudgetDraft: Dispatch<SetStateAction<string>>
  setStrategyEditorDraftStrategyId: Dispatch<SetStateAction<string | null>>
  setReviewInspectorReviewId: Dispatch<SetStateAction<string | null>>
  setReviewInspectorOpen: Dispatch<SetStateAction<boolean>>
  setReviewInspectorStrategyId: Dispatch<SetStateAction<string | null>>
  setReplayFocusedReviewId: Dispatch<SetStateAction<string | null>>
  setSelectedProposalId: Dispatch<SetStateAction<string | null>>
  setSelectedChangeRequestId: Dispatch<SetStateAction<string | null>>
  setBacktestFilter: Dispatch<SetStateAction<WorkspaceBootstrap['backtest_filter']>>
  setReplayTrackingScope: Dispatch<SetStateAction<WorkspaceBootstrap['replay_tracking_scope']>>
  setAlertSeverityFilter: Dispatch<SetStateAction<WorkspaceBootstrap['alert_severity_filter']>>
  setAlertStatusFilter: Dispatch<SetStateAction<WorkspaceBootstrap['alert_status_filter']>>
  setAlertScopeFilter: Dispatch<SetStateAction<WorkspaceBootstrap['alert_scope_filter']>>
  setTradeModeFilter: Dispatch<SetStateAction<WorkspaceBootstrap['trade_mode_filter']>>
  setTradeOriginFilter: Dispatch<SetStateAction<WorkspaceBootstrap['trade_origin_filter']>>
  setTradeScopeFilter: Dispatch<SetStateAction<WorkspaceBootstrap['trade_scope_filter']>>
  setAuditSeverityFilter: Dispatch<SetStateAction<WorkspaceBootstrap['audit_severity_filter']>>
  setAuditSourceFilter: Dispatch<SetStateAction<string>>
  setAuditScopeFilter: Dispatch<SetStateAction<WorkspaceBootstrap['audit_scope_filter']>>
  setAuditSearch: Dispatch<SetStateAction<string>>
  setCardOrder: Dispatch<SetStateAction<string[]>>
  setVisibleOverviewCards: Dispatch<SetStateAction<string[]>>
  setCollapsedOverviewCards: Dispatch<SetStateAction<string[]>>
}
