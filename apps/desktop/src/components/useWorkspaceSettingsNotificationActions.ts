import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { api } from '../api'
import type { SettingsPayload } from '../types'
import type { DesktopNotificationDelivery, DesktopNotificationPayload, SettingsDraft, SettingsNotificationChannel } from '../utils/app-helpers'
import { normalizeSettingsNotificationChannels, resolveErrorMessage } from '../utils/app-helpers'
import { applyLoadedSettingsDraft } from './settingsDraftSyncHelpers'
import {
  triggerWorkspaceSettingsNotificationTest,
  validateWorkspaceSettingsNotificationSave,
} from './workspaceSettingsNotificationActionsHelpers'

type ActionTone = 'success' | 'warning' | 'error'

type UseWorkspaceSettingsNotificationActionsArgs = {
  refreshControlData: () => Promise<void>
  queryClient: QueryClient
  settings: SettingsPayload | null | undefined
  settingsDraft: SettingsDraft
  settingsDraftDirty: boolean
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
  lastLoadedSettingsSignatureRef: MutableRefObject<string>
  desktopNotificationsEnabled: boolean
  dispatchDesktopNotification: (
    payload: DesktopNotificationPayload,
    options?: {
      bypassCooldown?: boolean
      dedupeKey?: string | null
    },
  ) => Promise<DesktopNotificationDelivery>
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
}

export function useWorkspaceSettingsNotificationActions({
  refreshControlData,
  queryClient,
  settings,
  settingsDraft,
  settingsDraftDirty,
  setSettingsDraft,
  lastLoadedSettingsSignatureRef,
  desktopNotificationsEnabled,
  dispatchDesktopNotification,
  showFeedback,
}: UseWorkspaceSettingsNotificationActionsArgs) {
  const settingsMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: async (nextSettings) => {
      queryClient.setQueryData(['settings'], nextSettings)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
        queryClient.invalidateQueries({ queryKey: ['grafana'] }),
        refreshControlData(),
      ])
    },
  })

  const toggleSettingsNotificationChannel = (channel: SettingsNotificationChannel) => {
    const channels = normalizeSettingsNotificationChannels(settingsDraft.notificationChannels)
    if (channels.includes(channel) && channels.length === 1) {
      showFeedback('warning', '至少保留一个通知渠道', '桌面端至少需要保留一个可用通知渠道，避免关键提醒被完全关闭。')
      return
    }
    setSettingsDraft((current) => {
      const currentChannels = normalizeSettingsNotificationChannels(current.notificationChannels)
      return currentChannels.includes(channel)
        ? {
            ...current,
            notificationChannels: currentChannels.filter((item) => item !== channel),
          }
        : {
            ...current,
            notificationChannels: normalizeSettingsNotificationChannels([...currentChannels, channel]),
          }
    })
  }

  const restoreSettingsDraft = () => {
    if (!settings) {
      return
    }
    applyLoadedSettingsDraft({
      settings,
      setSettingsDraft,
      lastLoadedSettingsSignatureRef,
    })
  }

  const saveSettings = async () => {
    const validationResult = validateWorkspaceSettingsNotificationSave({
      settings,
      settingsDraft,
      settingsDraftDirty,
    })
    if (!validationResult.ok) {
      showFeedback(validationResult.tone, validationResult.title, validationResult.detail)
      return
    }

    try {
      const nextSettings = await settingsMutation.mutateAsync(validationResult.input)
      applyLoadedSettingsDraft({
        settings: nextSettings,
        setSettingsDraft,
        lastLoadedSettingsSignatureRef,
      })
      showFeedback('success', '本地设置已保存', '网页入口、公共 API、通知通道与 Grafana 配置已经写回控制端并立即生效。')
    } catch (error) {
      showFeedback('error', '本地设置保存失败', resolveErrorMessage(error))
    }
  }

  const triggerDesktopNotificationTest = async () => {
    await triggerWorkspaceSettingsNotificationTest({
      settings,
      desktopNotificationsEnabled,
      dispatchDesktopNotification,
      showFeedback,
    })
  }

  return {
    settingsMutationPending: settingsMutation.isPending,
    toggleSettingsNotificationChannel,
    restoreSettingsDraft,
    saveSettings,
    triggerDesktopNotificationTest,
  }
}
