import type { ComponentProps } from 'react'

import OverviewWorkspaceSection from './OverviewWorkspaceSection'

type OverviewWorkspaceSectionProps = ComponentProps<typeof OverviewWorkspaceSection>

type OverviewWorkspaceContainerProps = {
  layoutState: {
    layoutPreset: OverviewWorkspaceSectionProps['layoutPreset']
    selectedSymbol: OverviewWorkspaceSectionProps['selectedSymbol']
    selectedStrategy: OverviewWorkspaceSectionProps['selectedStrategy']
    showStrategyWatch: OverviewWorkspaceSectionProps['showStrategyWatch']
    overviewWatchlistItems: OverviewWorkspaceSectionProps['overviewWatchlistItems']
    selectedMarketTimeframe: OverviewWorkspaceSectionProps['selectedMarketTimeframe']
    marketTimeframeOptions: OverviewWorkspaceSectionProps['marketTimeframeOptions']
  }
  marketState: {
    marketRenderableDetail: OverviewWorkspaceSectionProps['marketRenderableDetail']
    marketDiagnostics: OverviewWorkspaceSectionProps['marketDiagnostics']
    marketDetailLoading: OverviewWorkspaceSectionProps['marketDetailLoading']
    marketDetailErrorMessage: OverviewWorkspaceSectionProps['marketDetailErrorMessage']
    snapshotExecutionHealth: OverviewWorkspaceSectionProps['snapshotExecutionHealth']
    marketDiagnosticsTitle: OverviewWorkspaceSectionProps['marketDiagnosticsTitle']
    marketDiagnosticsSummary: OverviewWorkspaceSectionProps['marketDiagnosticsSummary']
  }
  activityState: {
    schedulerJobs: OverviewWorkspaceSectionProps['schedulerJobs']
    overviewAiEvents: OverviewWorkspaceSectionProps['overviewAiEvents']
    overviewQueuedRequests: OverviewWorkspaceSectionProps['overviewQueuedRequests']
  }
  actions: Pick<
    OverviewWorkspaceSectionProps,
    | 'onSelectMarketSymbol'
    | 'onSelectMarketTimeframe'
    | 'onOpenReviewInspector'
    | 'onOpenBacktestDetail'
    | 'onOpenSourceReview'
    | 'onOpenStrategyProposal'
    | 'onOpenStrategyActivity'
    | 'onOpenAiSchedulerJob'
  >
}

export default function OverviewWorkspaceContainer({
  layoutState,
  marketState,
  activityState,
  actions,
}: OverviewWorkspaceContainerProps) {
  return (
    <OverviewWorkspaceSection
      layoutPreset={layoutState.layoutPreset}
      selectedSymbol={layoutState.selectedSymbol}
      selectedStrategy={layoutState.selectedStrategy}
      showStrategyWatch={layoutState.showStrategyWatch}
      overviewWatchlistItems={layoutState.overviewWatchlistItems}
      selectedMarketTimeframe={layoutState.selectedMarketTimeframe}
      marketTimeframeOptions={layoutState.marketTimeframeOptions}
      onSelectMarketSymbol={actions.onSelectMarketSymbol}
      onSelectMarketTimeframe={actions.onSelectMarketTimeframe}
      marketRenderableDetail={marketState.marketRenderableDetail}
      marketDiagnostics={marketState.marketDiagnostics}
      marketDetailLoading={marketState.marketDetailLoading}
      marketDetailErrorMessage={marketState.marketDetailErrorMessage}
      snapshotExecutionHealth={marketState.snapshotExecutionHealth}
      marketDiagnosticsTitle={marketState.marketDiagnosticsTitle}
      marketDiagnosticsSummary={marketState.marketDiagnosticsSummary}
      schedulerJobs={activityState.schedulerJobs}
      overviewAiEvents={activityState.overviewAiEvents}
      overviewQueuedRequests={activityState.overviewQueuedRequests}
      onOpenReviewInspector={actions.onOpenReviewInspector}
      onOpenBacktestDetail={actions.onOpenBacktestDetail}
      onOpenSourceReview={actions.onOpenSourceReview}
      onOpenStrategyProposal={actions.onOpenStrategyProposal}
      onOpenStrategyActivity={actions.onOpenStrategyActivity}
      onOpenAiSchedulerJob={actions.onOpenAiSchedulerJob}
    />
  )
}
