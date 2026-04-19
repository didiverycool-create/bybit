import type { QueryClient } from '@tanstack/react-query'

import { api } from '../api'
import type { WorkspacePreferences } from '../types'
import type { WorkspaceBootstrap } from '../utils/workspace-helpers'
import {
  buildDefaultWorkspaceBootstrap,
  buildWorkspaceSignature,
  normalizeCardIds,
  normalizeCollapsedCardIds,
  normalizeVisibleCardIds,
  normalizeWorkspaceMarketTimeframe,
} from '../utils/workspace-helpers'
import type {
  WorkspaceServerSyncSetters,
  WorkspaceServerSyncWorkspace,
} from './workspaceServerSyncTypes'

export function applyWorkspaceServerState(
  nextWorkspace: WorkspaceServerSyncWorkspace,
  {
    setWorkspaceSavedAt,
    setLastSyncedWorkspaceSignature,
    setActiveSection,
    setLayoutPreset,
    setSelectedMode,
    setSelectedSymbol,
    setSelectedMarketTimeframe,
    setSelectedStrategyId,
    setSelectedBacktestId,
    setAiSchedulerFocusedJobId,
    setStrategyActivityPanelOpen,
    setStrategyTrackingPanelOpen,
    setStrategyEditorOpen,
    setStrategyTrackingKind,
    setStrategyTrackingSummary,
    setStrategyTrackingDetail,
    setParameterDrafts,
    setRiskBudgetDraft,
    setStrategyEditorDraftStrategyId,
    setReviewInspectorReviewId,
    setReviewInspectorOpen,
    setReviewInspectorStrategyId,
    setReplayFocusedReviewId,
    setSelectedProposalId,
    setSelectedChangeRequestId,
    setBacktestFilter,
    setReplayTrackingScope,
    setAlertSeverityFilter,
    setAlertStatusFilter,
    setAlertScopeFilter,
    setTradeModeFilter,
    setTradeOriginFilter,
    setTradeScopeFilter,
    setAuditSeverityFilter,
    setAuditSourceFilter,
    setAuditScopeFilter,
    setAuditSearch,
    setCardOrder,
    setVisibleOverviewCards,
    setCollapsedOverviewCards,
  }: WorkspaceServerSyncSetters,
) {
  const defaults = buildDefaultWorkspaceBootstrap()
  setActiveSection(nextWorkspace.active_section)
  setLayoutPreset(nextWorkspace.layout_preset)
  setSelectedMode(nextWorkspace.selected_mode)
  setSelectedSymbol(nextWorkspace.selected_symbol)
  setSelectedMarketTimeframe(
    normalizeWorkspaceMarketTimeframe(nextWorkspace.selected_market_timeframe),
  )
  setSelectedStrategyId(nextWorkspace.selected_strategy_id ?? null)
  setSelectedBacktestId(nextWorkspace.selected_backtest_id ?? null)
  setAiSchedulerFocusedJobId(nextWorkspace.selected_scheduler_job_id ?? null)
  setStrategyActivityPanelOpen(nextWorkspace.selected_strategy_detail_panel === 'activity')
  setStrategyTrackingPanelOpen(nextWorkspace.selected_strategy_detail_panel === 'tracking')
  setStrategyEditorOpen(nextWorkspace.selected_strategy_detail_panel === 'editor')
  setStrategyTrackingKind(nextWorkspace.selected_strategy_tracking_kind ?? 'issue')
  setStrategyTrackingSummary(nextWorkspace.selected_strategy_tracking_summary ?? '')
  setStrategyTrackingDetail(nextWorkspace.selected_strategy_tracking_detail ?? '')
  setParameterDrafts(nextWorkspace.selected_strategy_editor_parameter_drafts ?? {})
  setRiskBudgetDraft(nextWorkspace.selected_strategy_editor_risk_budget_draft ?? '')
  setStrategyEditorDraftStrategyId(nextWorkspace.selected_strategy_editor_strategy_id ?? null)
  setReviewInspectorReviewId(nextWorkspace.selected_review_inspector_id ?? null)
  setReviewInspectorOpen(Boolean(nextWorkspace.selected_review_inspector_id))
  setReviewInspectorStrategyId(nextWorkspace.selected_review_inspector_strategy_id ?? null)
  setReplayFocusedReviewId(nextWorkspace.selected_review_id ?? null)
  setSelectedProposalId(nextWorkspace.selected_proposal_id ?? null)
  setSelectedChangeRequestId(nextWorkspace.selected_change_request_id ?? null)
  setBacktestFilter(nextWorkspace.backtest_filter ?? defaults.backtest_filter)
  setReplayTrackingScope(nextWorkspace.replay_tracking_scope ?? defaults.replay_tracking_scope)
  setAlertSeverityFilter(nextWorkspace.alert_severity_filter ?? defaults.alert_severity_filter)
  setAlertStatusFilter(nextWorkspace.alert_status_filter ?? defaults.alert_status_filter)
  setAlertScopeFilter(nextWorkspace.alert_scope_filter ?? defaults.alert_scope_filter)
  setTradeModeFilter(nextWorkspace.trade_mode_filter ?? defaults.trade_mode_filter)
  setTradeOriginFilter(nextWorkspace.trade_origin_filter ?? defaults.trade_origin_filter)
  setTradeScopeFilter(nextWorkspace.trade_scope_filter ?? defaults.trade_scope_filter)
  setAuditSeverityFilter(nextWorkspace.audit_severity_filter ?? defaults.audit_severity_filter)
  setAuditSourceFilter(
    typeof nextWorkspace.audit_source_filter === 'string' && nextWorkspace.audit_source_filter.trim()
      ? nextWorkspace.audit_source_filter.trim()
      : defaults.audit_source_filter,
  )
  setAuditScopeFilter(nextWorkspace.audit_scope_filter ?? defaults.audit_scope_filter)
  setAuditSearch(String(nextWorkspace.audit_search ?? defaults.audit_search))
  setCardOrder(normalizeCardIds(nextWorkspace.overview_card_order))
  setVisibleOverviewCards(
    normalizeVisibleCardIds(
      nextWorkspace.overview_visible_cards,
      nextWorkspace.overview_card_order,
    ),
  )
  setCollapsedOverviewCards(
    normalizeCollapsedCardIds(
      nextWorkspace.overview_collapsed_cards ?? [],
      nextWorkspace.overview_card_order,
    ),
  )
  setWorkspaceSavedAt(nextWorkspace.updated_at)
  setLastSyncedWorkspaceSignature(buildWorkspaceSignature(nextWorkspace))
}

