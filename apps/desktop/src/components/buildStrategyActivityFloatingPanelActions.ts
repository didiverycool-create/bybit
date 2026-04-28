import type { BuildStrategyActivityFloatingPanelPropsArgs } from './buildStrategyActivityFloatingPanelProps'

type StrategyActivityFloatingPanelActions = BuildStrategyActivityFloatingPanelPropsArgs['actions']

export type BuildStrategyActivityFloatingPanelActionsArgs = {
  openStrategyTrackingPanel: (kind: 'issue' | 'change') => void
  setStrategyActivityPanelOpen: (open: boolean) => void
  openAlertsSection: StrategyActivityFloatingPanelActions['onOpenAlertsSection']
  openMarketSymbol: StrategyActivityFloatingPanelActions['onOpenMarketSymbol']
  openTradesSection: StrategyActivityFloatingPanelActions['onOpenTradesSection']
  setWatchlistManagerOpen: (open: boolean) => void
  toggleAlertAcknowledged: (
    ...args: Parameters<StrategyActivityFloatingPanelActions['onToggleAlertAcknowledged']>
  ) => unknown
  openOrderEditor: StrategyActivityFloatingPanelActions['onOpenOrderEditor']
  cancelPaperOrder: (
    ...args: Parameters<StrategyActivityFloatingPanelActions['onCancelPaperOrder']>
  ) => unknown
  cancelExchangeOrder: (
    ...args: Parameters<StrategyActivityFloatingPanelActions['onCancelExchangeOrder']>
  ) => unknown
  openAuditSection: StrategyActivityFloatingPanelActions['onOpenAuditSection']
  openAiSchedulerJob: StrategyActivityFloatingPanelActions['onOpenAiSchedulerJob']
  openReviewInspector: StrategyActivityFloatingPanelActions['onOpenReviewInspector']
  openChangeRequest: StrategyActivityFloatingPanelActions['onOpenChangeRequest']
  openBacktestDetail: StrategyActivityFloatingPanelActions['onOpenBacktestDetail']
  openSourceReview: StrategyActivityFloatingPanelActions['onOpenSourceReview']
  openStrategyProposal: StrategyActivityFloatingPanelActions['onOpenStrategyProposal']
  handleProposalAction: (
    ...args: Parameters<StrategyActivityFloatingPanelActions['onHandleProposalAction']>
  ) => unknown
  retryAgentJob: (
    ...args: Parameters<StrategyActivityFloatingPanelActions['onRetryAgentJob']>
  ) => unknown
  rerunBacktestFromChangeRequest: (
    ...args: Parameters<StrategyActivityFloatingPanelActions['onRerunBacktestFromChangeRequest']>
  ) => unknown
  rerunBacktestFromRecommendation: (
    ...args: Parameters<StrategyActivityFloatingPanelActions['onRerunBacktestFromRecommendation']>
  ) => unknown
  rerunBacktestFromReview: (
    ...args: Parameters<StrategyActivityFloatingPanelActions['onRerunBacktestFromReview']>
  ) => unknown
  openReplayReview: StrategyActivityFloatingPanelActions['onOpenReplayReview']
  openStrategyReplay: StrategyActivityFloatingPanelActions['onOpenStrategyReplay']
}

export function buildStrategyActivityFloatingPanelActions({
  openStrategyTrackingPanel,
  setStrategyActivityPanelOpen,
  openAlertsSection,
  openMarketSymbol,
  openTradesSection,
  setWatchlistManagerOpen,
  toggleAlertAcknowledged,
  openOrderEditor,
  cancelPaperOrder,
  cancelExchangeOrder,
  openAuditSection,
  openAiSchedulerJob,
  openReviewInspector,
  openChangeRequest,
  openBacktestDetail,
  openSourceReview,
  openStrategyProposal,
  handleProposalAction,
  retryAgentJob,
  rerunBacktestFromChangeRequest,
  rerunBacktestFromRecommendation,
  rerunBacktestFromReview,
  openReplayReview,
  openStrategyReplay,
}: BuildStrategyActivityFloatingPanelActionsArgs): StrategyActivityFloatingPanelActions {
  return {
    onTrack: () => openStrategyTrackingPanel('issue'),
    onClose: () => setStrategyActivityPanelOpen(false),
    onOpenAlertsSection: openAlertsSection,
    onOpenMarketSymbol: openMarketSymbol,
    onOpenTradesSection: openTradesSection,
    onOpenWatchlistManager: () => setWatchlistManagerOpen(true),
    onToggleAlertAcknowledged: (alertId, nextAcknowledged) => {
      void toggleAlertAcknowledged(alertId, nextAcknowledged)
    },
    onOpenOrderEditor: openOrderEditor,
    onCancelPaperOrder: (orderId) => {
      void cancelPaperOrder(orderId)
    },
    onCancelExchangeOrder: (orderId) => {
      void cancelExchangeOrder(orderId)
    },
    onOpenAuditSection: openAuditSection,
    onOpenAiSchedulerJob: openAiSchedulerJob,
    onOpenReviewInspector: openReviewInspector,
    onOpenChangeRequest: openChangeRequest,
    onOpenBacktestDetail: openBacktestDetail,
    onOpenSourceReview: openSourceReview,
    onOpenStrategyProposal: openStrategyProposal,
    onHandleProposalAction: (proposalId, action) => {
      void handleProposalAction(proposalId, action)
    },
    onRetryAgentJob: (jobId, options) => {
      void retryAgentJob(jobId, options)
    },
    onRerunBacktestFromChangeRequest: (request) => {
      void rerunBacktestFromChangeRequest(request)
    },
    onRerunBacktestFromRecommendation: (backtest) => {
      void rerunBacktestFromRecommendation(backtest)
    },
    onRerunBacktestFromReview: (review) => {
      void rerunBacktestFromReview(review)
    },
    onOpenReplayReview: openReplayReview,
    onOpenStrategyReplay: openStrategyReplay,
  }
}
