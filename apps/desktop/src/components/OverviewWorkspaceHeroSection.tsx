import { Suspense, lazy } from 'react'
import { AlertTriangle } from 'lucide-react'

import type {
  ExecutionHealthSummary,
  MarketDetail,
  MarketLiveDiagnostics,
  LayoutPreset,
  StrategySummary,
  WatchlistInstrument,
} from '../types'
import {
  buildCandleOption,
  executionHealthLabel,
  executionHealthToneClass,
  executionHealthTooltip,
  formatCompactNumber,
  formatNumber,
  formatPercent,
  isMarketFallbackSource,
  marketDiagnosticsToneClass,
  riskLevelLabel,
  signalLabel,
} from '../utils/app-helpers'
import type { MarketTimeframe, TimeframeOption } from './overviewWorkspaceTypes'

const loadReactECharts = () => import('./LazyECharts')
const ReactECharts = lazy(loadReactECharts)
void loadReactECharts()

type OverviewWorkspaceHeroSectionProps = {
  layoutPreset: LayoutPreset
  selectedSymbol: string
  selectedStrategy: StrategySummary | null
  showStrategyWatch: boolean
  overviewWatchlistItems: WatchlistInstrument[]
  selectedMarketTimeframe: MarketTimeframe
  marketTimeframeOptions: TimeframeOption[]
  onSelectMarketSymbol: (symbol: string, latestPrice?: number | null) => void
  onSelectMarketTimeframe: (value: MarketTimeframe) => void
  marketRenderableDetail: MarketDetail | null
  marketDiagnostics: MarketLiveDiagnostics | null
  marketDetailLoading: boolean
  marketDetailErrorMessage: string | null
  marketLiveStatusMessage: string | null
  marketLiveStatusTitle: string
  snapshotExecutionHealth?: ExecutionHealthSummary | null
  marketDiagnosticsTitle: string
  marketDiagnosticsSummary: string
}

export default function OverviewWorkspaceHeroSection({
  layoutPreset,
  selectedSymbol,
  selectedStrategy,
  showStrategyWatch,
  overviewWatchlistItems,
  selectedMarketTimeframe,
  marketTimeframeOptions,
  onSelectMarketSymbol,
  onSelectMarketTimeframe,
  marketRenderableDetail,
  marketDiagnostics,
  marketDetailLoading,
  marketDetailErrorMessage,
  marketLiveStatusMessage,
  marketLiveStatusTitle,
  snapshotExecutionHealth,
  marketDiagnosticsTitle,
  marketDiagnosticsSummary,
}: OverviewWorkspaceHeroSectionProps) {
  const selectedWatchItem = overviewWatchlistItems.find((item) => item.symbol === selectedSymbol)

  return (
    <div className={`terminal-home terminal-home--${layoutPreset}`}>
      <div className="terminal-home__stage">
        <div className="terminal-stage__toolbar">
          <div className="terminal-stage__meta">
            <div className="terminal-stage__title-row">
              <div className="terminal-stage__title">
                <h3>{selectedSymbol}</h3>
                {selectedStrategy?.name && <p className="terminal-stage__subline">{selectedStrategy.name}</p>}
              </div>
              <div className="chip-row">
                {showStrategyWatch && (
                  <div className="terminal-watchstrip terminal-watchstrip--toolbar">
                    {overviewWatchlistItems.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        className={`terminal-watchstrip__item ${item.symbol === selectedSymbol ? 'active' : ''}`}
                        title={`${item.symbol} · ${formatNumber(item.last_price)} · ${signalLabel(item.signal)} · ${riskLevelLabel(item.risk_level)} · ${formatPercent(item.change_24h)}`}
                        onClick={() => {
                          onSelectMarketSymbol(item.symbol, item.last_price)
                        }}
                      >
                        <strong>{item.symbol}</strong>
                        <small className={item.change_24h >= 0 ? 'positive' : 'negative'}>{formatPercent(item.change_24h)}</small>
                      </button>
                    ))}
                  </div>
                )}
                {marketTimeframeOptions.map((preset) => (
                  <button
                    key={`overview-tf-${preset.value}`}
                    type="button"
                    className={selectedMarketTimeframe === preset.value ? 'pill active' : 'pill'}
                    onClick={() => onSelectMarketTimeframe(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
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
        <div className="terminal-stage__hero">
          <div className="terminal-stage__chartblock">
            <div
              className="terminal-stage__chart"
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
            <div className="terminal-stage__metrics terminal-stage__metrics--compact">
              <div title="主图当前价格">
                <span>最新价</span>
                <strong>{marketRenderableDetail ? formatNumber(marketRenderableDetail.candles.at(-1)?.close ?? 0) : '--'}</strong>
              </div>
              <div title="24H 涨跌幅">
                <span>24H</span>
                <strong className={(selectedWatchItem?.change_24h ?? 0) >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(selectedWatchItem?.change_24h ?? 0)}
                </strong>
              </div>
              <div title="信号与风险会在 hover 时在完整行情页与提醒里展开">
                <span>信号 / 风险</span>
                <strong>
                  {selectedWatchItem
                    ? `${signalLabel(selectedWatchItem.signal)} · ${riskLevelLabel(selectedWatchItem.risk_level)}`
                    : '--'}
                </strong>
              </div>
              <div title="成交量">
                <span>成交量</span>
                <strong>{formatCompactNumber(selectedWatchItem?.volume_24h ?? 0)}</strong>
              </div>
              <div title={executionHealthTooltip(snapshotExecutionHealth)}>
                <span>执行健康</span>
                <strong className={executionHealthToneClass(snapshotExecutionHealth)}>
                  {executionHealthLabel(snapshotExecutionHealth)}
                </strong>
              </div>
              <div title={marketDiagnosticsTitle}>
                <span>行情诊断</span>
                <strong className={marketDiagnosticsToneClass(marketDiagnostics)}>{marketDiagnosticsSummary}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
