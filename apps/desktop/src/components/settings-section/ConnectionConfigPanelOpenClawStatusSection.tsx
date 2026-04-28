import { ExternalLink } from 'lucide-react'

import type { ConnectionConfigPanelOpenClawStatusSectionProps } from './ConnectionConfigPanel.types'
import {
  configPresenceLabel,
  isAbsoluteLocalPath,
  openClawCommandLabel,
} from '../../utils/app-helpers'

export default function ConnectionConfigPanelOpenClawStatusSection({
  settings,
  openClawStatus,
  onOpenLocalPath,
}: ConnectionConfigPanelOpenClawStatusSectionProps) {
  return (
    <div className="settings-block">
      <span className="section-label">OpenClaw 运行配置</span>
      <div className="contract-list">
        <code>{openClawCommandLabel(openClawStatus?.command_available)}</code>
        <code>{openClawStatus?.config_path ?? '~/.openclaw/openclaw.json'}</code>
        <code>{configPresenceLabel(openClawStatus?.config_exists)}</code>
        <code>{openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? 'ws://127.0.0.1:18789'}</code>
        <code>{openClawStatus?.resolved_agent ?? settings?.openclaw_agent ?? 'codex'}</code>
      </div>
      <p className="panel-note">
        OpenClaw 网关地址与默认 Agent 继续由本机外部配置驱动，这里只读展示，避免出现"界面已改但运行态未切换"。
      </p>
      <div className="hero-actions hero-actions--compact">
        <button
          type="button"
          className="ghost-button"
          disabled={!isAbsoluteLocalPath(openClawStatus?.config_path)}
          onClick={() =>
            void onOpenLocalPath(openClawStatus?.config_path, {
              label: 'OpenClaw 配置目录',
              revealInFolder: true,
            })
          }
        >
          <ExternalLink size={14} />
          打开配置目录
        </button>
      </div>
    </div>
  )
}
