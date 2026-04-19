import type { ComponentProps } from 'react'

import AccountInspectorPanel from './AccountInspectorPanel'
import GrafanaPreviewPanel from './GrafanaPreviewPanel'
import ManualTradePanel from './ManualTradePanel'
import OrderHistoryPanel from './OrderHistoryPanel'
import ReviewInspectorPanel from './ReviewInspectorPanel'
import SchedulerControlsPanel from './SchedulerControlsPanel'
import StatusInspectorPanel from './StatusInspectorPanel'
import StrategyEditorPanel from './StrategyEditorPanel'
import StrategyTrackingPanel from './StrategyTrackingPanel'
import WatchlistManagerPanel from './WatchlistManagerPanel'

export type AppOverlayPanelsHostProps = {
  statusInspectorPanelProps: ComponentProps<typeof StatusInspectorPanel>
  watchlistManagerPanelProps: ComponentProps<typeof WatchlistManagerPanel>
  schedulerControlsPanelProps: ComponentProps<typeof SchedulerControlsPanel>
  grafanaPreviewPanelProps: ComponentProps<typeof GrafanaPreviewPanel>
  manualTradePanelProps: ComponentProps<typeof ManualTradePanel>
  orderHistoryPanelProps: ComponentProps<typeof OrderHistoryPanel>
  accountInspectorPanelProps: ComponentProps<typeof AccountInspectorPanel>
  strategyEditorPanelProps: ComponentProps<typeof StrategyEditorPanel>
  strategyTrackingPanelProps: ComponentProps<typeof StrategyTrackingPanel>
  reviewInspectorPanelProps: ComponentProps<typeof ReviewInspectorPanel>
}

export default function AppOverlayPanelsHost({
  statusInspectorPanelProps,
  watchlistManagerPanelProps,
  schedulerControlsPanelProps,
  grafanaPreviewPanelProps,
  manualTradePanelProps,
  orderHistoryPanelProps,
  accountInspectorPanelProps,
  strategyEditorPanelProps,
  strategyTrackingPanelProps,
  reviewInspectorPanelProps,
}: AppOverlayPanelsHostProps) {
  return (
    <>
      <StatusInspectorPanel {...statusInspectorPanelProps} />
      <WatchlistManagerPanel {...watchlistManagerPanelProps} />
      <SchedulerControlsPanel {...schedulerControlsPanelProps} />
      <GrafanaPreviewPanel {...grafanaPreviewPanelProps} />
      <ManualTradePanel {...manualTradePanelProps} />
      <OrderHistoryPanel {...orderHistoryPanelProps} />
      <AccountInspectorPanel {...accountInspectorPanelProps} />
      <StrategyEditorPanel {...strategyEditorPanelProps} />
      <StrategyTrackingPanel {...strategyTrackingPanelProps} />
      <ReviewInspectorPanel {...reviewInspectorPanelProps} />
    </>
  )
}
