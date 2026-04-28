import { Save } from 'lucide-react'

import type { ConnectionConfigPanelActionSectionProps } from './ConnectionConfigPanel.types'

export default function ConnectionConfigPanelActionSection({
  serviceAvailable,
  settingsMutationPending,
  settingsQueryLoading,
  settingsDraftDirty,
  onSaveSettings,
  onRestoreSettingsDraft,
}: ConnectionConfigPanelActionSectionProps) {
  return (
    <>
      <div className="hero-actions hero-actions--compact">
        <button
          type="button"
          className="primary-button"
          disabled={!serviceAvailable || settingsMutationPending || settingsQueryLoading || !settingsDraftDirty}
          onClick={onSaveSettings}
        >
          <Save size={14} />
          保存设置
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={settingsMutationPending || settingsQueryLoading || !settingsDraftDirty}
          onClick={onRestoreSettingsDraft}
        >
          恢复已保存值
        </button>
      </div>
      <p className="panel-note">
        网页登录、账户设置和 API Key 创建继续使用 https://www.bybit-global.com/；程序读取行情与账户时走 API 域名，两者用途不同。
        Grafana 项留空表示关闭本地仪表盘跳转配置。
      </p>
    </>
  )
}
