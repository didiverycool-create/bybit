import type { BuildAppOverlayPanelsAssemblerArgs } from './buildAppOverlayPanelsAssembler'
import { buildAppOverlayPanelsReviewStrategyProps } from './buildAppOverlayPanelsReviewStrategyProps'

export function buildAppOverlayPanelsReviewStrategySection({
  panelState,
  panelSetters,
  navigationActions,
  strategyWorkspaceActions,
  strategyWorkflowActions,
  reviewInspectorModel,
  dataState,
  pendingState,
}: BuildAppOverlayPanelsAssemblerArgs) {
  return buildAppOverlayPanelsReviewStrategyProps({
    panelState: {
      strategyEditorOpen: panelState.strategyEditorOpen,
      strategyTrackingPanelOpen: panelState.strategyTrackingPanelOpen,
      reviewInspectorOpen: panelState.reviewInspectorOpen,
    },
    panelSetters: {
      setStrategyEditorOpen: panelSetters.setStrategyEditorOpen,
      setStrategyTrackingPanelOpen: panelSetters.setStrategyTrackingPanelOpen,
      setReviewInspectorOpen: panelSetters.setReviewInspectorOpen,
      setParameterDrafts: panelSetters.setParameterDrafts,
      setRiskBudgetDraft: panelSetters.setRiskBudgetDraft,
      setStrategyTrackingKind: panelSetters.setStrategyTrackingKind,
      setStrategyTrackingSummary: panelSetters.setStrategyTrackingSummary,
      setStrategyTrackingDetail: panelSetters.setStrategyTrackingDetail,
      setActiveSection: panelSetters.setActiveSection,
      setReplayFocusedReviewId: panelSetters.setReplayFocusedReviewId,
    },
    navigationActions: {
      onOpenStrategyReplay: navigationActions.onOpenStrategyReplay,
      onOpenReviewInspector: navigationActions.onOpenReviewInspector,
      onOpenStrategyActivity: navigationActions.onOpenStrategyActivity,
      onOpenChangeRequest: navigationActions.onOpenChangeRequest,
      onOpenBacktestDetail: navigationActions.onOpenBacktestDetail,
      onOpenSourceReview: navigationActions.onOpenSourceReview,
      onOpenStrategyProposal: navigationActions.onOpenStrategyProposal,
      onOpenAiSchedulerJob: navigationActions.onOpenAiSchedulerJob,
    },
    strategyWorkspaceActions,
    strategyWorkflowActions,
    reviewInspectorModel,
    dataState: {
      serviceAvailable: dataState.serviceAvailable,
      selectedStrategy: dataState.selectedStrategy,
      parameterDrafts: dataState.parameterDrafts,
      riskBudgetDraft: dataState.riskBudgetDraft,
      hasParameterDraftChanges: dataState.hasParameterDraftChanges,
      parameterDraftPatchCount: dataState.parameterDraftPatchCount,
      riskBudgetChanged: dataState.riskBudgetChanged,
      strategyTrackingKind: dataState.strategyTrackingKind,
      strategyTrackingSummary: dataState.strategyTrackingSummary,
      strategyTrackingDetail: dataState.strategyTrackingDetail,
      reviewInspectorStrategyId: dataState.reviewInspectorStrategyId,
    },
    pendingState: {
      changeRequestMutationPending: pendingState.changeRequestMutationPending,
      strategyTrackingMutationPending: pendingState.strategyTrackingMutationPending,
      backtestMutationPending: pendingState.backtestMutationPending,
      retryAgentJobMutationPending: pendingState.retryAgentJobMutationPending,
      proposalMutationPending: pendingState.proposalMutationPending,
    },
  })
}
