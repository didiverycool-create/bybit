import type {
  AccountOverview,
  AccountLiveSnapshot,
  AiLiveSnapshot,
  AgentJob,
  AlertRecord,
  BacktestRun,
  BybitPublicStatus,
  BybitPrivateStatus,
  BybitTradeProbeResult,
  ChangeRequest,
  ControlSnapshot,
  ExecutionEvent,
  ExecutionPreview,
  ExchangePositionBulkCloseResult,
  GrafanaIntegrationStatus,
  LatestSchedulerCommand,
  MarketDetail,
  MarketLiveSnapshot,
  MarketRecentTrade,
  NewsEvent,
  OpenClawStatus,
  OpsLiveSnapshot,
  OrderRecord,
  PositionRecord,
  ReviewDocument,
  RuntimeWorkerStatus,
  RuntimeWorkerActionResult,
  SchedulerCommandResult,
  SchedulerCommandType,
  SchedulerPayload,
  ServiceHealth,
  SettingsPayload,
  StrategyExecutionResult,
  StrategyActivitySnapshot,
  StrategyProposalActionResult,
  StrategyLiveSnapshot,
  StrategyRuntimeSnapshot,
  StrategySummary,
  TradeRecord,
  WatchlistInstrument,
  WatchlistRemoveResult,
  WorkspacePreferences,
} from './types'

const API_BASE = (import.meta.env.VITE_CONTROL_API_BASE as string | undefined) ?? 'http://127.0.0.1:8787'
export const CONTROL_API_BASE = API_BASE

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    console.warn(`使用本地 fallback: ${path}`, error)
    return fallback
  }
}

async function fetchText(path: string, fallback: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}${path}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.text()
  } catch (error) {
    console.warn(`使用本地 fallback 文本: ${path}`, error)
    return fallback
  }
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as { detail?: string }
      throw new Error(parsed.detail || text || `HTTP ${response.status}`)
    } catch {
      throw new Error(text || `HTTP ${response.status}`)
    }
  }

  return (await response.json()) as T
}

async function deleteJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as { detail?: string }
      throw new Error(parsed.detail || text || `HTTP ${response.status}`)
    } catch {
      throw new Error(text || `HTTP ${response.status}`)
    }
  }

  return (await response.json()) as T
}