export async function applyWorkspaceServerStateWithMarketPrefetch(
  nextWorkspace: WorkspaceServerSyncWorkspace,
  {
    queryClient,
    applyWorkspaceState,
  }: {
    queryClient: QueryClient
    applyWorkspaceState: (workspace: WorkspaceServerSyncWorkspace) => void
  },
) {
  const nextSection = nextWorkspace.active_section
  const nextSymbol = String(nextWorkspace.selected_symbol || '').trim().toUpperCase()
  const nextTimeframe = normalizeWorkspaceMarketTimeframe(
    nextWorkspace.selected_market_timeframe,
  )

  if ((nextSection === 'overview' || nextSection === 'market') && nextSymbol) {
    try {
      await queryClient.fetchQuery({
        queryKey: ['market-live', nextSymbol, nextTimeframe],
        queryFn: () => api.getMarketLiveSnapshot(nextSymbol, nextTimeframe),
        staleTime: 0,
      })
    } catch {
      // let the visible query continue retrying after the workspace state changes
    }
  }

  applyWorkspaceState(nextWorkspace)
}

export type WorkspaceServerSyncEffectInput = {
  workspaceQueryData: WorkspaceBootstrap | WorkspacePreferences | null | undefined
  currentWorkspaceDraft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>
  lastSyncedWorkspaceSignature: string
}
