import type { NewsEvent } from '../types'
import { formatTime } from '../utils/app-helpers'

type NewsWorkspaceSectionProps = {
  news: NewsEvent[]
  onOpenAlertsSection: () => void
}

export default function NewsWorkspaceSection({ news, onOpenAlertsSection }: NewsWorkspaceSectionProps) {
  return (
    <section className="section-grid section-entrance">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">新闻事件</span>
            <h3>与持仓和波动相关的情报</h3>
          </div>
          <span className="chip chip--muted">Bybit 公告 · 宏观日历 · 事件流</span>
        </div>
        <div className="news-grid news-grid--compact">
          {news.map((item, index) => (
            <article key={item.id} className="news-card news-card--fade" style={{ animationDelay: `${index * 36}ms` }}>
              <div className="news-head">
                <span className="chip chip--muted">{item.symbols.join(', ') || '全市场'}</span>
                <span className={`chip ${item.impact_score >= 75 ? 'chip--warning' : 'chip--success'}`}>
                  {item.impact_score >= 75 ? '高影响' : '中影响'}
                </span>
                {item.related_alert_ids.length ? <span className="chip chip--warning">已生成提醒</span> : null}
              </div>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
              <div className="inline-actions inline-actions--tight">
                <small>
                  {item.source} · {formatTime(item.published_at)}
                </small>
                {item.url ? (
                  <a className="ghost-button ghost-button--inline" href={item.url} target="_blank" rel="noreferrer">
                    打开原文
                  </a>
                ) : null}
                {item.related_alert_ids.length ? (
                  <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenAlertsSection}>
                    查看提醒
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </article>
    </section>
  )
}
