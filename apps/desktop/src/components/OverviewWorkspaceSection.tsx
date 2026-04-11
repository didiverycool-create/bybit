import { Suspense, lazy } from 'react'
import { Bot, ClipboardList } from 'lucide-react'

import type {
  AgentJob,
  ChangeRequest,
  ExecutionEvent,
  ExecutionHealthSummary,
  LayoutPreset,
  MarketDetail,
  MarketLiveDiagnostics,
  StrategySummary,
  WatchlistInstrument,
} from '../types'
import {
  agentJobContextMeta,
  auditImpactMeta,
  buildCandleOption,
  eventCategoryMeta,
  executionHealthLabel,
  executionHealthToneClass,
  executionHealthTooltip,
  formatCompactNumber,
  formatNumber,
  formatPercent,
  formatTime,
  getAgentJobBacktestId,
  getAgentJobLinkedReviewId,
  getAgentJobSourceBacktestId,
  getAgentJobSourceProposalId,
  getAgentJobSourceReviewId,
  getAgentJobStrategyId,
  getAuditBacktestId,
  getAuditJobId,
  getAuditLinkedReviewId,
  getAuditSourceBacktestId,
  getAuditSourceProposalId,
  getAuditSourceReviewId,
  getAuditStrategyId,
  isMarketFallbackSource,
  jobStatusLabel,
  marketDiagnosticsToneClass,
  riskLevelLabel,
  signalLabel,
} from '../utils/app-helpers'

const loadReactECharts = () => import('./LazyECharts')
const ReactECharts = lazy(loadReactECharts)
void loadReactECharts()

type MarketTimeframe = '15m' | '1h' | '4h' | '1d'

type TimeframeOption = {
  value: MarketTimeframe
  label: string
}

type OverviewWorkspaceSectionProps = {
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
  marketDetailErrorMessage: string
  snapshotExecutionHealth?: ExecutionHealthSummary | null
  marketDiagnosticsTitle: string
  marketDiagnosticsSummary: string
  schedulerJobs: AgentJob[]
  overviewAiEvents: ExecutionEvent[]
  overviewQueuedRequests: ChangeRequest[]
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId: string) => void
  onOpenAiSchedulerJob: (jobId: string) => void
}

