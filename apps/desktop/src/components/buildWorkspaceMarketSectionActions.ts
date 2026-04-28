import type { BuildWorkspaceSectionActionsResult } from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionOpsConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

type BuildWorkspaceMarketSectionActionsArgs = Pick<
  BuildWorkspaceSectionOpsConsumerArgs,
  'marketSelectionActions' | 'setters'
>

export type BuildWorkspaceMarketSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'marketWorkspaceActions'
>

export function buildWorkspaceMarketSectionActions({
  marketSelectionActions,
  setters,
}: BuildWorkspaceMarketSectionActionsArgs): BuildWorkspaceMarketSectionActionsResult {
  return {
    marketWorkspaceActions: {
      onSelectMarketSymbol: marketSelectionActions.onSelectMarketSymbol,
      onSelectMarketTimeframe: marketSelectionActions.onSelectMarketTimeframe,
      onOpenWatchlistManager: () => setters.setWatchlistManagerOpen(true),
      onOpenManualTrade: () => {
        setters.setEditingOrderId(null)
        setters.setManualTradePanelOpen(true)
      },
    },
  }
}
