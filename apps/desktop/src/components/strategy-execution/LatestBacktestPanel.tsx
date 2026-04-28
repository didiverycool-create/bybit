import LatestBacktestPanelView from './LatestBacktestPanelView'
import { buildLatestBacktestPanelViewProps } from './buildLatestBacktestPanelViewProps'
import type { LatestBacktestPanelProps } from './LatestBacktestPanel.types'

export type { LatestBacktestPanelProps } from './LatestBacktestPanel.types'

export default function LatestBacktestPanel(props: LatestBacktestPanelProps) {
  return <LatestBacktestPanelView {...buildLatestBacktestPanelViewProps(props)} />
}
