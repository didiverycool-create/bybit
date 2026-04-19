import type { LatestBacktestPanelViewProps } from './LatestBacktestPanel.types'
import LatestBacktestPanelBacktestSection from './LatestBacktestPanelBacktestSection'
import LatestBacktestPanelLineageSection from './LatestBacktestPanelLineageSection'
import LatestBacktestPanelReviewJobSection from './LatestBacktestPanelReviewJobSection'
import LatestBacktestPanelRuntimeSection from './LatestBacktestPanelRuntimeSection'

export default function LatestBacktestPanelView({
  selectedStrategySymbolsLabel,
  latestStrategyBacktest,
  selectedStrategyRuntime,
  ...sectionProps
}: LatestBacktestPanelViewProps) {
  return (
    <>
      <div className="panel-head panel-head--compact">
        <div>
          <span className="section-label">最新回测与请求</span>
          <h3>围绕当前策略的执行上下文</h3>
        </div>
        <span className="chip chip--muted">{selectedStrategySymbolsLabel}</span>
      </div>
      {latestStrategyBacktest ? (
        <div className="stack-list">
          <LatestBacktestPanelBacktestSection
            {...sectionProps}
            latestStrategyBacktest={latestStrategyBacktest}
          />
          <LatestBacktestPanelLineageSection {...sectionProps} latestStrategyBacktest={latestStrategyBacktest} />
          <LatestBacktestPanelReviewJobSection
            {...sectionProps}
            latestStrategyBacktest={latestStrategyBacktest}
          />
          <LatestBacktestPanelRuntimeSection selectedStrategyRuntime={selectedStrategyRuntime} />
        </div>
      ) : (
        <div className="empty-state empty-state--inline">当前策略还没有回测记录</div>
      )}
    </>
  )
}
