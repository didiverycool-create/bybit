import type { BybitPrivateStatus, BybitPublicStatus, BybitPublicSymbolDiagnostic } from '../../types'
import {
  bybitPrivateRealtimeStatusLabel,
  bybitPublicChannelStatusLabel,
  bybitPublicDiagnosticSummary,
  bybitRestReachabilityLabel,
  formatTime,
} from '../../utils/app-helpers'

export type BybitDiagnosticsPanelProps = {
  bybitPublicStatus?: BybitPublicStatus | null
  bybitPrivateStatus?: BybitPrivateStatus | null
  bybitPublicVisibleDiagnostics: BybitPublicSymbolDiagnostic[]
}

export default function BybitDiagnosticsPanel({
  bybitPublicStatus,
  bybitPrivateStatus,
  bybitPublicVisibleDiagnostics,
}: BybitDiagnosticsPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <span className="section-label">Bybit 链路诊断</span>
          <h3>公共行情与私有执行状态</h3>
        </div>
        <div className="chip-row">
          <span className={`chip ${bybitPublicStatus?.recommended_action ? 'chip--warning' : 'chip--success'}`}>
            {bybitPublicStatus?.recommended_action ? '公共行情链路待处理' : '公共行情链路正常'}
          </span>
          <span
            className={`chip ${
              bybitPrivateStatus?.realtime_recommended_action
                ? 'chip--warning'
                : bybitPrivateStatus?.can_query_private
                  ? 'chip--success'
                  : 'chip--warning'
            }`}
          >
            {bybitPrivateStatus?.realtime_recommended_action
              ? '私有执行链路待处理'
              : bybitPrivateStatus?.can_query_private
                ? '私有执行链路正常'
                : '私有执行链路未配置'}
          </span>
        </div>
      </div>
      <div className="settings-grid">
        <div className="settings-block">
          <span className="section-label">公共行情链路</span>
          <div className="contract-list">
            <code>{bybitRestReachabilityLabel(bybitPublicStatus?.rest_reachable)}</code>
            <code>{bybitPublicChannelStatusLabel('linear', bybitPublicStatus)}</code>
            <code>{bybitPublicChannelStatusLabel('spot', bybitPublicStatus)}</code>
          </div>
          <p className="panel-note">
            {bybitPublicStatus?.recommended_action ??
              '当前 Bybit 公共实时链路正常，watchlist 目标品种会继续按实时 feed 做真实执行门禁。'}
          </p>
          {bybitPublicStatus?.last_error && <p className="panel-note">最近错误：{bybitPublicStatus.last_error}</p>}
          {bybitPublicStatus?.rest_last_error && (
            <p className="panel-note">REST 探针错误：{bybitPublicStatus.rest_last_error}</p>
          )}
        </div>
        <div className="settings-block">
          <span className="section-label">私有执行链路</span>
          <div className="contract-list">
            <code>{bybitPrivateStatus?.account_type ?? 'UNIFIED'}</code>
            <code>{bybitPrivateRealtimeStatusLabel(bybitPrivateStatus)}</code>
            <code>{bybitPrivateStatus?.key_hint ?? '未检测到 API Key'}</code>
          </div>
          <p className="panel-note">
            {bybitPrivateStatus?.realtime_recommended_action ??
              (bybitPrivateStatus?.can_query_private
                ? '当前 Bybit 私有账户链路正常，可继续作为 Demo / Live 只读与真实执行门禁依据。'
                : '尚未检测到可用的 Bybit 私有 API 配置。')}
          </p>
          {bybitPrivateStatus?.realtime_last_error && (
            <p className="panel-note">最近错误：{bybitPrivateStatus.realtime_last_error}</p>
          )}
        </div>
      </div>
      <div className="trade-list trade-list--dense">
        {bybitPublicVisibleDiagnostics.map((item) => (
          <div key={`${item.symbol}-${item.market}`} className="trade-row trade-row--fade">
            <div className="console-row__main">
              <strong>
                {item.symbol} · {item.market === 'perp' ? '永续' : '现货'}
              </strong>
              <p>{bybitPublicDiagnosticSummary(item)}</p>
              {item.recommended_action && <p>{item.recommended_action}</p>}
            </div>
            <div className="trade-meta">
              <span className={`console-tag ${item.issue ? 'console-tag--warn' : ''}`}>
                {item.channel === 'linear' ? 'Linear' : 'Spot'}
              </span>
              <span className={`console-tag ${item.connected ? '' : 'console-tag--warn'}`}>
                {item.connected ? '已连通' : '未连通'}
              </span>
              <span className={`console-tag ${item.has_symbol_feed ? '' : 'console-tag--warn'}`}>
                {item.has_symbol_feed ? '有 feed' : '缺首帧'}
              </span>
              {item.stale ? <span className="console-tag console-tag--warn">已失活</span> : null}
              <small>{formatTime(item.last_message_at)}</small>
            </div>
          </div>
        ))}
        {!bybitPublicVisibleDiagnostics.length && (
          <div className="empty-state empty-state--inline">当前没有可展示的公共链路诊断。</div>
        )}
      </div>
    </article>
  )
}
