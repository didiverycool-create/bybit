import { Suspense, lazy } from 'react'
import { AlertTriangle } from 'lucide-react'

import type { MarketDetail, MarketLiveDiagnostics, WatchlistInstrument } from '../types'
import {
  buildCandleOption,
  formatCompactNumber,
  formatNumber,
  formatPercent,
  formatTime,
  isMarketFallbackSource,
  marketDiagnosticsToneClass,
  marketSourceLabel,
  marketSourceToneClass,
  marketTradeSideClass,
  marketTradeSideLabel,
  riskLevelLabel,
  riskToneClass,
  signalLabel,
  signalToneClass,
} from '../utils/app-helpers'

const loadReactECharts = () => import('./LazyECharts')
const ReactECharts = lazy(loadReactECharts)
void loadReactECharts()

type MarketTimeframe = '15m' | '1h' | '4h' | '1d'

type TimeframeOption = {
  value: MarketTimeframe
  label: string
}

type MarketWorkspaceSectionProps = {
  watchlistErrorMessage: string
  watchlist: WatchlistInstrument[]
  selectedSymbol: string
  onSelectMarketSymbol: (symbol: string, latestPrice?: number | null) => void
  marketDetail: MarketDetail | null
  marketRenderableDetail: MarketDetail | null
  marketDiagnostics: MarketLiveDiagnostics | null
  marketDiagnosticsSummary: string
  marketDiagnosticsTitle: string
  marketHeader: string
  marketDetailLoading: boolean
  marketDetailErrorMessage: string
  selectedWatchAlertLabel: string
  selectedMarketTimeframe: MarketTimeframe
  marketTimeframeOptions: TimeframeOption[]
  onSelectMarketTimeframe: (value: MarketTimeframe) => void
  onOpenWatchlistManager: () => void
  onOpenManualTrade: () => void
  manualTradingBlockedReason?: string | null
}

