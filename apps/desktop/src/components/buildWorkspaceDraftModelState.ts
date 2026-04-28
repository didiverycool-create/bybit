import { buildWorkspaceDraft } from '../utils/workspace-helpers'
import type { UseWorkspaceDraftModelArgs, UseWorkspaceDraftModelResult } from './useWorkspaceDraftModel.types'

const EMPTY_STRATEGY_EDITOR_DRAFTS: Record<string, string> = {}

function resolveSelectedStrategyDetailPanel({
  activeSection,
  strategyTrackingPanelOpen,
  strategyEditorOpen,
  strategyActivityPanelOpen,
}: Pick<
  UseWorkspaceDraftModelArgs,
  'activeSection' | 'strategyTrackingPanelOpen' | 'strategyEditorOpen' | 'strategyActivityPanelOpen'
>): UseWorkspaceDraftModelResult['selectedStrategyDetailPanel'] {
  if (activeSection !== 'strategy') {
    return null
  }
  if (strategyTrackingPanelOpen) {
    return 'tracking'
  }
  if (strategyEditorOpen) {
    return 'editor'
  }
  if (strategyActivityPanelOpen) {
    return 'activity'
  }
  return null
}

function resolvePersistedStrategyEditorDraftState({
  activeSection,
  selectedStrategyWorkspaceId,
  strategyEditorDraftStrategyId,
  parameterDrafts,
  riskBudgetDraft,
}: Pick<
  UseWorkspaceDraftModelArgs,
  'activeSection' | 'strategyEditorDraftStrategyId' | 'parameterDrafts' | 'riskBudgetDraft'
> & {
  selectedStrategyWorkspaceId: string | null
}): Pick<
  UseWorkspaceDraftModelResult,
  | 'persistedStrategyEditorDraftStrategyId'
  | 'persistedStrategyEditorParameterDrafts'
  | 'persistedStrategyEditorRiskBudgetDraft'
> {
  const persistedStrategyEditorDraftStrategyId =
    activeSection === 'strategy' &&
    selectedStrategyWorkspaceId &&
    strategyEditorDraftStrategyId === selectedStrategyWorkspaceId
      ? strategyEditorDraftStrategyId
      : null

  return {
    persistedStrategyEditorDraftStrategyId,
    persistedStrategyEditorParameterDrafts: persistedStrategyEditorDraftStrategyId
      ? parameterDrafts
      : EMPTY_STRATEGY_EDITOR_DRAFTS,
    persistedStrategyEditorRiskBudgetDraft: persistedStrategyEditorDraftStrategyId ? riskBudgetDraft : '',
  }
}

export function buildWorkspaceDraftModelState(
  args: UseWorkspaceDraftModelArgs,
): UseWorkspaceDraftModelResult {
  const selectedStrategyWorkspaceId = (args.selectedStrategy?.id ?? args.selectedStrategyId) || null
  const selectedStrategyDetailPanel = resolveSelectedStrategyDetailPanel(args)
  const {
    persistedStrategyEditorDraftStrategyId,
    persistedStrategyEditorParameterDrafts,
    persistedStrategyEditorRiskBudgetDraft,
  } = resolvePersistedStrategyEditorDraftState({
    activeSection: args.activeSection,
    selectedStrategyWorkspaceId,
    strategyEditorDraftStrategyId: args.strategyEditorDraftStrategyId,
    parameterDrafts: args.parameterDrafts,
    riskBudgetDraft: args.riskBudgetDraft,
  })

  return {
    currentWorkspaceDraft: buildWorkspaceDraft({
      activeSection: args.activeSection,
      layoutPreset: args.layoutPreset,
      selectedMode: args.selectedMode,
      selectedSymbol: args.selectedSymbol,
      selectedMarketTimeframe: args.selectedMarketTimeframe,
      selectedStrategyWorkspaceId,
      selectedBacktestId: args.selectedBacktestId,
      aiSchedulerFocusedJobId: args.aiSchedulerFocusedJobId,
      selectedStrategyDetailPanel,
      strategyTrackingKind: args.strategyTrackingKind,
      strategyTrackingSummary: args.strategyTrackingSummary,
      strategyTrackingDetail: args.strategyTrackingDetail,
      persistedStrategyEditorDraftStrategyId,
      persistedStrategyEditorParameterDrafts,
      persistedStrategyEditorRiskBudgetDraft,
      reviewInspectorOpen: args.reviewInspectorOpen,
      reviewInspectorReviewId: args.reviewInspectorReviewId,
      reviewInspectorStrategyId: args.reviewInspectorStrategyId,
      replayFocusedReviewId: args.replayFocusedReviewId,
      selectedProposalId: args.selectedProposalId,
      selectedChangeRequestId: args.selectedChangeRequestId,
      backtestFilter: args.backtestFilter,
      replayTrackingScope: args.replayTrackingScope,
      alertSeverityFilter: args.alertSeverityFilter,
      alertStatusFilter: args.alertStatusFilter,
      alertScopeFilter: args.alertScopeFilter,
      tradeModeFilter: args.tradeModeFilter,
      tradeOriginFilter: args.tradeOriginFilter,
      tradeScopeFilter: args.tradeScopeFilter,
      auditSeverityFilter: args.auditSeverityFilter,
      auditSourceFilter: args.auditSourceFilter,
      auditScopeFilter: args.auditScopeFilter,
      auditSearch: args.auditSearch,
      cardOrder: args.cardOrder,
      visibleOverviewCards: args.visibleOverviewCards,
      collapsedOverviewCards: args.collapsedOverviewCards,
    }),
    selectedStrategyWorkspaceId,
    selectedStrategyDetailPanel,
    persistedStrategyEditorDraftStrategyId,
    persistedStrategyEditorParameterDrafts,
    persistedStrategyEditorRiskBudgetDraft,
  }
}
