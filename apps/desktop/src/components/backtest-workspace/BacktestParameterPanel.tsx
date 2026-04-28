type BacktestParameterComparisonItem = {
  key: string
  label: string
  backtestValue: string
  currentValue: string
  changed: boolean
}

export type BacktestParameterPanelProps = {
  backtestParameterComparison: BacktestParameterComparisonItem[]
}

export default function BacktestParameterPanel({
  backtestParameterComparison,
}: BacktestParameterPanelProps) {
  return (
    <div className="console-panel">
      <div className="panel-head panel-head--compact">
        <div>
          <span className="section-label">参数对比</span>
          <h3>当前策略 vs 回测快照</h3>
        </div>
      </div>
      <div className="job-list">
        {backtestParameterComparison.map((item) => (
          <div key={item.key} className="job-row">
            <div className="console-row__main">
              <strong>{item.label}</strong>
              <p>
                快照 {item.backtestValue} · 当前 {item.currentValue}
              </p>
            </div>
            <div className="job-meta">
              <span className={`console-tag ${item.changed ? 'console-tag--warn' : ''}`}>
                {item.changed ? '已变更' : '一致'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
