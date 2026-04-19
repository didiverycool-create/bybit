import SelectedChangeRequestPanelView from './SelectedChangeRequestPanelView'
import { buildSelectedChangeRequestPanelViewProps } from './buildSelectedChangeRequestPanelViewProps'
export type {
  SelectedChangeRequestPanelDecisionMeta,
  SelectedChangeRequestPanelProps,
  SelectedChangeRequestPanelRecommendationMeta,
  SelectedChangeRequestPanelSampleMeta,
  SelectedChangeRequestPanelViewProps,
  SelectedChangeRequestPanelWindowMeta,
} from './SelectedChangeRequestPanel.types'
import type { SelectedChangeRequestPanelProps } from './SelectedChangeRequestPanel.types'

export default function SelectedChangeRequestPanel(props: SelectedChangeRequestPanelProps) {
  return <SelectedChangeRequestPanelView {...buildSelectedChangeRequestPanelViewProps(props)} />
}
