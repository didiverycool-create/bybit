import { startTransition } from 'react'
import type { ComponentProps, Dispatch, SetStateAction } from 'react'

import type { SectionKey } from '../types'
import AppOverlayPanelsContainer from './AppOverlayPanelsContainer'
import type { useReviewInspectorModel } from './useReviewInspectorModel'
import type { useStrategyWorkflowActions } from './useStrategyWorkflowActions'
import type { useStrategyWorkspaceActions } from './useStrategyWorkspaceActions'

type AppOverlayPanelsProps = ComponentProps<typeof AppOverlayPanelsContainer>
type StrategyWorkspaceActionsModel = ReturnType<typeof useStrategyWorkspaceActions>
type StrategyWorkflowActionsModel = ReturnType<typeof useStrategyWorkflowActions>
type ReviewInspectorModel = ReturnType<typeof useReviewInspectorModel>

type ReviewInspectorState = ReviewInspectorModel

export type BuildAppOverlayPanelsReviewStrategyPropsArgs = {
  panelState: {
    strategyEditorOpen: boolean
    strategyTrackingPanelOpen: boolean
    reviewInspectorOpen: boolean
  }
  panelSetters: {
    setStrategyEditorOpen: Dispatch<SetStateAction<boolean>>
    setStrategyTrackingPanelOpen: Dispatch<SetStateAction<boolean>>
    setReviewInspectorOpen: Dispatch<SetStateAction<boolean>>
    setParameterDrafts: Dispatch<SetStateAction<Record<string, string>>>
    setRiskBudgetDraft: Dispatch<SetStateAction<string>>
    setStrategyTrackingKind: Dispatch<SetStateAction<'issue' | 'change'>>
    setStrategyTrackingSummary: Dispatch<SetStateAction<string>>
    setStrategyTrackingDetail: Dispatch<SetStateAction<string>>
    setActiveSection: Dispatch<SetStateAction<SectionKey>>
    setReplayFocusedReviewId: Dispatch<SetStateAction<string | null>>
  }
  navigationActions: {
    onOpenStrategyReplay: (strategyId: string) => void
    onOpenReviewInspector: (reviewId: string, strategyId?: string | null) => void
    onOpenStrategyActivity: (strategyId: string) => void
    onOpenChangeRequest: (changeRequestId: string, strategyId?: string | null) => void
    onOpenBacktestDetail: (backtestId: string, strategyId?: string | null) => void
    onOpenSourceReview: (reviewId: string, strategyId?: string | null) => void
    onOpenStrategyProposal: (proposalId: string, strategyId?: string | null) => void
    onOpenAiSchedulerJob: (jobId: string) => void
  }
  strategyWorkspaceActions: StrategyWorkspaceActionsModel
  strategyWorkflowActions: StrategyWorkflowActionsModel
  reviewInspectorModel: ReviewInspectorState
  dataState: {
    serviceAvailable: boolean
    selectedStrategy: AppOverlayPanelsProps['strategyEditorState']['strategy']
    parameterDrafts: Record<string, string>
    riskBudgetDraft: string
    hasParameterDraftChanges: boolean
    parameterDraftPatchCount: number
    riskBudgetChanged: boolean
    strategyTrackingKind: 'issue' | 'change'
    strategyTrackingSummary: string
    strategyTrackingDetail: string
    reviewInspectorStrategyId: string | null
  }
  pendingState: {
    changeRequestMutationPending: boolean
    strategyTrackingMutationPending: boolean
    backtestMutationPending: boolean
    retryAgentJobMutationPending: boolean
    proposalMutationPending: boolean
  }
}

export function buildAppOverlayPanelsReviewStrategyProps({
  panelState,
  panelSetters,
  navigationActions,
  strategyWorkspaceActions,
  strategyWorkflowActions,
  reviewInspectorModel,
  dataState,
  pendingState,
}: BuildAppOverlayPanelsReviewStrategyPropsArgs): Pick<
  AppOverlayPanelsProps,
  | 'strategyEditorState'
  | 'strategyEditorActions'
  | 'strategyTrackingState'
  | 'strategyTrackingActions'
  | 'reviewInspectorState'
  | 'reviewInspectorActions'
