import type { QueryClient } from '@tanstack/react-query'

import {
  buildAppShellCompositionModelsSource,
  buildAppShellCoreModelsSource,
} from './buildAppShellModelSourceGroups'
import { buildAppPresentationModels } from './buildAppPresentationModels'
import { buildAppPresentationModelsArgs } from './buildAppPresentationModelsArgs'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import { useAppShellCompositionModels } from './useAppShellCompositionModels'
import { useAppShellCoreModels } from './useAppShellCoreModels'
import type { MarketTimeframe } from '../utils/workspace-helpers'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type PresetOption = { value: string; label: string }
type MarketPresetOption = { value: MarketTimeframe; label: string }

export type UseAppShellModelArgs = {
  queryClient: QueryClient
  workspaceBootstrapState: AppWorkspaceBootstrapState
  backtestRangePresets: readonly PresetOption[]
  backtestTimeframePresets: readonly PresetOption[]
  marketTimeframePresets: readonly MarketPresetOption[]
}

export function useAppShellModel({
  queryClient,
  workspaceBootstrapState,
  backtestRangePresets,
  backtestTimeframePresets,
  marketTimeframePresets,
}: UseAppShellModelArgs) {
  const shellCoreModels = useAppShellCoreModels(
    buildAppShellCoreModelsSource({
      workspaceBootstrapState,
      marketTimeframePresets,
    }),
  )
  const shellCompositionModels = useAppShellCompositionModels(
    buildAppShellCompositionModelsSource({
      queryClient,
      workspaceBootstrapState,
      shellCoreModels,
    }),
  )

  return buildAppPresentationModels(
    buildAppPresentationModelsArgs({
      workspaceBootstrapState,
      shellCoreModels,
      shellCompositionModels,
      backtestRangePresets,
      backtestTimeframePresets,
      marketTimeframePresets,
    }),
  )
}
