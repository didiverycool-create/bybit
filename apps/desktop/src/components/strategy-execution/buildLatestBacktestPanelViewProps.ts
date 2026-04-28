import type {
  LatestBacktestPanelProps,
  LatestBacktestPanelViewProps,
} from './LatestBacktestPanel.types'

export function buildLatestBacktestPanelViewProps(
  props: LatestBacktestPanelProps,
): LatestBacktestPanelViewProps {
  return {
    ...props,
    selectedStrategySymbolsLabel: props.selectedStrategy.symbols.join(' / '),
  }
}