> {
  return {
    strategyEditorState: {
      open: panelState.strategyEditorOpen,
      strategy: dataState.selectedStrategy,
      parameterDrafts: dataState.parameterDrafts,
      riskBudgetDraft: dataState.riskBudgetDraft,
      hasParameterDraftChanges: dataState.hasParameterDraftChanges,
      parameterDraftPatchCount: dataState.parameterDraftPatchCount,
      riskBudgetChanged: dataState.riskBudgetChanged,
      serviceAvailable: dataState.serviceAvailable,
      pending: pendingState.changeRequestMutationPending,
    },
    strategyEditorActions: {
      setOpen: panelSetters.setStrategyEditorOpen,
      setParameterDrafts: panelSetters.setParameterDrafts,
      setRiskBudgetDraft: panelSetters.setRiskBudgetDraft,
      onSubmitParameterUpdate: strategyWorkspaceActions.submitSelectedStrategyParameterUpdate,
      onSubmitRiskUpdate: strategyWorkspaceActions.submitSelectedStrategyRiskUpdate,
    },
    strategyTrackingState: {
      open: panelState.strategyTrackingPanelOpen,
      strategy: dataState.selectedStrategy,
      kind: dataState.strategyTrackingKind,
      summary: dataState.strategyTrackingSummary,
      detail: dataState.strategyTrackingDetail,
      serviceAvailable: dataState.serviceAvailable,
      pending: pendingState.strategyTrackingMutationPending,
    },
    strategyTrackingActions: {
      setOpen: panelSetters.setStrategyTrackingPanelOpen,
      setKind: panelSetters.setStrategyTrackingKind,
      setSummary: panelSetters.setStrategyTrackingSummary,
      setDetail: panelSetters.setStrategyTrackingDetail,
      onSubmit: () => {
        void strategyWorkflowActions.submitStrategyTrackingReview()
      },
    },
    reviewInspectorState: {
      open: panelState.reviewInspectorOpen,
      review: reviewInspectorModel.review,
      strategyId: reviewInspectorModel.strategyId,
      strategyLabel: reviewInspectorModel.strategyLabel,
      lineageMeta: reviewInspectorModel.lineageMeta,
      decisionMeta: reviewInspectorModel.decisionMeta,
      proposalItems: reviewInspectorModel.proposalItems,
      serviceAvailable: dataState.serviceAvailable,
      backtestPending: pendingState.backtestMutationPending,
      retryPending: pendingState.retryAgentJobMutationPending,
      proposalMutationPending: pendingState.proposalMutationPending,
    },
    reviewInspectorActions: {
      onClose: () => {
        panelSetters.setReviewInspectorOpen(false)
      },
      onOpenReplay: () => {
        if (!reviewInspectorModel.review) {
          return
        }
        if (dataState.reviewInspectorStrategyId) {
          navigationActions.onOpenStrategyReplay(dataState.reviewInspectorStrategyId)
          return
        }
        startTransition(() => {
          panelSetters.setActiveSection('replay')
          panelSetters.setReplayFocusedReviewId(reviewInspectorModel.review?.id ?? null)
        })
      },
      onOpenReviewInspector: navigationActions.onOpenReviewInspector,
      onOpenStrategy: navigationActions.onOpenStrategyActivity,
      onOpenChangeRequest: navigationActions.onOpenChangeRequest,
      onOpenBacktest: navigationActions.onOpenBacktestDetail,
      onOpenSourceReview: navigationActions.onOpenSourceReview,
      onOpenProposal: navigationActions.onOpenStrategyProposal,
      onOpenJob: navigationActions.onOpenAiSchedulerJob,
      onRerunBacktest: (review) => {
        void strategyWorkflowActions.rerunBacktestFromReview(review)
      },
      onRetryJob: (jobId) => {
        void strategyWorkflowActions.retryAgentJob(jobId, { focusJob: true })
      },
      onProposalAction: (proposalId, action) => {
        void strategyWorkflowActions.handleProposalAction(proposalId, action)
      },
    },
  }
}
