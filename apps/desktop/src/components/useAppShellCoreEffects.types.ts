import type { QueryClient } from '@tanstack/react-query'

import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useDesktopUiActions } from './useDesktopUiActions'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>

export type UseAppShellCoreEffectsArgs = {
  queryClient: QueryClient
  workspaceBootstrapState: AppWorkspaceBootstrapState
  controlDataQueryModel: ControlDataQueryModel
  desktopUiActions: DesktopUiActions
  marketWorkspaceModel: MarketWorkspaceModel
}

export type UseAppShellCoreDerivedModelsArgs = Pick<
  UseAppShellCoreEffectsArgs,
  'workspaceBootstrapState' | 'controlDataQueryModel' | 'marketWorkspaceModel'
>
