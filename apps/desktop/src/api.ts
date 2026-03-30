import type {
  AccountOverview,
  AgentJob,
  AlertRecord,
  BacktestRun,
  BybitPrivateStatus,
  BybitTradeProbeResult,
  ChangeRequest,
  ControlSnapshot,
  ExecutionEvent,
  MarketDetail,
  NewsEvent,
  OpenClawStatus,
  OrderRecord,
  PositionRecord,
  ReviewDocument,
  SchedulerCommandType,
  SchedulerPayload,
  ServiceHealth,
  SettingsPayload,
  StrategySummary,
  TradeRecord,
  WatchlistInstrument,
  WorkspacePreferences,
} from './types'

const API_BASE = (import.meta.env.VITE_CONTROL_API_BASE as string | undefined) ?? 'http://127.0.0.1:8787'

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

export async function getServiceHealth(): Promise<ServiceHealth> {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) {
    throw new Error(`本地服务不可用: ${response.status}`)
  }
  return (await response.json()) as ServiceHealth
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
  },
]

function buildFallbackCandles(base: number) {
  return Array.from({ length: 24 }, (_, index) => {
    const close = base + Math.sin(index / 3) * base * 0.008
    return {
      time: new Date(Date.now() - (24 - index) * 3600_000).toISOString(),
      open: close * 0.992,
      high: close * 1.008,
      low: close * 0.986,
      close,
      volume: 1200 + index * 37,
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
      target_mode: 'paper',
      priority: 'high',
      status: 'queued',
      correlation_id: 'corr-001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      summary: '更新 BTC 趋势策略止损参数',
    },
  ],
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
    proposals: [],
    created_at: new Date().toISOString(),
  },
]

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
  product_language: 'zh-CN',
}

const fallbackOpenClawStatus: OpenClawStatus = {
  configured: true,
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
  api_base_url: 'https://api.bybit.com',
  account_type: 'UNIFIED',
  mode: 'live',
  key_hint: null,
  last_error: '未检测到 Bybit 私有 API 配置，当前账户视图使用 mock 回退。',
  updated_at: new Date().toISOString(),
}

const fallbackWorkspacePreferences: WorkspacePreferences = {
  active_section: 'overview',
  layout_preset: 'balanced',
  selected_mode: 'paper',
  selected_symbol: 'BTCUSDT',
  selected_strategy_id: 'trend-btc-01',
  overview_card_order: ['assets', 'scheduler', 'strategy', 'risk', 'pnl', 'requests', 'backtest', 'news'],
  overview_visible_cards: ['assets', 'scheduler', 'strategy', 'risk', 'pnl', 'requests', 'backtest', 'news'],
  updated_at: new Date().toISOString(),
}

export const api = {
  getServiceHealth,
  getControlSnapshot: () => fetchJson('/api/control/snapshot', fallbackSnapshot),
  getWatchlist: () => fetchJson('/api/market/watchlist', fallbackWatchlist),
  getMarketDetail: (symbol: string) =>
    fetchJson(`/api/market/${symbol}`, fallbackMarketDetails[symbol] ?? fallbackMarketDetails.BTCUSDT),
  getStrategies: () => fetchJson('/api/strategies', fallbackStrategies),
  getBacktests: () => fetchJson('/api/backtests', fallbackBacktests),
  getChangeRequests: () => fetchJson('/api/change-requests', fallbackScheduler.change_requests),
  getScheduler: () => fetchJson('/api/ai/scheduler', fallbackScheduler),
  getNews: () => fetchJson('/api/news', fallbackNews),
  getAlerts: () => fetchJson('/api/alerts', fallbackAlerts),
  getAccountOverview: () => fetchJson('/api/account/overview', fallbackAccountOverview),
  getAccountPositions: () => fetchJson('/api/account/positions', fallbackPositions),
  getAccountOrders: () => fetchJson('/api/account/orders', fallbackOrders),
  getTrades: () => fetchJson('/api/trades', fallbackTrades),
  getReviews: () => fetchJson('/api/ai/reviews', fallbackReviews),
  getAuditEvents: () => fetchJson('/api/audit/events', fallbackAudit),
  getSettings: () => fetchJson('/api/settings', fallbackSettings),
  getWorkspacePreferences: () => fetchJson('/api/workspace/preferences', fallbackWorkspacePreferences),
  getOpenClawStatus: () => fetchJson('/api/integrations/openclaw', fallbackOpenClawStatus),
  getBybitPrivateStatus: () => fetchJson('/api/integrations/bybit-private', fallbackBybitPrivateStatus),
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
  createBacktest: (payload: { strategy_id: string; data_range: string; timeframe: string }) =>
    postJson<BacktestRun>('/api/backtests', payload),
  createManualTrade: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    mode: 'paper' | 'demo' | 'live'
    side: 'buy' | 'sell'
    quantity: number
    price: number
    note?: string
  }) => postJson<TradeRecord>('/api/trades/manual', payload),
  sendSchedulerCommand: (payload: {
    command: SchedulerCommandType
    job_id?: string
    requested_by?: string
    reason?: string
  }) =>
    postJson<{ status: string; command: SchedulerCommandType; freeze_publish?: boolean }>(
      '/api/ai/scheduler/commands',
      payload,
    ),
  updateWorkspacePreferences: (payload: {
    active_section: string
    layout_preset: 'balanced' | 'focus' | 'dense'
    selected_mode: 'paper' | 'demo' | 'live'
    selected_symbol: string
    selected_strategy_id?: string | null
    overview_card_order: string[]
    overview_visible_cards: string[]
  }) => postJson<WorkspacePreferences>('/api/workspace/preferences', payload),
  createAgentJob: (payload: {
    job_type: string
    context: Record<string, unknown>
    allowed_actions?: string[]
    timeout?: number
    idempotency_key: string
    writeback_target?: string
  }) => postJson<AgentJob>('/api/ai/jobs', payload),
}
