import {
  buildAppOverlayPanelsDerivedState,
  type BuildAppOverlayPanelsDerivedStateArgs,
} from './buildAppOverlayPanelsDerivedState'
import {
  buildAppOverlayPanelsProps,
  type BuildAppOverlayPanelsPropsArgs,
} from './buildAppOverlayPanelsProps'
import {
  buildStrategyActivityFloatingPanelActions,
  type BuildStrategyActivityFloatingPanelActionsArgs,
} from './buildStrategyActivityFloatingPanelActions'
import {
  buildStrategyActivityFloatingPanelDerivedState,
  type BuildStrategyActivityFloatingPanelDerivedStateArgs,
} from './buildStrategyActivityFloatingPanelDerivedState'
import {
  buildStrategyActivityFloatingPanelProps,
  type BuildStrategyActivityFloatingPanelPropsArgs,
} from './buildStrategyActivityFloatingPanelProps'

type StrategyActivityFloatingPanelBaseArgs = Pick<
  BuildStrategyActivityFloatingPanelPropsArgs,
  | 'panelOpen'
  | 'selectedStrategy'
  | 'strategyActivitySnapshotModel'
  | 'activityMeta'
  | 'activeStrategyId'
  | 'decisionModel'
  | 'progressModel'
  | 'opsModel'
>

type AppOverlayPanelsBaseArgs = Pick<
  BuildAppOverlayPanelsPropsArgs,
  | 'panelState'
  | 'panelSetters'
  | 'navigationActions'
  | 'workspaceStatusModel'
  | 'workspaceControlActions'
  | 'tradingExecutionActions'
  | 'strategyWorkspaceActions'
  | 'strategyWorkflowActions'
  | 'reviewInspectorModel'
>

export type BuildAppSurfaceModelsArgs = {
  strategyActivityFloatingPanel: {
    baseArgs: StrategyActivityFloatingPanelBaseArgs
    derivedStateArgs: BuildStrategyActivityFloatingPanelDerivedStateArgs
    actionArgs: BuildStrategyActivityFloatingPanelActionsArgs
  }
  appOverlayPanels: {
    baseArgs: AppOverlayPanelsBaseArgs
    derivedStateArgs: BuildAppOverlayPanelsDerivedStateArgs
  }
}

export type BuildAppSurfaceModelsResult = {
  strategyActivityFloatingPanelProps: ReturnType<typeof buildStrategyActivityFloatingPanelProps>
  appOverlayPanelsProps: ReturnType<typeof buildAppOverlayPanelsProps>
}

export function buildAppSurfaceModels({
  strategyActivityFloatingPanel,
  appOverlayPanels,
}: BuildAppSurfaceModelsArgs): BuildAppSurfaceModelsResult {
  const strategyActivityFloatingPanelDerivedState =
    buildStrategyActivityFloatingPanelDerivedState(
      strategyActivityFloatingPanel.derivedStateArgs,
    )
  const strategyActivityFloatingPanelActions = buildStrategyActivityFloatingPanelActions(
    strategyActivityFloatingPanel.actionArgs,
  )
  const strategyActivityFloatingPanelProps = buildStrategyActivityFloatingPanelProps({
    ...strategyActivityFloatingPanel.baseArgs,
    ...strategyActivityFloatingPanelDerivedState,
    actions: strategyActivityFloatingPanelActions,
  })

  const appOverlayPanelsDerivedState = buildAppOverlayPanelsDerivedState(
    appOverlayPanels.derivedStateArgs,
  )
  const appOverlayPanelsProps = buildAppOverlayPanelsProps({
    ...appOverlayPanels.baseArgs,
    ...appOverlayPanelsDerivedState,
  })

  return {
    strategyActivityFloatingPanelProps,
    appOverlayPanelsProps,
  }
}
