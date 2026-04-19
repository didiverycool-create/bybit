import { ClipboardList } from 'lucide-react'

import { formatTime } from '../utils/app-helpers'
import type { OverviewWorkspaceActivityStreamQueuedRequestRowProps } from './OverviewWorkspaceActivityStreamSection.types'

export default function OverviewWorkspaceActivityStreamQueuedRequestRow({ item, index }: OverviewWorkspaceActivityStreamQueuedRequestRowProps) {
  return (
    <div className="console-row console-row--fade" style={{ animationDelay: `${index * 32}ms` }}>
      <div className="console-row__main">
        <strong>
          <ClipboardList size={13} />
          请求 · {item.type}
        </strong>
        <p>
          {String(item.payload.strategy_id ?? item.payload.symbol ?? '系统')} · {item.reason}
        </p>
      </div>
      <div className="console-row__meta">
        <span className="console-tag console-tag--good">{item.status}</span>
        <small>{formatTime(item.updated_at)}</small>
      </div>
    </div>
  )
}
