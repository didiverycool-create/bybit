import { pnlToneClass } from '../../utils/app-helpers'
import type { TradesWorkspaceSummaryPanelProps } from './types'

export function TradesWorkspaceSummaryPanel({
  privateApiReady,
  onOpenAccountInspector,
  accountOverview,
  todayRealizedPnl,
}: TradesWorkspaceSummaryPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <span className="section-label">账户与委托</span>
          <h3>账户总览、持仓与未成交委托</h3>
        </div>
        <div className="chip-row">
          <span className={`chip ${privateApiReady ? 'chip--success' : 'chip--warning'}`}>
            {privateApiReady ? 'Bybit 私有 API 已接通' : 'Bybit 私有 API 未配置'}
          </span>
          <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenAccountInspector}>
            账户详情
          </button>
        </div>
      </div>
      <div className="status-strip status-strip--compact status-strip--account">
        <div>
          <span>总权益</span>
          <strong>{accountOverview?.total_equity ?? '--'}</strong>
        </div>
        <div>
          <span>可用余额</span>
          <strong>{accountOverview?.total_available_balance ?? '--'}</strong>
        </div>
        <div>
          <span>已实现盈亏</span>
          <strong className={pnlToneClass(todayRealizedPnl)}>{todayRealizedPnl ?? '--'}</strong>
        </div>
        <div>
          <span>未实现盈亏</span>
          <strong className={pnlToneClass(accountOverview?.unrealised_pnl)}>{accountOverview?.unrealised_pnl ?? '--'}</strong>
        </div>
      </div>
    </article>
  )
}
