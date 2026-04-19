import { useState } from 'react'

import type { WorkspaceBootstrap } from '../utils/workspace-helpers'

type UseWorkspacePanelStateArgs = {
  workspaceBootstrap: WorkspaceBootstrap
}

export function useWorkspacePanelState({
  workspaceBootstrap,
}: UseWorkspacePanelStateArgs) {
  const [statusInspectorOpen, setStatusInspectorOpen] = useState(false)
  const [accountInspectorOpen, setAccountInspectorOpen] = useState(false)
  const [watchlistManagerOpen, setWatchlistManagerOpen] = useState(false)
  const [schedulerControlsOpen, setSchedulerControlsOpen] = useState(false)
  const [grafanaPreviewOpen, setGrafanaPreviewOpen] = useState(false)
  const [manualTradePanelOpen, setManualTradePanelOpen] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [orderHistoryPanelOpen, setOrderHistoryPanelOpen] = useState(false)
  const [strategyEditorOpen, setStrategyEditorOpen] = useState(
    workspaceBootstrap.selected_strategy_detail_panel === 'editor',
  )
  const [strategyActivityPanelOpen, setStrategyActivityPanelOpen] = useState(
    workspaceBootstrap.selected_strategy_detail_panel === 'activity',
  )
  const [strategyTrackingPanelOpen, setStrategyTrackingPanelOpen] = useState(
    workspaceBootstrap.selected_strategy_detail_panel === 'tracking',
  )
  const [reviewInspectorOpen, setReviewInspectorOpen] = useState(
    Boolean(workspaceBootstrap.selected_review_inspector_id),
  )

  return {
    statusInspectorOpen,
    setStatusInspectorOpen,
    accountInspectorOpen,
    setAccountInspectorOpen,
    watchlistManagerOpen,
    setWatchlistManagerOpen,
    schedulerControlsOpen,
    setSchedulerControlsOpen,
    grafanaPreviewOpen,
    setGrafanaPreviewOpen,
    manualTradePanelOpen,
    setManualTradePanelOpen,
    editingOrderId,
    setEditingOrderId,
    orderHistoryPanelOpen,
    setOrderHistoryPanelOpen,
    strategyEditorOpen,
    setStrategyEditorOpen,
    strategyActivityPanelOpen,
    setStrategyActivityPanelOpen,
    strategyTrackingPanelOpen,
    setStrategyTrackingPanelOpen,
    reviewInspectorOpen,
    setReviewInspectorOpen,
  }
}
