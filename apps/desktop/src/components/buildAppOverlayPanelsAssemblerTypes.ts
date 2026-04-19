import type { ComponentProps, Dispatch, SetStateAction } from 'react'

import type { SchedulerState, SectionKey } from '../types'
import AppOverlayPanelsContainer from './AppOverlayPanelsContainer'
import type { useReviewInspectorModel } from './useReviewInspectorModel'
import type { useStrategyWorkflowActions } from './useStrategyWorkflowActions'
import type { useStrategyWorkspaceActions } from './useStrategyWorkspaceActions'
import type { useTradingExecutionActions } from './useTradingExecutionActions'
import type { useWorkspaceControlActions } from './useWorkspaceControlActions'
import type { useWorkspaceStatusModel } from './useWorkspaceStatusModel'

type AppOverlayPanelsProps = ComponentProps<typeof AppOverlayPanelsContainer>
type ManualOrderState = AppOverlayPanelsProps['manualTradeState']['manualOrder']
type ReviewInspectorState = ReturnType<typeof useReviewInspectorModel>
type WorkspaceStatusModel = ReturnType<typeof useWorkspaceStatusModel>
type TradingExecutionActionsModel = ReturnType<typeof useTradingExecutionActions>
type WorkspaceControlActionsModel = ReturnType<typeof useWorkspaceControlActions>
type StrategyWorkspaceActionsModel = ReturnType<typeof useStrategyWorkspaceActions>
type StrategyWorkflowActionsModel = ReturnType<typeof useStrategyWorkflowActions>

