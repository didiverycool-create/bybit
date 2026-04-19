import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../api'
import type { ExecutionImpactRecord } from '../types'
import { formatDateTime, resolveErrorMessage } from '../utils/app-helpers'

const EXECUTION_IMPACT_QUERY_KEY = ['execution-impact-records'] as const

function impactLevelChipClass(level: ExecutionImpactRecord['impact_level']) {
  if (level === 'significant') return 'chip chip--warning'
  if (level === 'moderate') return 'chip'
  return 'chip chip--muted'
}

function impactLevelLabel(level: ExecutionImpactRecord['impact_level']) {
  if (level === 'significant') return '影响显著'
  if (level === 'moderate') return '影响中等'
  return '影响轻微'
}

function directionChipClass(direction: ExecutionImpactRecord['direction']) {
  if (direction === 'improved') return 'chip chip--success'
  if (direction === 'worsened') return 'chip chip--warning'
  return 'chip'
}

function directionLabel(direction: ExecutionImpactRecord['direction']) {
  if (direction === 'improved') return '向好'
  if (direction === 'worsened') return '走弱'
  return '持平'
}

type ExecutionImpactBulletListProps = {
  label: string
  items: string[]
}

function ExecutionImpactBulletList({ label, items }: ExecutionImpactBulletListProps) {
  if (!items.length) return null
  return (
    <div className="panel-note" data-execution-impact-list={label}>
      <span className="section-label">{label}</span>
      <ul className="trade-list trade-list--dense">
        {items.map((item, index) => (
          <li key={`${label}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

type ExecutionImpactRecordCardProps = {
  record: ExecutionImpactRecord
}

function ExecutionImpactRecordCard({ record }: ExecutionImpactRecordCardProps) {
  const footerStamp = record.updated_at ?? record.created_at
  return (
    <article className="trade-item" data-execution-impact-record-id={record.id}>
      <div className="panel-head">
        <div>
          <strong>
            {record.strategy_name}（{record.strategy_id}）
          </strong>
          <p className="panel-note">
            {record.window_start} ~ {record.window_end}
          </p>
        </div>
        <div className="inline-actions inline-actions--tight">
          <span className={impactLevelChipClass(record.impact_level)}>
            {impactLevelLabel(record.impact_level)}
          </span>
          <span className={directionChipClass(record.direction)}>
            {directionLabel(record.direction)}
          </span>
        </div>
      </div>
      <p>{record.summary}</p>
      <ExecutionImpactBulletList label="影响订单" items={record.affected_orders} />
      <ExecutionImpactBulletList label="影响持仓" items={record.affected_positions} />
      <ExecutionImpactBulletList label="指标变化" items={record.metrics_deltas} />
      <ExecutionImpactBulletList label="后续核查" items={record.follow_up_checks} />
      <small>来源 {record.source} · {formatDateTime(footerStamp)}</small>
    </article>
  )
}

export default function ExecutionImpactSection() {
  const queryClient = useQueryClient()
  const recordsQuery = useQuery({
    queryKey: EXECUTION_IMPACT_QUERY_KEY,
    queryFn: api.fetchExecutionImpactRecords,
    staleTime: 15000,
    refetchInterval: 30000,
  })
  const summarizeMutation = useMutation({
    mutationFn: api.queueExecutionImpactSummary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXECUTION_IMPACT_QUERY_KEY })
    },
  })

  const records = recordsQuery.data ?? []
  const loading = recordsQuery.isLoading
  const errorMessage = recordsQuery.isError ? resolveErrorMessage(recordsQuery.error) : null
  const mutationError = summarizeMutation.isError
    ? resolveErrorMessage(summarizeMutation.error)
    : null
  const latestRecord = records[0] ?? null

  const onQueueSummary = () => {
    if (summarizeMutation.isPending) return
    const now = new Date()
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000)
    const seed = latestRecord
    summarizeMutation.mutate({
      strategy_id: seed?.strategy_id ?? 'aggregate',
      strategy_name: seed?.strategy_name ?? '全量执行',
      window_start: seed?.window_end ?? windowStart.toISOString(),
      window_end: now.toISOString(),
      order_count: 0,
      fill_count: 0,
      total_notional: 0,
      slippage_bps: 0,
      expected_pnl: 0,
      realized_pnl: 0,
      requested_by: 'desktop_operator',
    })
  }

  return (
    <article className="panel" data-execution-impact-section="1">
      <div className="panel-head">
        <div>
          <span className="section-label">执行影响</span>
          <h3>最近执行影响摘要</h3>
        </div>
        <div className="inline-actions inline-actions--tight">
          <span className="chip chip--muted">{records.length} 条</span>
          <button
            type="button"
            className="ghost-button"
            disabled={summarizeMutation.isPending}
            onClick={onQueueSummary}
          >
            {summarizeMutation.isPending ? '正在触发…' : '生成新摘要'}
          </button>
        </div>
      </div>
      {mutationError && (
        <p className="panel-note" data-execution-impact-mutation-error="1">
          触发摘要失败：{mutationError}
        </p>
      )}
      {loading && (
        <div className="empty-state empty-state--inline">正在拉取执行影响记录...</div>
      )}
      {!loading && errorMessage && (
        <div className="empty-state empty-state--inline">
          加载执行影响记录失败：{errorMessage}
        </div>
      )}
      {!loading && !errorMessage && !records.length && (
        <div className="empty-state empty-state--inline">暂无执行影响记录。</div>
      )}
      {!loading && !errorMessage && records.length > 0 && (
        <div className="trade-list trade-list--dense" data-execution-impact-records="1">
          {records.map((record) => (
            <ExecutionImpactRecordCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </article>
  )
}
