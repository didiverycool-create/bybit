import { Suspense, lazy, type ComponentProps } from 'react'

import type AccountInspectorPanelComponent from './AccountInspectorPanel'
import type GrafanaPreviewPanelComponent from './GrafanaPreviewPanel'
import type ManualTradePanelComponent from './ManualTradePanel'
import type OrderHistoryPanelComponent from './OrderHistoryPanel'
import type ReviewInspectorPanelComponent from './ReviewInspectorPanel'
import type SchedulerControlsPanelComponent from './SchedulerControlsPanel'
import type StatusInspectorPanelComponent from './StatusInspectorPanel'
import type StrategyEditorPanelComponent from './StrategyEditorPanel'
import type StrategyTrackingPanelComponent from './StrategyTrackingPanel'
import type WatchlistManagerPanelComponent from './WatchlistManagerPanel'

const AccountInspectorPanel = lazy(() => import('./AccountInspectorPanel'))
const GrafanaPreviewPanel = lazy(() => import('./GrafanaPreviewPanel'))
const ManualTradePanel = lazy(() => import('./ManualTradePanel'))
const OrderHistoryPanel = lazy(() => import('./OrderHistoryPanel'))
const ReviewInspectorPanel = lazy(() => import('./ReviewInspectorPanel'))
const SchedulerControlsPanel = lazy(() => import('./SchedulerControlsPanel'))
const StatusInspectorPanel = lazy(() => import('./StatusInspectorPanel'))
const StrategyEditorPanel = lazy(() => import('./StrategyEditorPanel'))
const StrategyTrackingPanel = lazy(() => import('./StrategyTrackingPanel'))
const WatchlistManagerPanel = lazy(() => import('./WatchlistManagerPanel'))

export type AppOverlayPanelsHostProps = {
  statusInspectorPanelProps: ComponentProps<typeof StatusInspectorPanelComponent>
  watchlistManagerPanelProps: ComponentProps<typeof WatchlistManagerPanelComponent>
  schedulerControlsPanelProps: ComponentProps<typeof SchedulerControlsPanelComponent>
  grafanaPreviewPanelProps: ComponentProps<typeof GrafanaPreviewPanelComponent>
  manualTradePanelProps: ComponentProps<typeof ManualTradePanelComponent>
  orderHistoryPanelProps: ComponentProps<typeof OrderHistoryPanelComponent>
  accountInspectorPanelProps: ComponentProps<typeof AccountInspectorPanelComponent>
  strategyEditorPanelProps: ComponentProps<typeof StrategyEditorPanelComponent>
  strategyTrackingPanelProps: ComponentProps<typeof StrategyTrackingPanelComponent>
  reviewInspectorPanelProps: ComponentProps<typeof ReviewInspectorPanelComponent>
}

const overlayFallback = <div className="empty-state empty-state--inline">面板加载中...</div>

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
      {statusInspectorPanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <StatusInspectorPanel {...statusInspectorPanelProps} />
        </Suspense>
      )}
      {watchlistManagerPanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <WatchlistManagerPanel {...watchlistManagerPanelProps} />
        </Suspense>
      )}
      {schedulerControlsPanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <SchedulerControlsPanel {...schedulerControlsPanelProps} />
        </Suspense>
      )}
      {grafanaPreviewPanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <GrafanaPreviewPanel {...grafanaPreviewPanelProps} />
        </Suspense>
      )}
      {manualTradePanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <ManualTradePanel {...manualTradePanelProps} />
        </Suspense>
      )}
      {orderHistoryPanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <OrderHistoryPanel {...orderHistoryPanelProps} />
        </Suspense>
      )}
      {accountInspectorPanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <AccountInspectorPanel {...accountInspectorPanelProps} />
        </Suspense>
      )}
      {strategyEditorPanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <StrategyEditorPanel {...strategyEditorPanelProps} />
        </Suspense>
      )}
      {strategyTrackingPanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <StrategyTrackingPanel {...strategyTrackingPanelProps} />
        </Suspense>
      )}
      {reviewInspectorPanelProps.open && (
        <Suspense fallback={overlayFallback}>
          <ReviewInspectorPanel {...reviewInspectorPanelProps} />
        </Suspense>
      )}
    </>
  )
}
