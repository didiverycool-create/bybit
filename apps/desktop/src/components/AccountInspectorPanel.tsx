import { X } from 'lucide-react'

import type {
  AccountOverview,
  BybitPrivateStatus,
  BybitPublicStatus,
  BybitTradeProbeResult,
} from '../types'
import {
  accountSourceLabel,
  bybitPrivateRealtimeStatusLabel,
  bybitPublicChannelStatusLabel,
  bybitRestReachabilityLabel,
  formatTime,
  tradeProbeLabel,
} from '../utils/app-helpers'

type AccountInspectorPanelProps = {
  open: boolean
  onClose: () => void
  accountOverview?: AccountOverview | null
  bybitPrivateStatus?: BybitPrivateStatus | null
  bybitPublicStatus?: BybitPublicStatus | null
  bybitWebEntry: string
  tradeProbeResult?: BybitTradeProbeResult | null
  tradeProbePending: boolean
  onProbeTradeRoute: () => void
}

export default function AccountInspectorPanel({
  open,
  onClose,
  accountOverview,
  bybitPrivateStatus,
  bybitPublicStatus,
  bybitWebEntry,
  tradeProbeResult,
  tradeProbePending,
  onProbeTradeRoute,
}: AccountInspectorPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel floating-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-label="账户详情窗口"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">账户详情</span>
            <h3>账户来源、链路与持仓摘要</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭账户详情窗口"
            aria-label="关闭账户详情窗口"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="floating-panel__body">
          <div className="account-inspector-grid">
            <div className="account-hero-card account-hero-card--headline">
              <span>账户状态</span>
              <strong>{accountSourceLabel(accountOverview?.source)}</strong>
              <p>
                {accountOverview?.source === 'paper'
                  ? '当前账户、持仓与余额由本地 Paper 成交派生。'
                  : bybitPrivateStatus?.can_query_private
                    ? '程序侧私有 API 已接入，切到 Demo / Live 会读取真实账户。'
                    : '尚未检测到可用的私有 API 配置。'}
              </p>
            </div>
            <div className="account-hero-card account-hero-card--headline">
              <span>交易链路</span>
              <strong>{tradeProbeLabel(tradeProbeResult?.outcome)}</strong>
              <p>{tradeProbeResult?.detail ?? '可使用右侧按钮对真实交易 POST 链路做一次安全探测。'}</p>
            </div>
            <div className="api-panel api-panel--bottom account-inspector-grid__wide">
              <span className="section-label">私有 API 状态</span>
              <div className="contract-list">
                <code>{bybitPrivateStatus?.api_base_url ?? 'https://api.bybit.com'}</code>
                <code>{bybitPrivateStatus?.key_hint ?? '未检测到 API Key'}</code>
                <code>{bybitPrivateStatus?.account_type ?? 'UNIFIED'}</code>
                <code>{bybitPrivateRealtimeStatusLabel(bybitPrivateStatus)}</code>
              </div>
              <p>
                账户读取走程序侧私有 API，网页入口仍使用{' '}
                <a href={bybitWebEntry} target="_blank" rel="noreferrer">
                  {bybitWebEntry}
                </a>
                ，数据读取走私有 API 域名。
              </p>
              {bybitPrivateStatus?.realtime_recommended_action && (
                <p className="panel-note">{bybitPrivateStatus.realtime_recommended_action}</p>
              )}
              <div className="hero-actions hero-actions--compact">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!bybitPrivateStatus?.can_query_private || tradeProbePending}
                  onClick={onProbeTradeRoute}
                >
                  探测真实交易链路
                </button>
              </div>
              {tradeProbeResult && (
                <p>
                  {tradeProbeLabel(tradeProbeResult.outcome)} · {tradeProbeResult.detail}
                </p>
              )}
              {!!bybitPrivateStatus?.usdt_balance_diagnostics?.length && (
                <div className="trade-list trade-list--dense account-inspector-list">
                  {bybitPrivateStatus.usdt_balance_diagnostics.map((item) => (
                    <div
                      key={`${item.account_type}-${item.coin}`}
                      className="trade-row trade-row--fade"
                    >
                      <div className="console-row__main">
                        <strong>{item.account_type}</strong>
                        <p>
                          可用 {item.available_balance} {item.coin} · 钱包 {item.wallet_balance} {item.coin}
                        </p>
                      </div>
                      <div className="trade-meta">
                        <span className={`console-tag ${item.error ? 'console-tag--warn' : ''}`}>
                          {item.error ? '查询失败' : item.source === 'wallet-balance' ? '钱包快照' : '账户余额'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {bybitPrivateStatus?.last_error && <p>{bybitPrivateStatus.last_error}</p>}
              <span className="section-label">公共行情链路</span>
              <div className="contract-list">
                <code>{bybitRestReachabilityLabel(bybitPublicStatus?.rest_reachable)}</code>
                <code>{bybitPublicChannelStatusLabel('linear', bybitPublicStatus)}</code>
                <code>{bybitPublicChannelStatusLabel('spot', bybitPublicStatus)}</code>
                <code>{formatTime(bybitPublicStatus?.rest_tested_at ?? bybitPublicStatus?.updated_at)}</code>
              </div>
              <p className="panel-note">
                {bybitPublicStatus?.recommended_action ?? '当前 Bybit 公共实时链路正常，目标品种实时行情会继续作为真实执行门禁。'}
              </p>
              {bybitPublicStatus?.last_error && <p>最近错误：{bybitPublicStatus.last_error}</p>}
            </div>
          </div>
          <div className="trade-list trade-list--dense account-inspector-list">
            {(accountOverview?.top_holdings ?? []).map((asset, index) => (
              <div key={asset.coin} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 18}ms` }}>
                <div className="console-row__main">
                  <strong>{asset.coin}</strong>
                  <p>可用 {asset.available_balance} · 账面 {asset.wallet_balance}</p>
                </div>
                <div className="trade-meta">
                  <span className="console-tag">{asset.usd_value}</span>
                </div>
              </div>
            ))}
            {!accountOverview?.top_holdings?.length && (
              <div className="empty-state empty-state--inline">当前账户没有可展示的资产持仓。</div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
