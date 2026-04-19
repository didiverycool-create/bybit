import { ExternalLink } from 'lucide-react'

import type { ConnectionConfigPanelPrivateStatusSectionProps } from './ConnectionConfigPanel.types'
import {
  bybitPrivateConfigSourceLabel,
  configPresenceLabel,
  isAbsoluteLocalPath,
} from '../../utils/app-helpers'

export default function ConnectionConfigPanelPrivateStatusSection({
  settingsDraft,
  bybitPrivateStatus,
  onOpenLocalPath,
}: ConnectionConfigPanelPrivateStatusSectionProps) {
  return (
    <div className="settings-block">
      <span className="section-label">Bybit 私有只读配置</span>
      <div className="contract-list">
        <code>{bybitPrivateConfigSourceLabel(bybitPrivateStatus?.source)}</code>
        <code>{bybitPrivateStatus?.config_path ?? '~/.bybit-control/private-api.json'}</code>
        <code>{configPresenceLabel(bybitPrivateStatus?.config_exists)}</code>
      </div>
      <p className="panel-note">
        当前 API 域名：<code>{bybitPrivateStatus?.api_base_url ?? settingsDraft.apiBaseUrl ?? 'https://api.bybit.com'}</code>。
        浏览器里的登录、账户设置和 API Key 创建仍使用 {settingsDraft.bybitWebEntry || 'https://www.bybit-global.com/'}
        ，两者用途不同。
      </p>
      <p className="panel-note">
        示例文件：<code>{bybitPrivateStatus?.example_config_path ?? '/Users/leo/Desktop/Work/bybit/services/control-api/private-api.example.json'}</code>。
        如果同时设置环境变量，环境变量会覆盖本地配置文件。
      </p>
      <div className="hero-actions hero-actions--compact">
        <button
          type="button"
          className="ghost-button"
          disabled={!isAbsoluteLocalPath(bybitPrivateStatus?.config_path)}
          onClick={() =>
            void onOpenLocalPath(bybitPrivateStatus?.config_path, {
              label: 'Bybit 私有配置目录',
              revealInFolder: true,
            })
          }
        >
          <ExternalLink size={14} />
          打开配置目录
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!isAbsoluteLocalPath(bybitPrivateStatus?.example_config_path)}
          onClick={() =>
            void onOpenLocalPath(bybitPrivateStatus?.example_config_path, {
              label: 'Bybit 私有配置示例',
            })
          }
        >
          <ExternalLink size={14} />
          打开示例文件
        </button>
      </div>
    </div>
  )
}
