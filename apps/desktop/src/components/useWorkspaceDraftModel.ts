import { useMemo } from 'react'

import type { LayoutPreset, Mode, SectionKey, StrategySummary } from '../types'
import type { MarketTimeframe, WorkspaceBootstrap } from '../utils/workspace-helpers'
import { buildWorkspaceDraft } from '../utils/workspace-helpers'

const EMPTY_STRATEGY_EDITOR_DRAFTS: Record<string, string> = {}

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

export function useWorkspaceDraftModel({
  activeSection,
  layoutPreset,
  selectedMode,
  selectedSymbol,
  selectedMarketTimeframe,
  selectedStrategy,
  selectedStrategyId,
  selectedBacktestId,
  aiSchedulerFocusedJobId,
  strategyActivityPanelOpen,
  strategyTrackingPanelOpen,
  strategyEditorOpen,
  strategyTrackingKind,
  strategyTrackingSummary,
  strategyTrackingDetail,
  strategyEditorDraftStrategyId,
  parameterDrafts,
  riskBudgetDraft,
  reviewInspectorOpen,
  reviewInspectorReviewId,
  reviewInspectorStrategyId,
  replayFocusedReviewId,
  selectedProposalId,
  selectedChangeRequestId,
  backtestFilter,
  replayTrackingScope,
  alertSeverityFilter,
  alertStatusFilter,
  alertScopeFilter,
  tradeModeFilter,
  tradeOriginFilter,
  tradeScopeFilter,
  auditSeverityFilter,
  auditSourceFilter,
  auditScopeFilter,
  auditSearch,
  cardOrder,
  visibleOverviewCards,
  collapsedOverviewCards,
}: UseWorkspaceDraftModelArgs) {
  const selectedStrategyDetailPanel =
    activeSection === 'strategy'
      ? strategyTrackingPanelOpen
        ? 'tracking'
        : strategyEditorOpen
          ? 'editor'
          : strategyActivityPanelOpen
            ? 'activity'
            : null
      : null

  const selectedStrategyWorkspaceId = (selectedStrategy?.id ?? selectedStrategyId) || null
  const persistedStrategyEditorDraftStrategyId =
    activeSection === 'strategy' &&
    selectedStrategyWorkspaceId &&
    strategyEditorDraftStrategyId === selectedStrategyWorkspaceId
      ? strategyEditorDraftStrategyId
      : null
  const persistedStrategyEditorParameterDrafts = persistedStrategyEditorDraftStrategyId
    ? parameterDrafts
    : EMPTY_STRATEGY_EDITOR_DRAFTS
  const persistedStrategyEditorRiskBudgetDraft = persistedStrategyEditorDraftStrategyId
    ? riskBudgetDraft
    : ''

  const currentWorkspaceDraft = useMemo(
    () =>
      buildWorkspaceDraft({
        activeSection,
        layoutPreset,
        selectedMode,
        selectedSymbol,
        selectedMarketTimeframe,
        selectedStrategyWorkspaceId,
        selectedBacktestId,
        aiSchedulerFocusedJobId,
        selectedStrategyDetailPanel,
        strategyTrackingKind,
        strategyTrackingSummary,
        strategyTrackingDetail,
        persistedStrategyEditorDraftStrategyId,
        persistedStrategyEditorParameterDrafts,
        persistedStrategyEditorRiskBudgetDraft,
        reviewInspectorOpen,
        reviewInspectorReviewId,
        reviewInspectorStrategyId,
        replayFocusedReviewId,
        selectedProposalId,
        selectedChangeRequestId,
        backtestFilter,
        replayTrackingScope,
        alertSeverityFilter,
        alertStatusFilter,
        alertScopeFilter,
        tradeModeFilter,
        tradeOriginFilter,
        tradeScopeFilter,
        auditSeverityFilter,
        auditSourceFilter,
        auditScopeFilter,
        auditSearch,
        cardOrder,
        visibleOverviewCards,
        collapsedOverviewCards,
      }),
    [
      activeSection,
      aiSchedulerFocusedJobId,
      alertScopeFilter,
      alertSeverityFilter,
      alertStatusFilter,
      auditScopeFilter,
      auditSearch,
      auditSeverityFilter,
      auditSourceFilter,
      backtestFilter,
      cardOrder,
      collapsedOverviewCards,
      layoutPreset,
      persistedStrategyEditorDraftStrategyId,
      persistedStrategyEditorParameterDrafts,
      persistedStrategyEditorRiskBudgetDraft,
      replayFocusedReviewId,
      replayTrackingScope,
      reviewInspectorOpen,
      reviewInspectorReviewId,
      reviewInspectorStrategyId,
      selectedBacktestId,
      selectedChangeRequestId,
      selectedMarketTimeframe,
      selectedMode,
      selectedProposalId,
      selectedStrategyDetailPanel,
      selectedStrategyWorkspaceId,
      selectedSymbol,
      strategyTrackingDetail,
      strategyTrackingKind,
      strategyTrackingSummary,
      tradeModeFilter,
      tradeOriginFilter,
      tradeScopeFilter,
      visibleOverviewCards,
    ],
  )

  return {
    currentWorkspaceDraft,
    selectedStrategyWorkspaceId,
    selectedStrategyDetailPanel,
    persistedStrategyEditorDraftStrategyId,
    persistedStrategyEditorParameterDrafts,
    persistedStrategyEditorRiskBudgetDraft,
  }
}