export type BuildAppOverlayPanelsAssemblerArgs = {
  panelState: {
    statusInspectorOpen: boolean
    watchlistManagerOpen: boolean
    schedulerControlsOpen: boolean
    grafanaPreviewOpen: boolean
    manualTradePanelOpen: boolean
    orderHistoryPanelOpen: boolean
    accountInspectorOpen: boolean
    strategyEditorOpen: boolean
    strategyTrackingPanelOpen: boolean
    reviewInspectorOpen: boolean
  }
  panelSetters: {
    setStatusInspectorOpen: Dispatch<SetStateAction<boolean>>
    setWatchlistManagerOpen: Dispatch<SetStateAction<boolean>>
    setSchedulerControlsOpen: Dispatch<SetStateAction<boolean>>
    setGrafanaPreviewOpen: Dispatch<SetStateAction<boolean>>
    setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
    setOrderHistoryPanelOpen: Dispatch<SetStateAction<boolean>>
    setAccountInspectorOpen: Dispatch<SetStateAction<boolean>>
    setStrategyEditorOpen: Dispatch<SetStateAction<boolean>>
    setStrategyTrackingPanelOpen: Dispatch<SetStateAction<boolean>>
    setReviewInspectorOpen: Dispatch<SetStateAction<boolean>>
    setWatchlistDraftSymbol: Dispatch<SetStateAction<string>>
    setWatchlistDraftMarket: Dispatch<SetStateAction<'spot' | 'perp'>>
    setWatchlistAlertDrafts: Dispatch<SetStateAction<Record<string, string>>>
    setManualOrder: Dispatch<SetStateAction<ManualOrderState>>
    setTradeOriginFilter: Dispatch<SetStateAction<'all' | 'manual' | 'strategy' | 'exchange'>>
    setTradeScopeFilter: Dispatch<SetStateAction<'all' | 'selected'>>
    setParameterDrafts: Dispatch<SetStateAction<Record<string, string>>>
    setRiskBudgetDraft: Dispatch<SetStateAction<string>>
    setStrategyTrackingKind: Dispatch<SetStateAction<'issue' | 'change'>>
    setStrategyTrackingSummary: Dispatch<SetStateAction<string>>
    setStrategyTrackingDetail: Dispatch<SetStateAction<string>>
    setActiveSection: Dispatch<SetStateAction<SectionKey>>
    setReplayFocusedReviewId: Dispatch<SetStateAction<string | null>>
  }
  navigationActions: {
    onOpenSection: (section: SectionKey) => void
    onOpenStrategyActivity: (strategyId: string) => void
    onOpenStrategyReplay: (strategyId: string) => void
    onOpenReviewInspector: (reviewId: string, strategyId?: string | null) => void
    onOpenChangeRequest: (changeRequestId: string, strategyId?: string | null) => void
    onOpenBacktestDetail: (backtestId: string, strategyId?: string | null) => void
    onOpenSourceReview: (reviewId: string, strategyId?: string | null) => void
    onOpenStrategyProposal: (proposalId: string, strategyId?: string | null) => void
    onOpenAiSchedulerJob: (jobId: string) => void
  }
  workspaceStatusModel: WorkspaceStatusModel
  workspaceControlActions: WorkspaceControlActionsModel
  tradingExecutionActions: TradingExecutionActionsModel
  strategyWorkspaceActions: StrategyWorkspaceActionsModel
  strategyWorkflowActions: StrategyWorkflowActionsModel
  reviewInspectorModel: ReviewInspectorState
  dataState: {
    snapshotScheduler?: SchedulerState | null
    serviceAvailable: boolean
    settings: {
      bybit_web_entry?: string | null
    } | null | undefined
    grafanaStatus: {
      metrics_path?: string | null
      dashboard_url?: string | null
      configured?: boolean | null
      note?: string | null
    } | null | undefined
    metricsPreviewLines: string[]
    pendingAlertsCount: number
    selectedMode: AppOverlayPanelsProps['manualTradeState']['selectedMode']
    selectedSymbol: string
    editingOrder: AppOverlayPanelsProps['manualTradeState']['editingOrder']
    manualOrder: ManualOrderState
    manualTradePreviewLoading: boolean
    manualTradePreview: AppOverlayPanelsProps['manualTradeState']['preview']
    manualTradingBlockedReason: string | null
    watchlist: AppOverlayPanelsProps['watchlistManagerState']['watchlist']
    watchlistDraftSymbol: string
    watchlistDraftMarket: 'spot' | 'perp'
    watchlistAlertDrafts: Record<string, string>
    watchlistControlsDisabled: boolean
    accountOverview: AppOverlayPanelsProps['accountInspectorState']['accountOverview']
    bybitPrivateStatus: AppOverlayPanelsProps['accountInspectorState']['bybitPrivateStatus']
    bybitPublicStatus: AppOverlayPanelsProps['accountInspectorState']['bybitPublicStatus']
    tradeProbeResult: AppOverlayPanelsProps['accountInspectorState']['tradeProbeResult']
    tradeProbePending: AppOverlayPanelsProps['accountInspectorState']['tradeProbePending']
    parameterDrafts: Record<string, string>
    riskBudgetDraft: string
    hasParameterDraftChanges: boolean
    parameterDraftPatchCount: number
    riskBudgetChanged: boolean
    selectedStrategy: AppOverlayPanelsProps['strategyEditorState']['strategy']
    strategyTrackingKind: 'issue' | 'change'
    strategyTrackingSummary: string
    strategyTrackingDetail: string
    reviewInspectorReviewId: string | null
    reviewInspectorStrategyId: string | null
    tradeOriginFilter: AppOverlayPanelsProps['orderHistoryState']['tradeOriginFilter']
    tradeScopeFilter: AppOverlayPanelsProps['orderHistoryState']['tradeScopeFilter']
    filteredOrderHistory: AppOverlayPanelsProps['orderHistoryState']['filteredOrderHistory']
  }
  pendingState: {
    changeRequestMutationPending: boolean
    schedulerMutationPending: boolean
    watchlistAddPending: boolean
    watchlistRemovePending: boolean
    manualTradeMutationPending: boolean
    exchangeOrderMutationPending: boolean
    paperOrderMutationPending: boolean
    replacePaperOrderPending: boolean
    replaceExchangeOrderPending: boolean
    cancelPaperOrderPending: boolean
    cancelExchangeOrderPending: boolean
    strategyTrackingMutationPending: boolean
    backtestMutationPending: boolean
    retryAgentJobMutationPending: boolean
    proposalMutationPending: boolean
  }
}
