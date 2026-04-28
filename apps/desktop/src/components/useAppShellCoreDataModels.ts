import { useCallback } from 'react'

import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import { useControlDataQueryModel } from './useControlDataQueryModel'
import { useDesktopUiActions } from './useDesktopUiActions'
import { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { MarketTimeframe } from '../utils/workspace-helpers'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>

export type UseAppShellCoreDataModelsArgs = {
  workspaceBootstrapState: AppWorkspaceBootstrapState
  marketTimeframePresets: readonly { value: MarketTimeframe; label: string }[]
}

export function useAppShellCoreDataModels({
  workspaceBootstrapState,
  marketTimeframePresets,
}: UseAppShellCoreDataModelsArgs) {
  const {
    activeSection,
    selectedSymbol,
    setSelectedSymbol,
    selectedMarketTimeframe,
    setSelectedMarketTimeframe,
    selectedStrategyId,
    selectedBacktestId,
    backtestFilter,
    replayTrackingScope,
    strategyActivityPanelOpen,
    grafanaPreviewOpen,
    editingOrderId,
    selectedMode,
    setActionFeedback,
    desktopNotificationPermissionRequestedRef,
    recentDesktopNotificationRef,
    setManualOrder,
  } = workspaceBootstrapState

  const seedSelectedManualOrderPrice = useCallback(
    (latestPrice: number) => {
      setManualOrder((current) => ({ ...current, price: latestPrice.toFixed(2) }))
    },
    [setManualOrder],
  )

  const marketWorkspaceModel = useMarketWorkspaceModel({
    activeSection,
    selectedSymbol,
    setSelectedSymbol,
    selectedMarketTimeframe,
    setSelectedMarketTimeframe,
    marketTimeframeOptions: marketTimeframePresets,
    onSelectedPrice: seedSelectedManualOrderPrice,
  })
  const controlDataQueryModel = useControlDataQueryModel({
    activeSection,
    selectedMode,
    selectedStrategyId,
    selectedBacktestId,
    backtestFilter,
    replayTrackingScope,
    strategyActivityPanelOpen,
    grafanaPreviewOpen,
    editingOrderId,
  })
  const desktopUiActions = useDesktopUiActions({
    setActionFeedback,
    settings: controlDataQueryModel.settings,
    desktopNotificationPermissionRequestedRef,
    recentDesktopNotificationRef,
  })

  return {
    marketWorkspaceModel,
    controlDataQueryModel,
    desktopUiActions,
  }
}