export default function OverviewWorkspaceSection({
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
  snapshotExecutionHealth,
  marketDiagnosticsTitle,
  marketDiagnosticsSummary,
  schedulerJobs,
  overviewAiEvents,
  overviewQueuedRequests,
  onOpenReviewInspector,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
  onOpenAiSchedulerJob,
}: OverviewWorkspaceSectionProps) {
  const selectedWatchItem = overviewWatchlistItems.find((item) => item.symbol === selectedSymbol)

  return (
    <section className={`overview-studio overview-studio--${layoutPreset} section-entrance`}>
      <div className="overview-shell no-editor">
        <div className="overview-canvas">
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
                              <small className={item.change_24h >= 0 ? 'positive' : 'negative'}>
                                {formatPercent(item.change_24h)}
                              </small>
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
                          key={`overview-market-chart:${marketRenderableDetail.symbol}:${marketRenderableDetail.timeframe}`}
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
                      <strong>
                        {marketRenderableDetail ? formatNumber(marketRenderableDetail.candles.at(-1)?.close ?? 0) : '--'}
                      </strong>
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

          <div className="terminal-dock">
            <div className="terminal-dock__panel">
              <div className="console-panel console-panel--stream">
                <div className="terminal-block__head terminal-block__head--compact">
                  <div>
                    <span className="section-label">AI 实时日志</span>
                    <h3>当前动作流</h3>
                  </div>
                  <span className="chip chip--muted">
                    {overviewAiEvents.length + overviewQueuedRequests.length + (schedulerJobs.length ? 1 : 0)} 条
                  </span>
                </div>
                <div className="console-list">
                  {schedulerJobs.slice(0, 1).map((job) => {
                    const jobStrategyId = getAgentJobStrategyId(job)
                    const jobBacktestId = getAgentJobBacktestId(job)
                    const sourceBacktestId = getAgentJobSourceBacktestId(job)
                    const sourceReviewId = getAgentJobSourceReviewId(job)
                    const sourceProposalId = getAgentJobSourceProposalId(job)
                    const linkedReviewId = getAgentJobLinkedReviewId(job)
                    const contextMeta = agentJobContextMeta(job)
                    return (
                      <div key={job.id} className="console-row console-row--highlight">
                        <div className="console-row__main">
                          <strong>
                            <Bot size={13} />
                            任务 · {job.job_type}
                          </strong>
                          <p>{jobStatusLabel(job.status)} · 写回 {job.writeback_target}</p>
                          {contextMeta && <p>{contextMeta}</p>}
                        </div>
                        <div className="console-row__meta">
                          <span className="console-tag console-tag--warn">当前任务</span>
                          {linkedReviewId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenReviewInspector(linkedReviewId, jobStrategyId)}
                            >
                              查看结果
                            </button>
                          )}
                          {jobBacktestId && jobStrategyId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenBacktestDetail(jobBacktestId, jobStrategyId)}
                            >
                              打开回测
                            </button>
                          )}
                          {sourceBacktestId && jobStrategyId && sourceBacktestId !== jobBacktestId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenBacktestDetail(sourceBacktestId, jobStrategyId)}
                            >
                              来源回测
                            </button>
                          )}
                          {sourceReviewId && jobStrategyId && sourceReviewId !== linkedReviewId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenSourceReview(sourceReviewId, jobStrategyId)}
                            >
                              来源复盘
                            </button>
                          )}
                          {sourceProposalId && jobStrategyId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenStrategyProposal(sourceProposalId, jobStrategyId)}
                            >
                              来源提案
                            </button>
                          )}
                          {jobStrategyId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenStrategyActivity(jobStrategyId)}
                            >
                              打开策略
                            </button>
                          )}
                          <small>{formatTime(job.updated_at)}</small>
                        </div>
                      </div>
                    )
                  })}
                  {overviewAiEvents.map((event, index) => {
                    const meta = eventCategoryMeta(event.event_type)
                    const Icon = meta.icon
                    const linkedReviewId = getAuditLinkedReviewId(event.payload)
                    const auditJobId = getAuditJobId(event.payload)
                    const eventStrategyId = event.strategy_id ?? getAuditStrategyId(event.payload)
                    const backtestId = getAuditBacktestId(event.payload)
                    const sourceBacktestId = getAuditSourceBacktestId(event.payload)
                    const sourceReviewId = getAuditSourceReviewId(event.payload)
                    const sourceProposalId = getAuditSourceProposalId(event.payload)
                    const impactMeta = auditImpactMeta(event)
                    return (
                      <div
                        key={event.id}
                        className="console-row console-row--fade"
                        style={{ animationDelay: `${index * 32}ms` }}
                      >
                        <div className="console-row__main">
                          <strong>
                            <Icon size={13} />
                            {meta.label} · {event.event_type}
                          </strong>
                          <p>
                            {event.source === 'openclaw' ? 'OpenClaw' : '桌面控制端'} · {event.symbol ?? '系统'} ·{' '}
                            {event.strategy_id ?? '无策略'}
                          </p>
                          {impactMeta && <p>{impactMeta.detail}</p>}
                        </div>
                        <div className="console-row__meta">
                          <span className="console-tag">{event.severity}</span>
                          {auditJobId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenAiSchedulerJob(auditJobId)}
                            >
                              打开任务
                            </button>
                          )}
                          {linkedReviewId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenReviewInspector(linkedReviewId, eventStrategyId)}
                            >
                              查看结果
                            </button>
                          )}
                          {backtestId && eventStrategyId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenBacktestDetail(backtestId, eventStrategyId)}
                            >
                              打开回测
                            </button>
                          )}
                          {sourceBacktestId && eventStrategyId && sourceBacktestId !== backtestId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenBacktestDetail(sourceBacktestId, eventStrategyId)}
                            >
                              来源回测
                            </button>
                          )}
                          {sourceReviewId && eventStrategyId && sourceReviewId !== linkedReviewId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenSourceReview(sourceReviewId, eventStrategyId)}
                            >
                              来源复盘
                            </button>
                          )}
                          {sourceProposalId && eventStrategyId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenStrategyProposal(sourceProposalId, eventStrategyId)}
                            >
                              来源提案
                            </button>
                          )}
                          {!linkedReviewId && eventStrategyId && (
                            <button
                              type="button"
                              className="micro-action"
                              onClick={() => onOpenStrategyActivity(eventStrategyId)}
                            >
                              打开策略
                            </button>
                          )}
                          <small>{formatTime(event.occurred_at)}</small>
                        </div>
                      </div>
                    )
                  })}
                  {overviewQueuedRequests.map((item, index) => (
                    <div
                      key={item.id}
                      className="console-row console-row--fade"
                      style={{ animationDelay: `${(overviewAiEvents.length + index) * 32}ms` }}
                    >
                      <div className="console-row__main">
                        <strong>
                          <ClipboardList size={13} />
                          请求 · {item.type}
                        </strong>
                        <p>{String(item.payload.strategy_id ?? item.payload.symbol ?? '系统')} · {item.reason}</p>
                      </div>
                      <div className="console-row__meta">
                        <span className="console-tag console-tag--good">{item.status}</span>
                        <small>{formatTime(item.updated_at)}</small>
                      </div>
                    </div>
                  ))}
                  {!schedulerJobs.length && !overviewAiEvents.length && !overviewQueuedRequests.length && (
                    <div className="empty-state empty-state--inline">当前没有 AI 调度或待落实动作。</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
