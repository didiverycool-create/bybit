import { startTransition, type ReactNode } from 'react'
import {
  Activity,
  Bell,
  Bot,
  CandlestickChart,
  ClipboardList,
  FileSearch,
  History,
  Newspaper,
  Settings2,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import type { SectionKey } from '../types'

type NavItem = {
  key: SectionKey
  label: string
  hint: string
  group: 'overview' | 'observe' | 'research' | 'control' | 'records'
  icon: LucideIcon
}

type InlineToast = {
  tone: 'success' | 'warning' | 'error'
  title: string
  detail: string
  icon?: LucideIcon | null
}

type AppChromeShellProps = {
  activeSection: SectionKey
  onOpenSection: (section: SectionKey) => void
  statusInspectorHasNotice: boolean
  statusInspectorButtonTitle: string
  onOpenStatusInspector: () => void
  inlineToast?: InlineToast | null
  children: ReactNode
}

const navGroups = [
  { key: 'overview', label: '总览' },
  { key: 'observe', label: '交易观察' },
  { key: 'research', label: '策略研究' },
  { key: 'control', label: '运行控制' },
  { key: 'records', label: '记录审计' },
] as const

const navItems: NavItem[] = [
  { key: 'overview', label: '总览', hint: '运行看板', group: 'overview', icon: Activity },
  { key: 'market', label: '行情', hint: '实时跟踪', group: 'observe', icon: CandlestickChart },
  { key: 'news', label: '新闻事件', hint: '情报与宏观', group: 'observe', icon: Newspaper },
  { key: 'strategy', label: '策略', hint: '参数与启停', group: 'research', icon: ClipboardList },
  { key: 'backtest', label: '回测', hint: '历史验证', group: 'research', icon: FileSearch },
  { key: 'replay', label: 'AI复盘', hint: '日报总结', group: 'research', icon: Sparkles },
  { key: 'settings', label: '设置', hint: '控制与偏好', group: 'control', icon: Settings2 },
  { key: 'scheduler', label: 'AI调度', hint: 'OpenClaw 编排', group: 'control', icon: Bot },
  { key: 'alerts', label: '提醒中心', hint: '风险告警', group: 'control', icon: Bell },
  { key: 'trades', label: '交易记录', hint: '委托与成交', group: 'records', icon: History },
  { key: 'audit', label: '系统日志/审计', hint: '执行追溯', group: 'records', icon: ShieldAlert },
]

export default function AppChromeShell({
  activeSection,
  onOpenSection,
  statusInspectorHasNotice,
  statusInspectorButtonTitle,
  onOpenStatusInspector,
  inlineToast,
  children,
}: AppChromeShellProps) {
  const InlineToastIcon = inlineToast?.icon ?? null

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">BX</div>
          <div>
            <p>Bybit 量化交易控制端</p>
            <span>桌面版 v1 · 本地控制中枢</span>
          </div>
        </div>

        <div className="nav-block">
          {navGroups.map((group) => (
            <div key={group.key} className="nav-group">
              <span className="nav-group__label">{group.label}</span>
              <div className="nav-group__items">
                {navItems
                  .filter((item) => item.group === group.key)
                  .map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`nav-item ${activeSection === item.key ? 'active' : ''}`}
                        data-nav-section={item.key}
                        title={item.hint}
                        onClick={() => {
                          startTransition(() => onOpenSection(item.key))
                        }}
                      >
                        <span className="nav-item__label">
                          <Icon size={15} />
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar__identity">
            <div className="topbar__title-group">
              <span className="topbar__title">量化控制端</span>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className={`icon-button ${statusInspectorHasNotice ? 'icon-button--primary' : ''}`}
              title={statusInspectorButtonTitle}
              aria-label="打开运行状态窗口"
              onClick={onOpenStatusInspector}
            >
              <Activity size={16} />
            </button>
          </div>
        </header>

        {inlineToast && (
          <div className={`inline-toast inline-toast--${inlineToast.tone}`}>
            <div className="inline-toast__main">
              <strong>
                {InlineToastIcon ? <InlineToastIcon size={14} /> : null}
                {inlineToast.title}
              </strong>
              <span>{inlineToast.detail}</span>
            </div>
          </div>
        )}

        {children}
      </main>
    </div>
  )
}
