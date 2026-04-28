import type { AppOverlayPanelsContainerProps } from './AppOverlayPanelsContainer.types'
import type { AppOverlayPanelsHostProps } from './AppOverlayPanelsHost'

type AppOverlayPanelsReviewStrategyHostPropsArgs = Pick<
  AppOverlayPanelsContainerProps,
  'strategyEditorState' | 'strategyEditorActions' | 'strategyTrackingState' | 'strategyTrackingActions' | 'reviewInspectorState' | 'reviewInspectorActions'
>

export function buildAppOverlayPanelsReviewStrategyHostProps({
  strategyEditorState,
  strategyEditorActions,
  strategyTrackingState,
  strategyTrackingActions,
  reviewInspectorState,
  reviewInspectorActions,
}: AppOverlayPanelsReviewStrategyHostPropsArgs): Pick<
  AppOverlayPanelsHostProps,
  'strategyEditorPanelProps' | 'strategyTrackingPanelProps' | 'reviewInspectorPanelProps'
> {
  return {
    strategyEditorPanelProps: {
      ...strategyEditorState,
      onParameterDraftChange: (key, value) =>
        strategyEditorActions.setParameterDrafts((current) => ({
          ...current,
          [key]: value,
        })),
      onRiskBudgetDraftChange: strategyEditorActions.setRiskBudgetDraft,
      onSubmitParameterUpdate: strategyEditorActions.onSubmitParameterUpdate,
      onSubmitRiskUpdate: strategyEditorActions.onSubmitRiskUpdate,
      onClose: () => strategyEditorActions.setOpen(false),
    },
    strategyTrackingPanelProps: {
      ...strategyTrackingState,
      onKindChange: strategyTrackingActions.setKind,
      onSummaryChange: strategyTrackingActions.setSummary,
      onDetailChange: strategyTrackingActions.setDetail,
      onSubmit: strategyTrackingActions.onSubmit,
      onClose: () => strategyTrackingActions.setOpen(false),
    },
    reviewInspectorPanelProps: {
      ...reviewInspectorState,
      onClose: reviewInspectorActions.onClose,
      onOpenReplay: reviewInspectorActions.onOpenReplay,
      onOpenReviewInspector: reviewInspectorActions.onOpenReviewInspector,
      onOpenStrategy: reviewInspectorActions.onOpenStrategy,
      onOpenChangeRequest: reviewInspectorActions.onOpenChangeRequest,
      onOpenBacktest: reviewInspectorActions.onOpenBacktest,
      onOpenSourceReview: reviewInspectorActions.onOpenSourceReview,
      onOpenProposal: reviewInspectorActions.onOpenProposal,
      onOpenJob: reviewInspectorActions.onOpenJob,
      onRerunBacktest: reviewInspectorActions.onRerunBacktest,
      onRetryJob: reviewInspectorActions.onRetryJob,
      onProposalAction: reviewInspectorActions.onProposalAction,
    },
  }
}
