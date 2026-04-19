import type { QueryClient } from '@tanstack/react-query'

import { buildManualTradePreviewModelArgs } from './buildManualTradePreviewModelArgs'
import { buildTradingExecutionActionsArgs } from './buildTradingExecutionActionsArgs'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import { useControlRefreshActions } from './useControlRefreshActions'
import type { useDesktopUiActions } from './useDesktopUiActions'
import { useManualTradePreviewModel } from './useManualTradePreviewModel'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import { useTradingExecutionActions } from './useTradingExecutionActions'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>

export type UseAppShellCoreActionModelsArgs = {
  queryClient: QueryClient
  workspaceBootstrapState: AppWorkspaceBootstrapState
  controlDataQueryModel: ControlDataQueryModel
  desktopUiActions: DesktopUiActions
  marketWorkspaceModel: MarketWorkspaceModel
  runtimeAndSettingsModel: RuntimeAndSettingsModel
}

export function useAppShellCoreActionModels({
  queryClient,
  workspaceBootstrapState,
  controlDataQueryModel,
  desktopUiActions,
  marketWorkspaceModel,
  runtimeAndSettingsModel,
}: UseAppShellCoreActionModelsArgs) {
  const {
    setWorkspaceSavedAt,
    setLastSyncedWorkspaceSignature,
  } = workspaceBootstrapState

  const coreActionSource = {
    ...workspaceBootstrapState,
    ...controlDataQueryModel,
  }
  const manualTradePreviewSource = {
    ...coreActionSource,
    ...marketWorkspaceModel,
    ...runtimeAndSettingsModel,
  }
  const manualTradePreviewModel = useManualTradePreviewModel(
    buildManualTradePreviewModelArgs(manualTradePreviewSource),
  )
  const controlRefreshActions = useControlRefreshActions({
    queryClient,
    setWorkspaceSavedAt,
    setLastSyncedWorkspaceSignature,
  })
  const tradingExecutionSource = {
    ...workspaceBootstrapState,
    ...controlRefreshActions,
    ...desktopUiActions,
    ...manualTradePreviewModel,
    ...marketWorkspaceModel,
  }
  const tradingExecutionActions = useTradingExecutionActions(
    buildTradingExecutionActionsArgs(tradingExecutionSource),
  )

  return {
    manualTradePreviewModel,
    controlRefreshActions,
    tradingExecutionActions,
  }
}
