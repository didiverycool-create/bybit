import type { LatestBacktestPanelProps } from './LatestBacktestPanel.types'
import {
  formatNumber,
  strategyRuntimeSignalLabel,
  strategyRuntimeSignalToneClass,
} from '../../utils/app-helpers'

export default function LatestBacktestPanelRuntimeSection({
  selectedStrategyRuntime,
}: Pick<LatestBacktestPanelProps, 'selectedStrategyRuntime'>) {
  if (!selectedStrategyRuntime) {
    return null
  }

  return (
    <div className="stack-row">
      <strong>运行态</strong>
      <span>
        <span className={strategyRuntimeSignalToneClass(selectedStrategyRuntime.signal)}>
          {strategyRuntimeSignalLabel(selectedStrategyRuntime.signal)}
        </span>
        {' · '}
        参考价 {formatNumber(selectedStrategyRuntime.reference_price)}
        {' · '}
        最新 {formatNumber(selectedStrategyRuntime.last_price)}
      </span>
    </div>
  )
}
