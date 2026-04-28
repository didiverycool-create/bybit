import type { QueryClient } from '@tanstack/react-query'

import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { MarketTimeframe } from '../utils/workspace-helpers'

export type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>

export type MarketTimeframePreset = {
  value: MarketTimeframe
  label: string
}

export type UseAppShellCoreModelsArgs = {
  queryClient: QueryClient
  workspaceBootstrapState: AppWorkspaceBootstrapState
  marketTimeframePresets: readonly MarketTimeframePreset[]
}
