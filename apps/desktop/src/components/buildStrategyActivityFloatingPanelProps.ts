import type { ComponentProps } from 'react'

import {
  buildStrategyActivityFloatingPanelModel,
  type BuildStrategyActivityFloatingPanelPropsArgs,
} from './buildStrategyActivityFloatingPanelModel'
import type StrategyActivityFloatingPanelContainer from './StrategyActivityFloatingPanelContainer'

type StrategyActivityFloatingPanelProps = ComponentProps<typeof StrategyActivityFloatingPanelContainer>
export type { BuildStrategyActivityFloatingPanelPropsArgs }

export function buildStrategyActivityFloatingPanelProps({
  panelOpen,
  selectedStrategy,
  strategyActivitySnapshotModel,
  queryState,
  activityMeta,
  activeStrategyId,
  serviceState,
  workspaceState,
  decisionModel,
  progressModel,
  opsModel,
  actions,
  focusLabels,
}: BuildStrategyActivityFloatingPanelPropsArgs): StrategyActivityFloatingPanelProps {
  const floatingPanelModel = buildStrategyActivityFloatingPanelModel({
    panelOpen,
    selectedStrategy,
    strategyActivitySnapshotModel,
    queryState,
    activityMeta,
    activeStrategyId,
    serviceState,
    workspaceState,
    decisionModel,
    progressModel,
    opsModel,
    actions,
    focusLabels,
  })

  return {
    panelOpen,
    selectedStrategy,
    queryState,
    activityMeta: floatingPanelModel.activityMeta,
    activeStrategyId,
    serviceState: floatingPanelModel.serviceState,
    onTrack: floatingPanelModel.onTrack,
    onClose: floatingPanelModel.onClose,
    sectionProps: floatingPanelModel.sectionProps,
  }
}
