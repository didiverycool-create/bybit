import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { useAppShellCompositionModels } from './useAppShellCompositionModels'
import type { useAppShellCoreModels } from './useAppShellCoreModels'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { MarketTimeframe } from '../utils/workspace-helpers'
import { buildAppPresentationModelsSourceGroups } from './buildAppPresentationModelsSourceGroups'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ShellCoreModels = ReturnType<typeof useAppShellCoreModels>
type ShellCompositionModels = ReturnType<typeof useAppShellCompositionModels>
type PresetOption = { value: string; label: string }
type MarketPresetOption = { value: MarketTimeframe; label: string }

export type BuildAppPresentationModelsArgsInput = {
  workspaceBootstrapState: AppWorkspaceBootstrapState
  shellCoreModels: ShellCoreModels
  shellCompositionModels: ShellCompositionModels
  backtestRangePresets: readonly PresetOption[]
  backtestTimeframePresets: readonly PresetOption[]
  marketTimeframePresets: readonly MarketPresetOption[]
}

export function buildAppPresentationModelsArgs({
  workspaceBootstrapState,
  shellCoreModels,
  shellCompositionModels,
  backtestRangePresets,
  backtestTimeframePresets,
  marketTimeframePresets,
}: BuildAppPresentationModelsArgsInput): BuildAppPresentationModelsArgs {
  const { workspacePresentationSource, compositionPresentationSource } =
    buildAppPresentationModelsSourceGroups({
      workspaceBootstrapState,
      shellCoreModels,
      shellCompositionModels,
    })
  const {
    manualTradePreviewModel,
    runtimeAndSettingsModel,
    tradingExecutionActions,
  } = shellCoreModels

  return {
    ...workspacePresentationSource,
    ...compositionPresentationSource,
    ...manualTradePreviewModel,
    ...tradingExecutionActions,
    tradingExecutionActions,
    runtimeWorkerStatus: runtimeAndSettingsModel.runtimeWorkerStatus,
    backtestRangePresets,
    backtestTimeframePresets,
    marketTimeframePresets,
  }
}
