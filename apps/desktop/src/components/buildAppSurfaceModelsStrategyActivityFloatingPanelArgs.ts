import type { BuildAppSurfaceModelsArgs } from './buildAppSurfaceModels'
import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'

type StrategyActivityFloatingPanelSurfaceArgs = BuildAppSurfaceModelsArgsInput['strategyActivityFloatingPanel']

export function buildAppSurfaceModelsStrategyActivityFloatingPanelArgs(
  strategyActivityFloatingPanel: StrategyActivityFloatingPanelSurfaceArgs,
): BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel'] {
  return {
    baseArgs: {
      panelOpen: strategyActivityFloatingPanel.panelOpen,
      selectedStrategy: strategyActivityFloatingPanel.selectedStrategy,
      strategyActivitySnapshotModel: strategyActivityFloatingPanel.strategyActivitySnapshotModel,
      activityMeta: strategyActivityFloatingPanel.activityMeta,
      activeStrategyId: strategyActivityFloatingPanel.activeStrategyId,
      decisionModel: strategyActivityFloatingPanel.decisionModel,
      progressModel: strategyActivityFloatingPanel.progressModel,
      opsModel: strategyActivityFloatingPanel.opsModel,
    },
    derivedStateArgs: {
      queryState: strategyActivityFloatingPanel.queryState,
      serviceState: strategyActivityFloatingPanel.serviceState,
      workspaceState: strategyActivityFloatingPanel.workspaceState,
      focusLabels: strategyActivityFloatingPanel.focusLabels,
    },
    actionArgs: {
      openStrategyTrackingPanel:
        strategyActivityFloatingPanel.strategyWorkspaceActions.openStrategyTrackingPanel,
      setStrategyActivityPanelOpen: strategyActivityFloatingPanel.setters.setStrategyActivityPanelOpen,
      openAlertsSection: strategyActivityFloatingPanel.navigationActions.openAlertsSection,
      openMarketSymbol: strategyActivityFloatingPanel.navigationActions.openMarketSymbol,
      openTradesSection: strategyActivityFloatingPanel.navigationActions.openTradesSection,
      setWatchlistManagerOpen: strategyActivityFloatingPanel.setters.setWatchlistManagerOpen,
      toggleAlertAcknowledged:
        strategyActivityFloatingPanel.workspaceControlActions.toggleAlertAcknowledged,
      openOrderEditor: strategyActivityFloatingPanel.tradingExecutionActions.openOrderEditor,
      cancelPaperOrder: strategyActivityFloatingPanel.tradingExecutionActions.cancelPaperOrder,
      cancelExchangeOrder:
        strategyActivityFloatingPanel.tradingExecutionActions.cancelExchangeOrder,
      openAuditSection: strategyActivityFloatingPanel.navigationActions.openAuditSection,
      openAiSchedulerJob: strategyActivityFloatingPanel.navigationActions.openAiSchedulerJob,
      openReviewInspector: strategyActivityFloatingPanel.navigationActions.openReviewInspector,
      openChangeRequest: strategyActivityFloatingPanel.navigationActions.openChangeRequest,
      openBacktestDetail: strategyActivityFloatingPanel.navigationActions.openBacktestDetail,
      openSourceReview: strategyActivityFloatingPanel.navigationActions.openSourceReview,
      openStrategyProposal: strategyActivityFloatingPanel.navigationActions.openStrategyProposal,
      handleProposalAction: strategyActivityFloatingPanel.strategyWorkflowActions.handleProposalAction,
      retryAgentJob: strategyActivityFloatingPanel.strategyWorkflowActions.retryAgentJob,
      rerunBacktestFromChangeRequest:
        strategyActivityFloatingPanel.strategyWorkflowActions.rerunBacktestFromChangeRequest,
      rerunBacktestFromRecommendation:
        strategyActivityFloatingPanel.strategyWorkflowActions.rerunBacktestFromRecommendation,
      rerunBacktestFromReview:
        strategyActivityFloatingPanel.strategyWorkflowActions.rerunBacktestFromReview,
      openReplayReview: strategyActivityFloatingPanel.navigationActions.openReplayReview,
      openStrategyReplay: strategyActivityFloatingPanel.navigationActions.openStrategyReplay,
    },
  }
}
