import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { SettingsPayload } from '../types'
import { buildSettingsDraft, type SettingsDraft } from '../utils/app-helpers'

type ApplyLoadedSettingsDraftArgs = {
  settings: SettingsPayload
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
  lastLoadedSettingsSignatureRef: MutableRefObject<string | null>
}

export function buildLoadedSettingsDraftState(settings: SettingsPayload) {
  const draft = buildSettingsDraft(settings)
  return {
    draft,
    signature: JSON.stringify(draft),
  }
}

export function applyLoadedSettingsDraft({
  settings,
  setSettingsDraft,
  lastLoadedSettingsSignatureRef,
}: ApplyLoadedSettingsDraftArgs) {
  const { draft, signature } = buildLoadedSettingsDraftState(settings)
  setSettingsDraft(draft)
  lastLoadedSettingsSignatureRef.current = signature
  return {
    draft,
    signature,
  }
}
