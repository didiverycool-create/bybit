import { useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import { api } from '../api'
import type { LayoutPreset, Mode, SectionKey, WorkspacePreferences } from '../types'
import type { MarketTimeframe, WorkspaceBootstrap } from '../utils/workspace-helpers'
import {
  buildDefaultWorkspaceBootstrap,
  buildWorkspaceSignature,
  normalizeCardIds,
  normalizeCollapsedCardIds,
  normalizeVisibleCardIds,
  normalizeWorkspaceMarketTimeframe,
} from '../utils/workspace-helpers'

type UseWorkspaceServerSyncArgs = {
  queryClient: QueryClient
  currentWorkspaceDraft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>
  workspaceQueryData: WorkspaceBootstrap | WorkspacePreferences | null | undefined
  lastSyncedWorkspaceSignature: string
  setWorkspaceConflict: Dispatch<SetStateAction<boolean>>
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

export function useWorkspaceServerSync({
  queryClient,
  currentWorkspaceDraft,
  workspaceQueryData,
  lastSyncedWorkspaceSignature,
  setWorkspaceConflict,
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
}: UseWorkspaceServerSyncArgs) {
  const applyWorkspaceState = useCallback(
    (nextWorkspace: WorkspaceBootstrap | WorkspacePreferences) => {
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
        typeof nextWorkspace.audit_source_filter === 'string' &&
          nextWorkspace.audit_source_filter.trim()
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
    },
    [
      setActiveSection,
      setAiSchedulerFocusedJobId,
      setAlertScopeFilter,
      setAlertSeverityFilter,
      setAlertStatusFilter,
      setAuditScopeFilter,
      setAuditSearch,
      setAuditSeverityFilter,
      setAuditSourceFilter,
      setBacktestFilter,
      setCardOrder,
      setCollapsedOverviewCards,
      setLastSyncedWorkspaceSignature,
      setLayoutPreset,
      setParameterDrafts,
      setReplayFocusedReviewId,
      setReplayTrackingScope,
      setReviewInspectorOpen,
      setReviewInspectorReviewId,
      setReviewInspectorStrategyId,
      setRiskBudgetDraft,
      setSelectedBacktestId,
      setSelectedChangeRequestId,
      setSelectedMarketTimeframe,
      setSelectedMode,
      setSelectedProposalId,
      setSelectedStrategyId,
      setSelectedSymbol,
      setStrategyActivityPanelOpen,
      setStrategyEditorDraftStrategyId,
      setStrategyEditorOpen,
      setStrategyTrackingDetail,
      setStrategyTrackingKind,
      setStrategyTrackingPanelOpen,
      setStrategyTrackingSummary,
      setTradeModeFilter,
      setTradeOriginFilter,
      setTradeScopeFilter,
      setVisibleOverviewCards,
      setWorkspaceSavedAt,
    ],
  )

  const applyWorkspaceStateWithMarketPrefetch = useCallback(
    async (nextWorkspace: WorkspaceBootstrap | WorkspacePreferences) => {
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
    },
    [applyWorkspaceState, queryClient],
  )

  useEffect(() => {
    if (!workspaceQueryData) {
      return
    }
    const serverSignature = buildWorkspaceSignature(workspaceQueryData)
    const currentSignature = buildWorkspaceSignature(currentWorkspaceDraft)

    if (serverSignature === lastSyncedWorkspaceSignature) {
      setWorkspaceConflict(false)
      return
    }

    if (currentSignature !== lastSyncedWorkspaceSignature) {
      setWorkspaceConflict(true)
      return
    }

    let cancelled = false
    void (async () => {
      await applyWorkspaceStateWithMarketPrefetch(workspaceQueryData)
      if (!cancelled) {
        setWorkspaceConflict(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    applyWorkspaceStateWithMarketPrefetch,
    currentWorkspaceDraft,
    lastSyncedWorkspaceSignature,
    setWorkspaceConflict,
    workspaceQueryData,
  ])

  return {
    applyWorkspaceStateWithMarketPrefetch,
  }
}