function buildReviewQueryString(options?: {
  strategyId?: string | null
  backtestId?: string | null
  periods?: string[]
}) {
  const query = new URLSearchParams()
  if (options?.strategyId) {
    query.set('strategy_id', options.strategyId)
  }
  if (options?.backtestId) {
    query.set('backtest_id', options.backtestId)
  }
  if (options?.periods?.length) {
    query.set('period', options.periods.join(','))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

function filterFallbackReviews(
  reviews: ReviewDocument[],
  options?: {
    strategyId?: string | null
    backtestId?: string | null
    periods?: string[]
  },
) {
  let next = [...reviews]

  if (options?.strategyId) {
    next = next.filter(
      (review) =>
        review.strategy_id === options.strategyId ||
        review.proposals.some((proposal) => proposal.strategy_id === options.strategyId),
    )
  }

  if (options?.periods?.length) {
    const allowed = new Set(options.periods)
    next = next.filter((review) => allowed.has(review.period))
  }

  if (options?.backtestId) {
    next = next.filter((review) => review.backtest_id === options.backtestId)
  }

  return next
}

export async function getServiceHealth(): Promise<ServiceHealth> {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) {
    throw new Error(`本地服务不可用: ${response.status}`)
  }
  return (await response.json()) as ServiceHealth
}

const fallbackLatestSchedulerCommand: LatestSchedulerCommand = {
  command: 'enter_manual_override',
  summary: '已请求人工接管当前任务。',
  impact_detail: '策略 sol-breakout-03',
  job_id: 'job-oc-001',
  strategy_id: 'sol-breakout-03',
  linked_review_id: null,
  backtest_id: null,
  source_change_request_id: null,
  source_backtest_id: null,
  source_review_id: null,
  source_proposal_id: null,
  occurred_at: new Date().toISOString(),
  severity: 'warning',
}

const fallbackSnapshot: ControlSnapshot = {
  account_metrics: [
    { label: '总权益', value: '1,286,400 USDT', delta: '+2.38%', tone: 'positive' },
    { label: '可用保证金', value: '482,000 USDT', delta: '-3.2%', tone: 'warning' },
    { label: '当前敞口', value: '39.6%', delta: '+4.1%', tone: 'neutral' },
  ],
  risk_metrics: [
    { label: '今日回撤', value: '-1.24%', tone: 'warning' },
    { label: '最大杠杆占用', value: '3.4x', tone: 'neutral' },
    { label: '风控拦截', value: '2 次', delta: '近 24h', tone: 'critical' },
  ],
  strategy_metrics: [
    { label: '运行中策略', value: '2', tone: 'positive' },
    { label: '模拟盘策略', value: '1', tone: 'neutral' },
    { label: '待发布提案', value: '3', tone: 'warning' },
  ],
  scheduler: {
    status: 'running',
    freeze_publish: false,
    current_job_id: 'job-oc-001',
    queue_depth: 3,
    last_heartbeat_at: new Date().toISOString(),
    openclaw_connected: true,
    current_mode: 'paper',
  },
  alerts_summary: { P0: 1, P1: 3, P2: 6 },
  pending_tasks: [],
  today_performance: {
    realized_pnl: '+28,460 USDT',
    unrealized_pnl: '+6,380 USDT',
    win_rate: '63.8%',
    best_strategy: 'BTC 趋势跟随',
  },
  latest_scheduler_command: fallbackLatestSchedulerCommand,
  execution_health: {
    runtime_worker_running: true,
    runtime_worker_issue: false,
    runtime_worker_stale: false,
    runtime_stale_seconds: 0,
    runtime_last_refresh_at: new Date().toISOString(),
    runtime_last_error: null,
    public_execution_channel_issue: false,
    public_execution_stale: false,
    public_execution_stale_seconds: 0,
    active_stop_loss_guards: 0,
    cooldowns: 0,
    auto_dispatch_blocked: 0,
    rejection_guards: 0,
    stale_order_guards: 0,
    drifts: 0,
    top_issue: null,
  },
}

const fallbackWatchlist: WatchlistInstrument[] = [
  {
    symbol: 'BTCUSDT',
    market: 'perp',
    last_price: 86125.4,
    change_24h: 3.82,
    volume_24h: 1389000000,
    signal: 'active',
    position_side: 'long',
    risk_level: 'medium',
    alert_enabled: true,
    alert_threshold_pct: 2.8,
  },
  {
    symbol: 'ETHUSDT',
    market: 'perp',
    last_price: 4832.6,
    change_24h: 2.17,
    volume_24h: 912000000,
    signal: 'watch',
    position_side: 'flat',
    risk_level: 'medium',
    alert_enabled: true,
    alert_threshold_pct: 2,
  },
]

function normalizeMarketTimeframe(timeframe: string) {
  const normalized = String(timeframe || '1h').trim().toLowerCase()
  return (
    {
      '15': '15m',
      '15m': '15m',
      '60': '1h',
      '1h': '1h',
      '240': '4h',
      '4h': '4h',
      d: '1d',
      '1d': '1d',
    }[normalized] ?? '1h'
  )
}

function buildFallbackCandles(base: number, timeframe = '1h') {
  const normalized = normalizeMarketTimeframe(timeframe)
  const stepHours =
    {
      '15m': 0.25,
      '1h': 1,
      '4h': 4,
      '1d': 24,
    }[normalized] ?? 1
  return Array.from({ length: 24 }, (_, index) => {
    const close = base + Math.sin(index / 3) * base * 0.008
    return {
      time: new Date(Date.now() - (24 - index) * stepHours * 3600_000).toISOString(),
      open: close * 0.992,
      high: close * 1.008,
      low: close * 0.986,
      close,
      volume: 1200 + index * 37,
    }
  })
}

function buildFallbackRecentTrades(base: number): MarketRecentTrade[] {
  return Array.from({ length: 10 }, (_, index) => {
    const side = index % 3 === 1 ? 'sell' : 'buy'
    const priceShift = (0.0008 + index * 0.00035) * base
    const price = side === 'buy' ? base + priceShift : base - priceShift
    const size = Number((0.35 + index * 0.22).toFixed(4))
    return {
      side,
      price: Number(price.toFixed(2)),
      size,
      value: Number((price * size).toFixed(2)),
      occurred_at: new Date(Date.now() - index * 90_000).toISOString(),
      is_block_trade: size >= 1.8,
    }
  })
}

const fallbackMarketDetails: Record<string, MarketDetail> = {
  BTCUSDT: {
    symbol: 'BTCUSDT',
    market: 'perp',
    timeframe: '1h',
    candles: buildFallbackCandles(86125.4),
    bids: Array.from({ length: 6 }, (_, index) => ({
      price: 86125.4 - index * 2.5,
      size: 8 + index * 1.6,
      total: 8 + index * 4,
    })),
    asks: Array.from({ length: 6 }, (_, index) => ({
      price: 86125.4 + index * 2.5,
      size: 7 + index * 1.3,
      total: 7 + index * 3.8,
    })),
    recent_public_trades: buildFallbackRecentTrades(86125.4),
    headline: 'BTC 仍处于趋势策略的主跟踪通道',
    stats: {
      '24h振幅': '6.95%',
      资金费率: '0.012%',
      持仓偏向: '多头占优',
      风险热度: '中',
    },
    source: 'mock',
    updated_at: new Date().toISOString(),
  },
  ETHUSDT: {
    symbol: 'ETHUSDT',
    market: 'perp',
    timeframe: '1h',
    candles: buildFallbackCandles(4832.6),
    bids: Array.from({ length: 6 }, (_, index) => ({
      price: 4832.6 - index * 0.8,
      size: 12 + index * 2.2,
      total: 12 + index * 5.5,
    })),
    asks: Array.from({ length: 6 }, (_, index) => ({
      price: 4832.6 + index * 0.8,
      size: 10 + index * 1.8,
      total: 10 + index * 4.9,
    })),
    recent_public_trades: buildFallbackRecentTrades(4832.6),
    headline: 'ETH 当前用于均值回归参数验证',
    stats: {
      '24h振幅': '5.42%',
      资金费率: '0.009%',
      持仓偏向: '中性',
      风险热度: '中',
    },
    source: 'mock',
    updated_at: new Date().toISOString(),
  },
}

function buildFallbackMarketDetail(symbol: string, timeframe = '1h'): MarketDetail {
  const normalized = normalizeMarketTimeframe(timeframe)
  const detail = fallbackMarketDetails[symbol] ?? fallbackMarketDetails.BTCUSDT
  const latestClose = detail.candles.at(-1)?.close ?? detail.candles[0]?.close ?? 1
  return {
    ...detail,
    timeframe: normalized,
    candles: buildFallbackCandles(latestClose, normalized),
    recent_public_trades: buildFallbackRecentTrades(latestClose),
  }
}

const fallbackMarketLiveSnapshot = (symbol: string, timeframe = '1h'): MarketLiveSnapshot => ({
  selected_symbol: symbol,
  watchlist: fallbackWatchlist,
  detail: buildFallbackMarketDetail(symbol, timeframe),
  generated_at: new Date().toISOString(),
})

const fallbackStrategies: StrategySummary[] = [
  {
    id: 'trend-btc-01',
    name: 'BTC 趋势跟随',
    category: 'template',
    status: 'running',
    symbols: ['BTCUSDT'],
    mode: 'live',
    version: 'v1.8.4',
    pnl_7d: '+12.6%',
    max_drawdown: '-3.4%',
    risk_budget: '18%',
    description: '4h 趋势过滤 + 1h 进场确认。',
    parameters: [
      { key: 'fast_ma', label: '快线周期', value: 21 },
      { key: 'slow_ma', label: '慢线周期', value: 55 },
    ],
  },
]

const fallbackBacktests: BacktestRun[] = [
  {
    id: 'bt-001',
    strategy_id: 'trend-btc-01',
    strategy_name: 'BTC 趋势跟随',
    source_change_request_id: null,
    source_backtest_id: null,
    source_review_id: null,
    source_proposal_id: null,
    trigger_reason: 'manual_create',
    status: 'completed',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    symbol_scope: ['BTCUSDT'],
    timeframe: '1h',
    data_range: '2025-12-01 ~ 2026-03-29',
    data_granularity: 'kline+trade',
    fee_model: 'bybit-uta-live-fee',
    slippage_model: 'volatility-aware-v2',
    parameter_snapshot: { fast_ma: 21, slow_ma: 55 },
    metrics: {
      annual_return: '+48.2%',
      max_drawdown: '-8.4%',
      sharpe: '1.92',
      win_rate: '58.6%',
      pnl: '+152,000 USDT',
      trades: 134,
    },
    reference_only: false,
    sample_quality: 'sufficient',
    history_source: 'exchange_history',
    history_source_reason: 'none',
    history_source_detail: null,
    history_source_recommended_data_range: null,
    history_source_recommended_timeframe: null,
    history_source_recommended_action: null,
    decision_readiness: 'ready',
    decision_readiness_detail: '当前样本来源、样本量与窗口覆盖已达到最小门槛，可继续结合策略上下文做调参与人工复核。',
    decision_recommended_data_range: null,
    decision_recommended_timeframe: null,
    decision_readiness_action: null,
    requested_candle_estimate: 0,
    requested_candle_limit: 0,
    requested_range_start: null,
    requested_range_end: null,
    retrieved_window_completion_pct: 0,
    used_window_completion_pct: 0,
    retrieved_candle_count: 0,
    used_candle_count: 0,
    retrieved_range_start: null,
    retrieved_range_end: null,
    used_range_start: null,
    used_range_end: null,
    history_truncated: false,
    history_gap_reason: 'none',
    full_window_recommended_data_range: null,
    full_window_recommended_timeframe: null,
    full_window_recommended_action: null,
    notes: 'Fallback 回测结果。',
  },
]

const fallbackScheduler: SchedulerPayload = {
  scheduler: fallbackSnapshot.scheduler,
  jobs: [
    {
      id: 'job-oc-001',
      job_type: 'generate_daily_review',
      context: { focus_symbols: ['BTCUSDT', 'ETHUSDT'] },
      allowed_actions: ['review', 'summarize', 'backtest_request'],
      timeout: 180,
      idempotency_key: 'job-oc-daily-review',
      writeback_target: 'ai_review',
      status: 'running',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      result_summary: null,
    },
  ],
  change_requests: [
    {
      id: 'cr-001',
      type: 'strategy.parameter.update',
      payload: { strategy_id: 'trend-btc-01', stop_loss_pct: 1.2 },
      requested_by: 'desktop_operator',
      source_review_id: null,
      source_proposal_id: null,
      trigger_reason: 'manual_create',
      target_mode: 'paper',
      priority: 'high',
      status: 'queued',
      correlation_id: 'corr-001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      summary: '更新 BTC 趋势策略止损参数',
    },
  ],
  latest_scheduler_command: fallbackLatestSchedulerCommand,
}

const fallbackNews: NewsEvent[] = [
  {
    id: 'news-001',
    source: 'Trading Economics',
    title: '核心通胀预期回升',
    summary: '风险资产短线波动放大，建议收紧新闻冷却阈值。',
    symbols: ['BTCUSDT', 'ETHUSDT'],
    impact_score: 82,
    published_at: new Date().toISOString(),
    category: 'macro',
    related_alert_ids: [],
  },
]

const fallbackAlerts: AlertRecord[] = [
  {
    id: 'alert-001',
    severity: 'P0',
    symbol: 'SOLUSDT',
    title: '策略进入人工接管',
    description: 'OpenClaw 请求暂停自动发布。',
    triggered_at: new Date().toISOString(),
    related_news_id: null,
    suggested_action: '进入人工接管并冻结自动发布',
    acknowledged: false,
    source_type: 'system',
    rule_id: null,
    rule_key: 'manual-override:SOLUSDT',
    trigger_value: null,
    threshold_value: null,
  },
]

const fallbackTrades: TradeRecord[] = [
  {
    id: 'trade-001',
    symbol: 'BTCUSDT',
    market: 'perp',
    mode: 'live',
    origin: 'strategy',
    side: 'buy',
    quantity: 1.6,
    price: 85420.5,
    pnl: '+8,420 USDT',
    strategy_id: 'trend-btc-01',
    created_at: new Date().toISOString(),
    status: 'filled',
  },
]

const fallbackAccountOverview: AccountOverview = {
  source: 'mock',
  mode: 'paper',
  account_type: 'UNIFIED',
  total_equity: '1,286,400 USDT',
  total_wallet_balance: '1,102,000 USDT',
  total_available_balance: '482,000 USDT',
  unrealised_pnl: '+6,380 USDT',
  positions_count: 2,
  open_orders_count: 2,
  top_holdings: [
    { coin: 'USDT', wallet_balance: '482,000', usd_value: '482,000 USDT', available_balance: '482,000' },
    { coin: 'BTC', wallet_balance: '9.8400', usd_value: '651,600 USDT', available_balance: '6.2100' },
    { coin: 'SOL', wallet_balance: '1,890.00', usd_value: '152,800 USDT', available_balance: '1,240.00' },
  ],
  updated_at: new Date().toISOString(),
}

const fallbackPositions: PositionRecord[] = [
  {
    source: 'mock',
    symbol: 'BTCUSDT',
    market: 'perp',
    side: 'long',
    size: '1.60',
    avg_price: '65,420.50',
    mark_price: '66,241.30',
    value: '105,986.08 USDT',
    leverage: '2.0x',
    unrealised_pnl: '+1,313.28 USDT',
    updated_at: new Date().toISOString(),
  },
  {
    source: 'mock',
    symbol: 'SOLUSDT',
    market: 'spot',
    side: 'long',
    size: '1,890.00',
    avg_price: '79.42',
    mark_price: '81.27',
    value: '153,600.30 USDT',
    leverage: '1.0x',
    unrealised_pnl: '+3,496.50 USDT',
    updated_at: new Date().toISOString(),
  },
]

const fallbackOrders: OrderRecord[] = [
  {
    source: 'mock',
    origin: 'manual',
    order_id: 'ord-mock-001',
    symbol: 'ETHUSDT',
    market: 'perp',
    side: 'buy',
    order_type: 'Limit',
    qty: '12.00',
    price: '1,982.50',
    status: 'New',
    created_at: new Date().toISOString(),
  },
  {
    source: 'mock',
    origin: 'manual',
    order_id: 'ord-mock-002',
    symbol: 'BTCUSDT',
    market: 'perp',
    side: 'sell',
    order_type: 'Limit',
    qty: '0.80',
    price: '66,880.00',
    status: 'PartiallyFilled',
    created_at: new Date().toISOString(),
  },
]

const fallbackReviews: ReviewDocument[] = [
  {
    id: 'review-001',
    period: 'daily',
    title: '日度 AI 复盘',
    summary: 'ETH 需压缩止损，BTC 可继续保持 Live 发布。',
    highlights: ['BTC 趋势策略贡献了主要收益。'],
    risks: ['SOL 影子策略存在过度加仓倾向。'],
    proposals: [
      {
        id: 'prop-001',
        proposal_type: 'param_update',
        strategy_id: 'trend-btc-01',
        title: '压缩 BTC 风险预算',
        description: '建议在高波动时段将单笔风险从 1.2% 压缩到 1.0%。',
        created_at: new Date().toISOString(),
        status: 'pending',
        expected_impact: '降低夜盘回撤。',
        payload: {
          target_mode: 'live',
          parameter_patch: { risk_per_trade: 1.0 },
        },
      },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'review-002',
    period: 'strategy_issue',
    strategy_id: 'trend-btc-01',
    title: '策略问题跟踪 · BTC 趋势跟随',
    summary: '真实执行线程恢复后，已重新接管 BTC 趋势策略；旧的执行阻断提醒已自动收起。',
    highlights: ['运行线程已恢复，策略信号重新进入自动评估。'],
    risks: ['若再次出现连续拒单，系统仍会进入冷却并暂停自动执行。'],
    proposals: [],
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
  },
]

const fallbackStrategyRuntime: StrategyRuntimeSnapshot[] = [
  {
    strategy_id: 'trend-btc-01',
    strategy_name: 'BTC 趋势跟随',
    symbol: 'BTCUSDT',
    market: 'perp',
    mode: 'live',
    runtime_status: 'running',
    signal: 'long',
    confidence: 72,
    last_price: 86125.4,
    reference_price: 85410.2,
    change_24h: 3.82,
    note: '快线持续站上慢线，趋势信号保持。',
    next_action: '继续监控真实执行层风控，不在前端直接下单。',
    last_evaluated_at: new Date().toISOString(),
    last_trade_id: 'trade-001',
    last_trade_at: new Date().toISOString(),
  },
  {
    strategy_id: 'eth-revert-02',
    strategy_name: 'ETH 均值回归',
    symbol: 'ETHUSDT',
    market: 'perp',
    mode: 'paper',
    runtime_status: 'paper_only',
    signal: 'watch',
    confidence: 41,
    last_price: 4832.6,
    reference_price: 4788.4,
    change_24h: 2.17,
    note: '偏离尚未达到新的回归入场阈值。',
    next_action: '继续等待更明显的偏离或收敛。',
    last_evaluated_at: new Date().toISOString(),
    last_trade_id: 'trade-003',
    last_trade_at: new Date().toISOString(),
  },
]

const fallbackStrategyExecutionPreview: ExecutionPreview = {
  symbol: 'BTCUSDT',
  market: 'perp',
  mode: 'paper',
  side: 'buy',
  origin: 'strategy',
  strategy_id: 'trend-btc-01',
  quantity: 0.8,
  price: 86125.4,
  notional: '68,900.32 USDT',
  action: '等待当前模式的策略执行预检',
  allowed: false,
  blocked_reason: '当前本地控制服务不可用，已回退到前端默认策略预检。',
  warnings: ['服务恢复后会自动重新加载当前策略的执行预检。'],
  current_position_side: 'flat',
  current_position_size: '--',
  current_avg_price: '--',
  projected_position_side: 'long',
  projected_position_size: '0.8',
  projected_avg_price: '86,125.4',
  available_balance_before: '--',
  available_balance_after: '--',
  estimated_realized_pnl: '--',
  generated_at: new Date().toISOString(),
}

const fallbackAudit: ExecutionEvent[] = [
  {
    id: 'evt-001',
    event_type: 'scheduler.command',
    severity: 'warning',
    source: 'desktop',
    symbol: 'SOLUSDT',
    strategy_id: 'sol-breakout-03',
    payload: { command: 'enter_manual_override' },
    trace_id: 'trace-001',
    occurred_at: new Date().toISOString(),
  },
]

const fallbackSettings: SettingsPayload = {
  bybit_web_entry: 'https://www.bybit-global.com/',
  api_base_url: 'https://api.bybit.com',
  openclaw_gateway_url: 'ws://127.0.0.1:18789',
  openclaw_agent: 'codex',
  default_mode: 'paper',
  notification_channels: ['desktop', 'telegram', 'email'],
  notification_quiet_hours_enabled: false,
  notification_quiet_hours_start: '23:00',
  notification_quiet_hours_end: '08:00',
  product_language: 'zh-CN',
  grafana_base_url: null,
  grafana_dashboard_uid: null,
  grafana_org_id: 1,
  grafana_theme: 'dark',
}

const fallbackGrafanaStatus: GrafanaIntegrationStatus = {
  configured: false,
  base_url: null,
  dashboard_uid: null,
  org_id: 1,
  theme: 'dark',
  metrics_path: '/metrics',
  dashboard_url: null,
  recommended_scope: 'ops_monitoring_only',
  note: 'Grafana 更适合服务状态、AI 调度、风控和回测吞吐监控；主 K 线继续保留本地图表。',
}

const fallbackPrometheusMetrics = `# HELP bybit_control_watchlist_total Number of instruments in watchlist
# TYPE bybit_control_watchlist_total gauge
bybit_control_watchlist_total 4
# HELP bybit_control_scheduler_queue_depth Number of queued AI jobs
# TYPE bybit_control_scheduler_queue_depth gauge
bybit_control_scheduler_queue_depth 3
# HELP bybit_control_openclaw_connected Whether OpenClaw is reachable
# TYPE bybit_control_openclaw_connected gauge
bybit_control_openclaw_connected 1
`

const fallbackAiLive: AiLiveSnapshot = {
  ...fallbackScheduler,
  latest_scheduler_command: fallbackLatestSchedulerCommand,
  activity_feed: fallbackAudit,
  generated_at: new Date().toISOString(),
}

const fallbackOpsLive: OpsLiveSnapshot = {
  summary: {
    pending_alerts: fallbackAlerts.filter((item) => !item.acknowledged).length,
    p0_alerts: fallbackAlerts.filter((item) => item.severity === 'P0' && !item.acknowledged).length,
    recent_trades: fallbackTrades.length,
    manual_trades: fallbackTrades.filter((item) => item.origin === 'manual').length,
    strategy_trades: fallbackTrades.filter((item) => item.origin === 'strategy').length,
    audit_warnings: fallbackAudit.filter((item) => item.severity === 'warning').length,
    audit_critical: fallbackAudit.filter((item) => item.severity === 'critical').length,
    latest_event_type: fallbackAudit[0]?.event_type ?? null,
  },
  alerts: fallbackAlerts,
  trades: fallbackTrades,
  audit_events: fallbackAudit,
  latest_scheduler_command: fallbackLatestSchedulerCommand,
  generated_at: new Date().toISOString(),
}

const fallbackOpenClawStatus: OpenClawStatus = {
  configured: true,
  config_path: '~/.openclaw/openclaw.json',
  config_exists: false,
  command_available: false,
  gateway_url: 'ws://127.0.0.1:18789',
  auth_mode: 'token',
  default_agent: 'codex',
  heartbeat: '30m',
  reachable: false,
}

const fallbackBybitPrivateStatus: BybitPrivateStatus = {
  configured: false,
  can_query_private: false,
  source: 'none',
  config_path: '~/.bybit-control/private-api.json',
  config_exists: false,
  example_config_path: '/Users/leo/Desktop/Work/bybit/services/control-api/private-api.example.json',
  api_base_url: 'https://api.bybit.com',
  account_type: 'UNIFIED',
  mode: 'live',
  key_hint: null,
  last_error: '未检测到 Bybit 私有 API 配置，当前账户视图使用 mock 回退。',
  realtime_enabled: false,
  realtime_connected: false,
  realtime_authenticated: false,
  realtime_last_message_at: null,
  realtime_stale: false,
  realtime_stale_seconds: 0,
  realtime_last_error: null,
  realtime_recommended_action: null,
  usdt_balance_diagnostics: [],
  updated_at: new Date().toISOString(),
}

const fallbackBybitPublicStatus: BybitPublicStatus = {
  enabled: false,
  connected_spot: false,
  connected_linear: false,
  spot_stale: false,
  spot_stale_seconds: 0,
  linear_stale: false,
  linear_stale_seconds: 0,
  last_message_at_spot: null,
  last_message_at_linear: null,
  last_message_at: null,
  last_error: null,
  rest_reachable: null,
  rest_last_error: null,
  rest_tested_at: null,
  recommended_action: null,
  watched_symbol_diagnostics: [],
  updated_at: new Date().toISOString(),
}

const fallbackWorkspacePreferences: WorkspacePreferences = {
  active_section: 'overview',
  layout_preset: 'balanced',
  selected_mode: 'paper',
  selected_symbol: 'BTCUSDT',
  selected_market_timeframe: '1h',
  selected_strategy_id: 'trend-btc-01',
  selected_backtest_id: null,
  backtest_filter: 'selected',
  replay_tracking_scope: 'all',
  alert_severity_filter: 'all',
  alert_status_filter: 'pending',
  alert_scope_filter: 'all',
  trade_mode_filter: 'all',
  trade_origin_filter: 'all',
  trade_scope_filter: 'all',
  audit_severity_filter: 'all',
  audit_source_filter: 'all',
  audit_scope_filter: 'all',
  audit_search: '',
  overview_card_order: ['ai_center', 'strategy_watch', 'account_center'],
  overview_visible_cards: ['ai_center', 'strategy_watch', 'account_center'],
  overview_collapsed_cards: [],
  updated_at: new Date().toISOString(),
}

const fallbackAccountLive: AccountLiveSnapshot = {
  overview: fallbackAccountOverview,
  positions: fallbackPositions,
  orders: fallbackOrders,
  order_history: fallbackOrders,
  generated_at: new Date().toISOString(),
}

const fallbackRuntimeWorkerStatus: RuntimeWorkerStatus = {
  running: true,
  started_once: true,
  issue: false,
  stale: false,
  stopped: false,
  stale_seconds: 0,
  last_refresh_at: new Date().toISOString(),
  last_error: null,
  top_issue: null,
  recommended_action: null,
  generated_at: new Date().toISOString(),
}

const fallbackStrategyActivity = (strategyId: string): StrategyActivitySnapshot => ({
  strategy_id: strategyId,
  strategy_name: fallbackStrategies.find((item) => item.id === strategyId)?.name ?? '策略活动',
  symbol: fallbackStrategies.find((item) => item.id === strategyId)?.symbols?.[0] ?? 'BTCUSDT',
  market: 'perp',
  mode: fallbackStrategies.find((item) => item.id === strategyId)?.mode ?? 'paper',
  runtime: fallbackStrategyRuntime.find((item) => item.strategy_id === strategyId) ?? null,
  active_orders: fallbackOrders.filter((item) => item.origin === 'strategy').slice(0, 6),
  recent_orders: fallbackOrders.filter((item) => item.origin === 'strategy').slice(0, 8),
  recent_trades: fallbackTrades.filter((item) => item.origin === 'strategy').slice(0, 8),
  recent_alerts: fallbackAlerts.filter((item) => item.source_type === 'system').slice(0, 6),
  recent_audit_events: fallbackAuditEvents
    .filter((item) => item.strategy_id === strategyId || item.event_type.startsWith('strategy.'))
    .slice(0, 12),
  generated_at: new Date().toISOString(),
})

export const api = {
  getServiceHealth,
  getControlSnapshot: () => fetchJson('/api/control/snapshot', fallbackSnapshot),
  getRuntimeWorkerStatus: () =>
    fetchJson('/api/runtime/strategy-worker/status', fallbackRuntimeWorkerStatus),
  restartStrategyRuntimeWorker: () =>
    postJson<RuntimeWorkerActionResult>('/api/runtime/strategy-worker/restart', {
      requested_by: 'desktop_operator',
      reason: '桌面端恢复策略运行线程',
    }),
  getWatchlist: () => fetchJson('/api/market/watchlist', fallbackWatchlist),
  addWatchlistItem: (payload: { symbol: string; market: 'spot' | 'perp'; requested_by?: string }) =>
    postJson<WatchlistInstrument>('/api/market/watchlist', payload),
  removeWatchlistItem: (symbol: string) =>
    deleteJson<WatchlistRemoveResult>(
      `/api/market/watchlist/${encodeURIComponent(symbol)}?requested_by=desktop_operator`,
    ),
  getMarketDetail: (symbol: string, timeframe = '1h') =>
    fetchJson(
      `/api/market/${symbol}?timeframe=${encodeURIComponent(timeframe)}`,
      buildFallbackMarketDetail(symbol, timeframe),
    ),
  getMarketLiveSnapshot: (symbol: string, timeframe = '1h') =>
    fetchJson(
      `/api/market/live?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
      fallbackMarketLiveSnapshot(symbol, timeframe),
    ),
  getStrategies: () => fetchJson('/api/strategies', fallbackStrategies),
  getStrategyRuntime: () => fetchJson('/api/strategies/live', fallbackStrategyRuntime),
  getStrategyActivity: (strategyId: string) =>
    fetchJson(`/api/strategies/${encodeURIComponent(strategyId)}/activity`, fallbackStrategyActivity(strategyId)),
  getStrategyExecutionPreview: async (strategyId: string, mode?: 'paper' | 'demo' | 'live') => {
    const path = `/api/strategies/${encodeURIComponent(strategyId)}/execution-preview${mode ? `?mode=${encodeURIComponent(mode)}` : ''}`
    try {
      const response = await fetch(`${API_BASE}${path}`)
      if (!response.ok) {
        let detail = '当前策略执行预检暂不可用。'
        try {
          const payload = (await response.json()) as { detail?: string }
          if (typeof payload.detail === 'string' && payload.detail.trim()) {
            detail = payload.detail
          }
        } catch {
          // ignore
        }
        return {
          ...fallbackStrategyExecutionPreview,
          mode: mode ?? fallbackStrategyExecutionPreview.mode,
          strategy_id: strategyId,
          blocked_reason: detail,
          warnings: [detail],
        }
      }
      return (await response.json()) as ExecutionPreview
    } catch (error) {
      console.warn(`使用本地 fallback: ${path}`, error)
      return {
        ...fallbackStrategyExecutionPreview,
        mode: mode ?? fallbackStrategyExecutionPreview.mode,
        strategy_id: strategyId,
      }
    }
  },
  getStrategyLiveSnapshot: () =>
    fetchJson<StrategyLiveSnapshot>('/api/strategies/stream?once=true', {
      items: fallbackStrategyRuntime,
      generated_at: new Date().toISOString(),
    }),
  getBacktests: () => fetchJson('/api/backtests', fallbackBacktests),
  getChangeRequests: () => fetchJson('/api/change-requests', fallbackScheduler.change_requests),
  getScheduler: () => fetchJson('/api/ai/scheduler', fallbackScheduler),
  getAiLiveSnapshot: () => fetchJson('/api/ai/live', fallbackAiLive),
  getOpsLiveSnapshot: () => fetchJson('/api/ops/live', fallbackOpsLive),
  getNews: () => fetchJson('/api/news', fallbackNews),
  getAlerts: () => fetchJson('/api/alerts', fallbackAlerts),
  acknowledgeAlert: (alertId: string, acknowledged: boolean) =>
    postJson<AlertRecord>(`/api/alerts/${alertId}/acknowledge`, {
      acknowledged,
      requested_by: 'desktop_operator',
    }),
  getAccountLiveSnapshot: () => fetchJson('/api/account/live', fallbackAccountLive),
  getAccountOverview: () => fetchJson('/api/account/overview', fallbackAccountOverview),
  getAccountPositions: () => fetchJson('/api/account/positions', fallbackPositions),
  getAccountOrders: () => fetchJson('/api/account/orders', fallbackOrders),
  getAccountOrderHistory: () => fetchJson('/api/account/order-history', fallbackOrders),
  getTrades: () => fetchJson('/api/trades', fallbackTrades),
  getReviews: (options?: { strategyId?: string | null; backtestId?: string | null; periods?: string[] }) =>
    fetchJson(`/api/ai/reviews${buildReviewQueryString(options)}`, filterFallbackReviews(fallbackReviews, options)),
  getAuditEvents: () => fetchJson('/api/audit/events', fallbackAudit),
  getSettings: () => fetchJson('/api/settings', fallbackSettings),
  updateSettings: (payload: {
    bybit_web_entry?: string
    api_base_url?: string
    default_mode?: 'paper' | 'demo' | 'live'
    notification_channels?: string[]
    notification_quiet_hours_enabled?: boolean
    notification_quiet_hours_start?: string
    notification_quiet_hours_end?: string
    product_language?: string
    grafana_base_url?: string | null
    grafana_dashboard_uid?: string | null
    grafana_org_id?: number
    grafana_theme?: 'dark' | 'light'
  }) => postJson<SettingsPayload>('/api/settings', payload),
  getGrafanaStatus: () => fetchJson('/api/integrations/grafana', fallbackGrafanaStatus),
  getPrometheusMetrics: () => fetchText('/metrics', fallbackPrometheusMetrics),
  getWorkspacePreferences: () => fetchJson('/api/workspace/preferences', fallbackWorkspacePreferences),
  getOpenClawStatus: () => fetchJson('/api/integrations/openclaw', fallbackOpenClawStatus),
  getBybitPrivateStatus: () => fetchJson('/api/integrations/bybit-private', fallbackBybitPrivateStatus),
  getBybitPublicStatus: () => fetchJson('/api/integrations/bybit-public', fallbackBybitPublicStatus),
  probeBybitTradeRoute: () =>
    postJson<BybitTradeProbeResult>('/api/integrations/bybit-private/probe-trade', {}),
  createChangeRequest: (payload: {
    type: string
    payload: Record<string, unknown>
    requested_by?: string
    target_mode?: 'paper' | 'demo' | 'live'
    priority?: 'low' | 'normal' | 'high' | 'critical'
    summary: string
  }) => postJson<ChangeRequest>('/api/change-requests', payload),
  createBacktest: (payload: {
    strategy_id: string
    data_range: string
    timeframe: string
    source_change_request_id?: string | null
    source_backtest_id?: string | null
    source_review_id?: string | null
    source_proposal_id?: string | null
    trigger_reason?: string | null
  }) =>
    postJson<BacktestRun>('/api/backtests', payload),
  executeStrategySignal: (
    strategyId: string,
    payload?: { requested_by?: string; note?: string; mode?: 'paper' | 'demo' | 'live' },
  ) =>
    postJson<StrategyExecutionResult>(`/api/strategies/${encodeURIComponent(strategyId)}/execute`, {
      requested_by: payload?.requested_by ?? 'desktop_operator',
      note: payload?.note ?? null,
      mode: payload?.mode ?? null,
    }),
  previewExecution: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    mode: 'paper' | 'demo' | 'live'
    side: 'buy' | 'sell'
    quantity: number
    price: number
    origin?: 'manual' | 'strategy'
    strategy_id?: string
    note?: string
    exclude_order_id?: string
  }) => postJson<ExecutionPreview>('/api/trades/preview', payload),
  createManualTrade: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    mode: 'paper' | 'demo' | 'live'
    side: 'buy' | 'sell'
    quantity: number
    price: number
    note?: string
  }) => postJson<TradeRecord>('/api/trades/manual', payload),
  createExchangeOrder: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    mode: 'paper' | 'demo' | 'live'
    side: 'buy' | 'sell'
    quantity: number
    price: number
    note?: string
  }) => postJson<OrderRecord>('/api/orders/exchange', payload),
  replaceExchangeOrder: (
    orderId: string,
    payload: { quantity: number; price: number; requested_by?: string },
  ) =>
    postJson<OrderRecord>(`/api/orders/exchange/${encodeURIComponent(orderId)}/replace`, {
      requested_by: payload.requested_by ?? 'desktop_operator',
      quantity: payload.quantity,
      price: payload.price,
    }),
  cancelExchangeOrder: (orderId: string, requested_by = 'desktop_operator') =>
    postJson<OrderRecord>(`/api/orders/exchange/${encodeURIComponent(orderId)}/cancel`, { requested_by }),
  cancelAllExchangeOrders: (requested_by = 'desktop_operator') =>
    postJson<{
      cancelled_count: number
      cancelled_order_ids: string[]
      requested_by: string
      updated_at: string
    }>('/api/orders/exchange/cancel-all', { requested_by }),
  createPaperOrder: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    mode: 'paper' | 'demo' | 'live'
    side: 'buy' | 'sell'
    quantity: number
    price: number
    note?: string
  }) => postJson<OrderRecord>('/api/account/paper/orders', payload),
  cancelPaperOrder: (orderId: string, requested_by = 'desktop_operator') =>
    postJson<OrderRecord>(`/api/account/paper/orders/${encodeURIComponent(orderId)}/cancel`, { requested_by }),
  cancelAllPaperOrders: (requested_by = 'desktop_operator') =>
    postJson<{
      cancelled_count: number
      cancelled_order_ids: string[]
      requested_by: string
      updated_at: string
    }>('/api/account/paper/orders/cancel-all', { requested_by }),
  replacePaperOrder: (
    orderId: string,
    payload: { quantity: number; price: number; requested_by?: string },
  ) =>
    postJson<OrderRecord>(`/api/account/paper/orders/${encodeURIComponent(orderId)}/replace`, {
      requested_by: payload.requested_by ?? 'desktop_operator',
      quantity: payload.quantity,
      price: payload.price,
    }),
  closePaperPosition: (symbol: string, requested_by = 'desktop_operator') =>
    postJson<TradeRecord>(`/api/account/paper/positions/${symbol}/close`, { requested_by }),
  closeAllPaperPositions: (requested_by = 'desktop_operator') =>
    postJson<{
      closed_count: number
      trade_ids: string[]
      requested_by: string
      updated_at: string
    }>('/api/account/paper/positions/close-all', { requested_by }),
  closeExchangePosition: (symbol: string, requested_by = 'desktop_operator') =>
    postJson<OrderRecord>(`/api/account/exchange/positions/${symbol}/close`, { requested_by }),
  closeAllExchangePositions: (requested_by = 'desktop_operator') =>
    postJson<ExchangePositionBulkCloseResult>('/api/account/exchange/positions/close-all', { requested_by }),
  sendSchedulerCommand: (payload: {
    command: SchedulerCommandType
    job_id?: string
    requested_by?: string
    reason?: string
  }) =>
    postJson<SchedulerCommandResult>(
      '/api/ai/scheduler/commands',
      payload,
    ),
  updateWorkspacePreferences: (payload: {
    active_section: string
    layout_preset: 'balanced' | 'focus' | 'dense'
    selected_mode: 'paper' | 'demo' | 'live'
    selected_symbol: string
    selected_market_timeframe: '15m' | '1h' | '4h' | '1d'
    selected_strategy_id?: string | null
    selected_backtest_id?: string | null
    backtest_filter: 'selected' | 'all'
    replay_tracking_scope: 'all' | 'selected'
    alert_severity_filter: 'all' | 'P0' | 'P1' | 'P2'
    alert_status_filter: 'all' | 'pending' | 'acknowledged'
    alert_scope_filter: 'all' | 'selected'
    trade_mode_filter: 'all' | 'paper' | 'demo' | 'live'
    trade_origin_filter: 'all' | 'manual' | 'strategy' | 'exchange'
    trade_scope_filter: 'all' | 'selected'
    audit_severity_filter: 'all' | 'info' | 'warning' | 'error' | 'critical'
    audit_source_filter: string
    audit_scope_filter: 'all' | 'selected'
    audit_search: string
    overview_card_order: string[]
    overview_visible_cards: string[]
    overview_collapsed_cards: string[]
  }) => postJson<WorkspacePreferences>('/api/workspace/preferences', payload),
  createAgentJob: (payload: {
    job_type: string
    context: Record<string, unknown>
    allowed_actions?: string[]
    timeout?: number
    idempotency_key: string
    writeback_target?: string
  }) => postJson<AgentJob>('/api/ai/jobs', payload),
  createStrategyTrackingReview: (
    strategyId: string,
    payload: {
      review_kind: 'issue' | 'change'
      summary: string
      detail?: string
      requested_by?: string
      request_key?: string
    },
  ) => postJson<AgentJob>(`/api/strategies/${encodeURIComponent(strategyId)}/review`, payload),
  retryAgentJob: (jobId: string, requested_by = 'desktop_operator') =>
    postJson<AgentJob>(`/api/ai/jobs/${encodeURIComponent(jobId)}/retry`, {
      requested_by,
    }),
  applyStrategyProposalAction: (proposalId: string, action: 'accept' | 'reject') =>
    postJson<StrategyProposalActionResult>(`/api/ai/proposals/${proposalId}/action`, {
      action,
      requested_by: 'desktop_operator',
    }),
}
