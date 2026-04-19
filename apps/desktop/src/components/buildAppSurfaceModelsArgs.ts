import type { BuildAppSurfaceModelsArgs } from './buildAppSurfaceModels'
import { buildAppSurfaceModelsAppOverlayPanelsArgs } from './buildAppSurfaceModelsAppOverlayPanelsArgs'
import { buildAppSurfaceModelsStrategyActivityFloatingPanelArgs } from './buildAppSurfaceModelsStrategyActivityFloatingPanelArgs'

export type BuildAppSurfaceModelsArgsInput = {
  strategyActivityFloatingPanel: {
    panelOpen: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['baseArgs']['panelOpen']
    selectedStrategy: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['baseArgs']['selectedStrategy']
    strategyActivitySnapshotModel:
      BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['baseArgs']['strategyActivitySnapshotModel']
    activityMeta: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['baseArgs']['activityMeta']
    activeStrategyId: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['baseArgs']['activeStrategyId']
    decisionModel: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['baseArgs']['decisionModel']
    progressModel: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['baseArgs']['progressModel']
    opsModel: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['baseArgs']['opsModel']
    queryState: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['derivedStateArgs']['queryState']
    serviceState: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['derivedStateArgs']['serviceState']
    workspaceState: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['derivedStateArgs']['workspaceState']
    focusLabels: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['derivedStateArgs']['focusLabels']
    navigationActions: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openAlertsSection'] extends never
      ? never
      : {
          openAlertsSection: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openAlertsSection']
          openMarketSymbol: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openMarketSymbol']
          openTradesSection: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openTradesSection']
          openAuditSection: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openAuditSection']
          openAiSchedulerJob: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openAiSchedulerJob']
          openReviewInspector: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openReviewInspector']
          openChangeRequest: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openChangeRequest']
          openBacktestDetail: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openBacktestDetail']
          openSourceReview: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openSourceReview']
          openStrategyProposal: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openStrategyProposal']
          openReplayReview: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openReplayReview']
          openStrategyReplay: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs']['openStrategyReplay']
        }
    strategyWorkspaceActions: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs'] extends infer ActionArgs
      ? ActionArgs extends {
          openStrategyTrackingPanel: infer OpenStrategyTrackingPanel
        }
        ? {
            openStrategyTrackingPanel: OpenStrategyTrackingPanel
          }
        : never
      : never
    workspaceControlActions: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs'] extends infer ActionArgs
      ? ActionArgs extends {
          toggleAlertAcknowledged: infer ToggleAlertAcknowledged
        }
        ? {
            toggleAlertAcknowledged: ToggleAlertAcknowledged
          }
        : never
      : never
    strategyWorkflowActions: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs'] extends infer ActionArgs
      ? ActionArgs extends {
          handleProposalAction: infer HandleProposalAction
          retryAgentJob: infer RetryAgentJob
          rerunBacktestFromChangeRequest: infer RerunBacktestFromChangeRequest
          rerunBacktestFromRecommendation: infer RerunBacktestFromRecommendation
          rerunBacktestFromReview: infer RerunBacktestFromReview
        }
        ? {
            handleProposalAction: HandleProposalAction
            retryAgentJob: RetryAgentJob
            rerunBacktestFromChangeRequest: RerunBacktestFromChangeRequest
            rerunBacktestFromRecommendation: RerunBacktestFromRecommendation
            rerunBacktestFromReview: RerunBacktestFromReview
          }
        : never
      : never
    tradingExecutionActions: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs'] extends infer ActionArgs
      ? ActionArgs extends {
          openOrderEditor: infer OpenOrderEditor
          cancelPaperOrder: infer CancelPaperOrder
          cancelExchangeOrder: infer CancelExchangeOrder
        }
        ? {
            openOrderEditor: OpenOrderEditor
            cancelPaperOrder: CancelPaperOrder
            cancelExchangeOrder: CancelExchangeOrder
          }
        : never
      : never
    setters: BuildAppSurfaceModelsArgs['strategyActivityFloatingPanel']['actionArgs'] extends infer ActionArgs
      ? ActionArgs extends {
          setStrategyActivityPanelOpen: infer SetStrategyActivityPanelOpen
          setWatchlistManagerOpen: infer SetWatchlistManagerOpen
        }
        ? {
            setStrategyActivityPanelOpen: SetStrategyActivityPanelOpen
            setWatchlistManagerOpen: SetWatchlistManagerOpen
          }
        : never
      : never
  }
  appOverlayPanels: {
    panelState: BuildAppSurfaceModelsArgs['appOverlayPanels']['baseArgs']['panelState']
    panelSetters: BuildAppSurfaceModelsArgs['appOverlayPanels']['baseArgs']['panelSetters']
    navigationActions: BuildAppSurfaceModelsArgs['appOverlayPanels']['baseArgs']['navigationActions']
    workspaceStatusModel: BuildAppSurfaceModelsArgs['appOverlayPanels']['baseArgs']['workspaceStatusModel']
    workspaceControlActions: BuildAppSurfaceModelsArgs['appOverlayPanels']['baseArgs']['workspaceControlActions']
    tradingExecutionActions: BuildAppSurfaceModelsArgs['appOverlayPanels']['baseArgs']['tradingExecutionActions']
    strategyWorkspaceActions: BuildAppSurfaceModelsArgs['appOverlayPanels']['baseArgs']['strategyWorkspaceActions']
    strategyWorkflowActions: BuildAppSurfaceModelsArgs['appOverlayPanels']['baseArgs']['strategyWorkflowActions']
    reviewInspectorModel: BuildAppSurfaceModelsArgs['appOverlayPanels']['baseArgs']['reviewInspectorModel']
    dataState: BuildAppSurfaceModelsArgs['appOverlayPanels']['derivedStateArgs']['dataState'] extends infer DataState
      ? DataState extends { watchlistControlsDisabled: unknown }
        ? Omit<DataState, 'watchlistControlsDisabled'>
        : DataState
      : never
    pendingState: BuildAppSurfaceModelsArgs['appOverlayPanels']['derivedStateArgs']['pendingState']
  }
}

export function buildAppSurfaceModelsArgs({
  strategyActivityFloatingPanel,
  appOverlayPanels,
}: BuildAppSurfaceModelsArgsInput): BuildAppSurfaceModelsArgs {
  return {
    strategyActivityFloatingPanel: buildAppSurfaceModelsStrategyActivityFloatingPanelArgs(
      strategyActivityFloatingPanel,
    ),
    appOverlayPanels: buildAppSurfaceModelsAppOverlayPanelsArgs(appOverlayPanels),
  }
}
