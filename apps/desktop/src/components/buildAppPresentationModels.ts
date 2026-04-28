import type { AppWorkspaceShellProps } from './AppWorkspaceShell'
import { buildOverviewWorkspaceDerivedState } from './buildOverviewWorkspaceDerivedState'
import { buildAppPresentationModelsShellProps } from './buildAppPresentationModelsShellProps'
import { buildAppPresentationModelsSurfaceWorkspaceProps } from './buildAppPresentationModelsSurfaceWorkspaceProps'
import { useAppCompositionModel } from './useAppCompositionModel'
import { useAppInteractionModels } from './useAppInteractionModels'
import { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import { useControlDataQueryModel } from './useControlDataQueryModel'
import { useControlRefreshActions } from './useControlRefreshActions'
import { useDesktopUiActions } from './useDesktopUiActions'
import { useManualTradePreviewModel } from './useManualTradePreviewModel'
import { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import { useReplayWorkspaceModel } from './useReplayWorkspaceModel'
import { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'
import { useTradingExecutionActions } from './useTradingExecutionActions'
import { useWorkspaceOpsCollectionsModel } from './useWorkspaceOpsCollectionsModel'
import { useWorkspacePersistence } from './useWorkspacePersistence'

export type BuildAppPresentationModelsArgs =
  ReturnType<typeof useAppWorkspaceBootstrapState> &
  ReturnType<typeof useMarketWorkspaceModel> &
  ReturnType<typeof useControlDataQueryModel> &
  ReturnType<typeof useDesktopUiActions> &
  ReturnType<typeof useRuntimeAndSettingsModel> &
  ReturnType<typeof useStrategyWorkspaceCompositeModel> &
  ReturnType<typeof useControlRefreshActions> &
  ReturnType<typeof useWorkspacePersistence> &
  ReturnType<typeof useWorkspaceOpsCollectionsModel> &
  ReturnType<typeof buildOverviewWorkspaceDerivedState> &
  ReturnType<typeof useAppInteractionModels> &
  ReturnType<typeof useAppCompositionModel> &
  ReturnType<typeof useManualTradePreviewModel> &
  ReturnType<typeof useTradingExecutionActions> &
  ReturnType<typeof useReplayWorkspaceModel> & {
    tradingExecutionActions: ReturnType<typeof useTradingExecutionActions>
    runtimeWorkerStatus: ReturnType<typeof useControlDataQueryModel>['runtimeWorkerStatusQuery']['data']
    backtestRangePresets: readonly { value: string; label: string }[]
    backtestTimeframePresets: readonly { value: string; label: string }[]
    marketTimeframePresets: readonly { value: string; label: string }[]
  }

export function buildAppPresentationModels(
  args: BuildAppPresentationModelsArgs,
): AppWorkspaceShellProps {
  const surfaceWorkspaceProps = buildAppPresentationModelsSurfaceWorkspaceProps(args)

  return buildAppPresentationModelsShellProps({
    args,
    surfaceWorkspaceProps,
  })
}