export default function MarketWorkspaceSection({
  watchlistErrorMessage,
  watchlist,
  selectedSymbol,
  onSelectMarketSymbol,
  marketDetail,
  marketRenderableDetail,
  marketDiagnostics,
  marketDiagnosticsSummary,
  marketDiagnosticsTitle,
  marketHeader,
  marketDetailLoading,
  marketDetailErrorMessage,
  selectedWatchAlertLabel,
  selectedMarketTimeframe,
  marketTimeframeOptions,
  onSelectMarketTimeframe,
  onOpenWatchlistManager,
  onOpenManualTrade,
  manualTradingBlockedReason,
}: MarketWorkspaceSectionProps) {
  const selectedWatchItem = watchlist.find((item) => item.symbol === selectedSymbol)
  const marketPublicTrades = marketDetail?.recent_public_trades ?? []

  return (
    <section className="section-grid section-grid--market section-entrance">
      <article className="panel panel--hero">
        <div className="panel-head">
          <div>
            <span className="section-label">实时行情</span>
            <h3>自选品种与 K 线跟踪</h3>
          </div>
          <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenWatchlistManager}>
            管理自选
          </button>
        </div>
        {watchlistErrorMessage && (
          <div className="service-banner service-banner--warning service-banner--inline">
            <AlertTriangle size={16} />
            <div>
              <strong>自选列表刷新失败</strong>
              <p>{watchlistErrorMessage}</p>
            </div>
          </div>
        )}
        <div className="market-toolbar market-toolbar--compact">
          <div className="terminal-watchstrip terminal-watchstrip--market">
            {watchlist.length > 0 ? (
              watchlist.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  className={`terminal-watchstrip__item ${selectedSymbol === item.symbol ? 'active' : ''}`}
                  onClick={() => onSelectMarketSymbol(item.symbol, item.last_price)}
                  title={`${item.symbol} · ${formatNumber(item.last_price)} · ${signalLabel(item.signal)} · ${riskLevelLabel(item.risk_level)}`}
                >
                  <strong>{item.symbol}</strong>
                  <small className={item.change_24h >= 0 ? 'positive' : 'negative'}>{formatPercent(item.change_24h)}</small>
                </button>
              ))
            ) : (
              <div className="empty-state empty-state--inline">
                {watchlistErrorMessage ? `自选刷新失败：${watchlistErrorMessage}` : '当前还没有自选品种。'}
              </div>
            )}
          </div>
          <div className="market-toolbar__meta">
            <span className={`chip ${marketSourceToneClass(marketDetail?.source)}`}>{marketSourceLabel(marketDetail?.source)}</span>
            {marketTimeframeOptions.map((preset) => (
              <button
                key={`market-tf-${preset.value}`}
                type="button"
                className={selectedMarketTimeframe === preset.value ? 'pill active' : 'pill'}
                onClick={() => onSelectMarketTimeframe(preset.value)}
              >
                {preset.label}
              </button>
            ))}
            <span className="chip chip--muted">{selectedWatchAlertLabel}</span>
          </div>
        </div>
        <div className="market-hero-layout market-hero-layout--compact">
          <div className="chart-frame">
            <div
              className="chart-stage chart-stage--live"
              title={marketHeader}
              data-rendered-symbol={marketRenderableDetail?.symbol ?? ''}
              data-rendered-timeframe={marketRenderableDetail?.timeframe ?? ''}
              data-rendered-updated-at={marketRenderableDetail?.updated_at ?? ''}
              data-rendered-candle-count={marketRenderableDetail?.candles.length ?? 0}
              data-rendered-detail-source={marketDiagnostics?.detail_source ?? marketRenderableDetail?.source ?? ''}
              data-rendered-generated-ms={marketDiagnostics?.generated_in_ms ?? 0}
              data-rendered-fallback-count={
                isMarketFallbackSource(marketDiagnostics?.detail_source ?? marketRenderableDetail?.source) ? 1 : 0
              }
              data-rendered-selection-corrected={marketDiagnostics?.selection_corrected ? '1' : '0'}
            >
              {marketRenderableDetail ? (
                <Suspense fallback={<div className="empty-state empty-state--inline">图表加载中...</div>}>
                  <ReactECharts
                    key={`market-chart:${marketRenderableDetail.symbol}:${marketRenderableDetail.timeframe}`}
                    option={buildCandleOption(marketRenderableDetail)}
                    style={{ height: '100%', width: '100%' }}
                    notMerge
                  />
                </Suspense>
              ) : (
                <div className="empty-state empty-state--inline">
                  {marketDetailLoading ? '' : marketDetailErrorMessage || '当前行情暂未返回。'}
                </div>
              )}
            </div>
            <div className="terminal-summary-strip terminal-summary-strip--compact market-summary-strip">
              <div className="terminal-summary-strip__item">
                <span>最新价</span>
                <strong>{marketDetail ? formatNumber(marketDetail.candles.at(-1)?.close ?? 0) : '--'}</strong>
              </div>
              <div className="terminal-summary-strip__item">
                <span>24H</span>
                <strong className={(selectedWatchItem?.change_24h ?? 0) >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(selectedWatchItem?.change_24h ?? 0)}
                </strong>
              </div>
              <div className="terminal-summary-strip__item">
                <span>信号</span>
                <strong className={selectedWatchItem ? signalToneClass(selectedWatchItem.signal) : ''}>
                  {selectedWatchItem ? signalLabel(selectedWatchItem.signal) : '--'}
                </strong>
              </div>
              <div className="terminal-summary-strip__item">
                <span>风险</span>
                <strong className={selectedWatchItem ? riskToneClass(selectedWatchItem.risk_level) : ''}>
                  {selectedWatchItem ? riskLevelLabel(selectedWatchItem.risk_level) : '--'}
                </strong>
              </div>
              <div className="terminal-summary-strip__item">
                <span>成交量</span>
                <strong>{formatCompactNumber(selectedWatchItem?.volume_24h ?? 0)}</strong>
              </div>
              <div className="terminal-summary-strip__item">
                <span>更新时间</span>
                <strong>{formatTime(marketDetail?.updated_at)}</strong>
              </div>
              <div className="terminal-summary-strip__item" title={marketDiagnosticsTitle}>
                <span>行情诊断</span>
                <strong className={marketDiagnosticsToneClass(marketDiagnostics)}>{marketDiagnosticsSummary}</strong>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">盘口与手动交易</span>
            <h3>辅助交易面板</h3>
          </div>
          <div className="chip-row">
            <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenManualTrade}>
              打开手动交易
            </button>
            <span className="chip chip--muted" title="Paper 走本地成交，Demo / Live 走 Bybit 真实限价委托。">
              手动交易入口
            </span>
            <span className="chip chip--muted">{selectedWatchAlertLabel}</span>
          </div>
        </div>
        <div className="market-liquidity-grid market-liquidity-grid--tight">
          <div className="orderbook-column">
            <strong>买盘</strong>
            {marketDetail?.bids.slice(0, 4).map((item) => (
              <div key={`bid-${item.price}`} className="orderbook-row">
                <span>{formatNumber(item.price)}</span>
                <span>{formatNumber(item.size)}</span>
                <span>{formatNumber(item.total)}</span>
              </div>
            ))}
          </div>
          <div className="orderbook-column">
            <strong>卖盘</strong>
            {marketDetail?.asks.slice(0, 4).map((item) => (
              <div key={`ask-${item.price}`} className="orderbook-row">
                <span>{formatNumber(item.price)}</span>
                <span>{formatNumber(item.size)}</span>
                <span>{formatNumber(item.total)}</span>
              </div>
            ))}
          </div>
          <div className="trade-tape-column">
            <div className="trade-tape-column__head">
              <strong>最近成交</strong>
              <span>{marketPublicTrades.length} 条</span>
            </div>
            <div className="trade-tape-list">
              {marketPublicTrades.slice(0, 6).map((item, index) => (
                <div
                  key={`${item.occurred_at}-${item.price}-${index}`}
                  className="trade-tape-row trade-tape-row--fade"
                  style={{ animationDelay: `${index * 24}ms` }}
                >
                  <span className={`trade-tape-row__badge ${marketTradeSideClass(item.side)}`}>
                    {marketTradeSideLabel(item.side)}
                  </span>
                  <strong className={marketTradeSideClass(item.side)}>{formatNumber(item.price)}</strong>
                  <span>{formatNumber(item.size)}</span>
                  <span>{formatTime(item.occurred_at)}</span>
                </div>
              ))}
              {marketPublicTrades.length === 0 && (
                <div className="empty-state empty-state--inline">当前没有可展示的公共成交流。</div>
              )}
            </div>
          </div>
        </div>

        {manualTradingBlockedReason && (
          <div className="service-banner service-banner--warning service-banner--inline">
            <AlertTriangle size={16} />
            <div>
              <strong>手动交易暂不可提交</strong>
              <p>{manualTradingBlockedReason}</p>
            </div>
          </div>
        )}
      </article>
    </section>
  )
}
