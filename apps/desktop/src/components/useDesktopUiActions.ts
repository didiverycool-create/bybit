import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { SettingsPayload } from '../types'
import {
  desktopNotificationSignature,
  duplicateDesktopNotificationCooldownMs,
  isAbsoluteLocalPath,
  sendDesktopNotificationWithSettings,
  type DesktopNotificationDelivery,
  type DesktopNotificationPayload,
} from '../utils/app-helpers'

type ActionFeedbackState = {
  tone: 'success' | 'warning' | 'error'
  title: string
  detail: string
}

type UseDesktopUiActionsArgs = {
  setActionFeedback: Dispatch<SetStateAction<ActionFeedbackState | null>>
  settings: SettingsPayload | null | undefined
  desktopNotificationPermissionRequestedRef: MutableRefObject<boolean>
  recentDesktopNotificationRef: MutableRefObject<Map<string, number>>
}

export function useDesktopUiActions({
  setActionFeedback,
  settings,
  desktopNotificationPermissionRequestedRef,
  recentDesktopNotificationRef,
}: UseDesktopUiActionsArgs) {
  const showFeedback = useCallback(
    (tone: ActionFeedbackState['tone'], title: string, detail: string) => {
      setActionFeedback({ tone, title, detail })
    },
    [setActionFeedback],
  )

  const dispatchDesktopNotification = useCallback(
    async (
      payload: DesktopNotificationPayload,
      options?: {
        bypassCooldown?: boolean
        dedupeKey?: string | null
      },
    ): Promise<DesktopNotificationDelivery> => {
      const shouldApplyCooldown = payload.urgency !== 'critical' && !options?.bypassCooldown
      const signature = options?.dedupeKey?.trim() || desktopNotificationSignature(payload)
      const now = Date.now()
      if (shouldApplyCooldown) {
        recentDesktopNotificationRef.current.forEach((timestamp, key) => {
          if (now - timestamp > duplicateDesktopNotificationCooldownMs * 3) {
            recentDesktopNotificationRef.current.delete(key)
          }
        })
        const lastDeliveredAt = recentDesktopNotificationRef.current.get(signature)
        if (lastDeliveredAt && now - lastDeliveredAt < duplicateDesktopNotificationCooldownMs) {
          return 'suppressed'
        }
      }
      const delivery = await sendDesktopNotificationWithSettings(
        payload,
        settings,
        desktopNotificationPermissionRequestedRef,
      )
      if (delivery === 'delivered' && shouldApplyCooldown) {
        recentDesktopNotificationRef.current.set(signature, now)
      }
      return delivery
    },
    [desktopNotificationPermissionRequestedRef, recentDesktopNotificationRef, settings],
  )

  const openLocalPath = useCallback(
    async (
      targetPath: string | null | undefined,
      options: {
        label: string
        revealInFolder?: boolean
      },
    ) => {
      if (!isAbsoluteLocalPath(targetPath)) {
        showFeedback('warning', `无法打开${options.label}`, '当前路径不是本机绝对路径，请先确认控制服务已刷新到最新配置状态。')
        return
      }
      if (typeof window.bybitApp?.openPath !== 'function') {
        showFeedback('warning', `无法打开${options.label}`, '当前运行环境不支持本地路径操作，请在 Electron 桌面端中使用。')
        return
      }
      try {
        const result = await window.bybitApp.openPath({
          path: targetPath,
          revealInFolder: options.revealInFolder ?? false,
        })
        if (!result?.ok) {
          showFeedback('error', `打开${options.label}失败`, result?.message ?? '本机未返回更详细的错误信息。')
        }
      } catch (error) {
        showFeedback(
          'error',
          `打开${options.label}失败`,
          error instanceof Error ? error.message : '本机未返回更详细的错误信息。',
        )
      }
    },
    [showFeedback],
  )

  return {
    showFeedback,
    dispatchDesktopNotification,
    openLocalPath,
  }
}
