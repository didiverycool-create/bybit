import type { useAppLifecycleEffects } from './useAppLifecycleEffects'
import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'

type BuildAppLifecycleEffectsArgs = Parameters<typeof useAppLifecycleEffects>[0]
type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>

export type BuildAppLifecycleEffectsArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  MarketWorkspaceModel

export function buildAppLifecycleEffectsArgs({
  workspaceBootstrap,
  visibleOverviewCards,
  cardOrder,
  setCardOrder,
  setVisibleOverviewCards,
  strategiesQuery,
  selectedStrategyId,
  setSelectedStrategyId,
  marketDetail,
  manualOrderSymbolRef,
  setManualOrder,
  activeStrategyId,
  strategyActivityQuery,
  strategyActivityQueryErrorMessage,
  editingOrderId,
  editingOrder,
  setEditingOrderId,
  setManualTradePanelOpen,
}: BuildAppLifecycleEffectsArgsInput): BuildAppLifecycleEffectsArgs {
  return {
    workspaceBootstrapOverviewCardOrder: workspaceBootstrap.overview_card_order,
    visibleOverviewCards,
    cardOrder,
    setCardOrder,
    setVisibleOverviewCards,
    strategies: strategiesQuery.data,
    selectedStrategyId,
    setSelectedStrategyId,
    marketDetail,
    manualOrderSymbolRef,
    setManualOrder,
    activeStrategyId,
    strategyActivityQueryErrored: strategyActivityQuery.isError,
    strategyActivityQueryErrorMessage,
    editingOrderId,
    editingOrder,
    setEditingOrderId,
    setManualTradePanelOpen,
  }
}
