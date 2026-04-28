import type { QueryClient } from '@tanstack/react-query'

import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useWorkspaceDraftModel } from './useWorkspaceDraftModel'
import type { UseWorkspaceServerStateBridgeArgs } from './workspaceServerStateBridge.types'
import type { WorkspaceServerSyncSetters } from './workspaceServerSyncTypes'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type WorkspaceDraftModel = ReturnType<typeof useWorkspaceDraftModel>

export type BuildWorkspaceServerSyncArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  WorkspaceDraftModel & {
    queryClient: QueryClient
  }

export function buildWorkspaceServerSyncArgs({
  queryClient,
  currentWorkspaceDraft,
  workspaceQuery,
  lastSyncedWorkspaceSignature,
  setWorkspaceConflict,
  ...input
}: BuildWorkspaceServerSyncArgsInput): UseWorkspaceServerStateBridgeArgs {
  return {
    queryClient,
    currentWorkspaceDraft,
    workspaceQueryData: workspaceQuery.data,
    lastSyncedWorkspaceSignature,
    setWorkspaceConflict,
    ...buildWorkspaceServerSyncSetterArgs(input),
  }
}

function buildWorkspaceServerSyncSetterArgs({
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
}: Pick<BuildWorkspaceServerSyncArgsInput, keyof WorkspaceServerSyncSetters>): WorkspaceServerSyncSetters {
  return {
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
  }
}
