import { useState } from 'react'

import type { LayoutPreset, Mode, SectionKey } from '../types'
import {
  buildWorkspaceSignature,
  normalizeCardIds,
  normalizeCollapsedCardIds,
  normalizeVisibleCardIds,
  type MarketTimeframe,
  type WorkspaceBootstrap,
} from '../utils/workspace-helpers'

type ActionFeedbackState = {
  tone: 'success' | 'warning' | 'error'
  title: string
  detail: string
}

type UseWorkspaceLayoutStateArgs = {
  workspaceBootstrap: WorkspaceBootstrap
}

export function useWorkspaceLayoutState({
  workspaceBootstrap,
}: UseWorkspaceLayoutStateArgs) {
  const [activeSection, setActiveSection] = useState<SectionKey>(workspaceBootstrap.active_section)
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>(workspaceBootstrap.layout_preset)
  const [selectedMode, setSelectedMode] = useState<Mode>(workspaceBootstrap.selected_mode)
  const [selectedSymbol, setSelectedSymbol] = useState(workspaceBootstrap.selected_symbol)
  const [selectedMarketTimeframe, setSelectedMarketTimeframe] = useState<MarketTimeframe>(
    workspaceBootstrap.selected_market_timeframe,
  )
  const [selectedStrategyId, setSelectedStrategyId] = useState(workspaceBootstrap.selected_strategy_id)
  const [cardOrder, setCardOrder] = useState(() => normalizeCardIds(workspaceBootstrap.overview_card_order))
  const [visibleOverviewCards, setVisibleOverviewCards] = useState(() =>
    normalizeVisibleCardIds(
      workspaceBootstrap.overview_visible_cards,
      workspaceBootstrap.overview_card_order,
    ),
  )
  const [collapsedOverviewCards, setCollapsedOverviewCards] = useState(() =>
    normalizeCollapsedCardIds(
      workspaceBootstrap.overview_collapsed_cards,
      workspaceBootstrap.overview_card_order,
    ),
  )
  const [workspaceSavedAt, setWorkspaceSavedAt] = useState<string | null>(workspaceBootstrap.updated_at)
  const [lastSyncedWorkspaceSignature, setLastSyncedWorkspaceSignature] = useState(() =>
    buildWorkspaceSignature(workspaceBootstrap),
  )
  const [workspaceConflict, setWorkspaceConflict] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<ActionFeedbackState | null>(null)

  return {
    activeSection,
    setActiveSection,
    layoutPreset,
    setLayoutPreset,
    selectedMode,
    setSelectedMode,
    selectedSymbol,
    setSelectedSymbol,
    selectedMarketTimeframe,
    setSelectedMarketTimeframe,
    selectedStrategyId,
    setSelectedStrategyId,
    cardOrder,
    setCardOrder,
    visibleOverviewCards,
    setVisibleOverviewCards,
    collapsedOverviewCards,
    setCollapsedOverviewCards,
    workspaceSavedAt,
    setWorkspaceSavedAt,
    lastSyncedWorkspaceSignature,
    setLastSyncedWorkspaceSignature,
    workspaceConflict,
    setWorkspaceConflict,
    actionFeedback,
    setActionFeedback,
  }
}
