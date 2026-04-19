import { Suspense, lazy } from 'react'
import { AlertTriangle } from 'lucide-react'

import type { MarketWorkspaceHeroSectionProps } from './marketWorkspaceSectionTypes'
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
  riskLevelLabel,
  riskToneClass,
  signalLabel,
  signalToneClass,
} from '../utils/app-helpers'

const loadReactECharts = () => import('./LazyECharts')
const ReactECharts = lazy(loadReactECharts)
void loadReactECharts()

export default function MarketWorkspaceHeroSection({
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
  marketLiveStatusMessage,
  marketLiveStatusTitle,
  selectedWatchAlertLabel,
  selectedMarketTimeframe,
  marketTimeframeOptions,
  onSelectMarketTimeframe,
  onOpenWatchlistManager,
}: MarketWorkspaceHeroSectionProps) {
  const selectedWatchItem = watchlist.find((item) => item.symbol === selectedSymbol)

  return (
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
      {marketLiveStatusMessage && (
        <div
          className="service-banner service-banner--warning service-banner--inline"
          title={marketLiveStatusTitle || undefined}
        >
          <AlertTriangle size={16} />
          <div>
            <strong>实时流异常</strong>
            <p>{marketLiveStatusMessage}</p>
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
  )
}
