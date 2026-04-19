import { buildAppOverlayPanelsControlSection } from './buildAppOverlayPanelsControlSection'
import { buildAppOverlayPanelsReviewStrategySection } from './buildAppOverlayPanelsReviewStrategySection'
import { buildAppOverlayPanelsTradingAccountSection } from './buildAppOverlayPanelsTradingAccountSection'
import type { ComponentProps } from 'react'

import AppOverlayPanelsContainer from './AppOverlayPanelsContainer'
import type { BuildAppOverlayPanelsAssemblerArgs } from './buildAppOverlayPanelsAssemblerTypes'

type AppOverlayPanelsProps = ComponentProps<typeof AppOverlayPanelsContainer>

export type { BuildAppOverlayPanelsAssemblerArgs } from './buildAppOverlayPanelsAssemblerTypes'

export function buildAppOverlayPanelsAssembler({
  panelState,
  panelSetters,
  navigationActions,
  workspaceStatusModel,
  workspaceControlActions,
  tradingExecutionActions,
  strategyWorkspaceActions,
  strategyWorkflowActions,
  reviewInspectorModel,
  dataState,
  pendingState,
}: BuildAppOverlayPanelsAssemblerArgs): AppOverlayPanelsProps {
  return {
    ...buildAppOverlayPanelsControlSection({
      panelState,
      panelSetters,
      navigationActions,
      workspaceStatusModel,
      workspaceControlActions,
      dataState,
      pendingState,
    }),
    ...buildAppOverlayPanelsTradingAccountSection({
      panelState,
      panelSetters,
      tradingExecutionActions,
      dataState,
      pendingState,
    }),
    ...buildAppOverlayPanelsReviewStrategySection({
      panelState,
      panelSetters,
      navigationActions,
      strategyWorkspaceActions,
      strategyWorkflowActions,
      reviewInspectorModel,
      dataState,
      pendingState,
    }),
  }
}
