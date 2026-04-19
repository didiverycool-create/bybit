import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { SettingsPayload } from '../types'
import type { SettingsDraft } from '../utils/app-helpers'
import { buildLoadedSettingsDraftState } from './settingsDraftSyncHelpers'

type UseRuntimeAndSettingsDraftSyncArgs = {
  settings: SettingsPayload | null | undefined
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
  lastLoadedSettingsSignatureRef: MutableRefObject<string | null>
}

export function useRuntimeAndSettingsDraftSync({
  settings,
  setSettingsDraft,
  lastLoadedSettingsSignatureRef,
}: UseRuntimeAndSettingsDraftSyncArgs) {
  useEffect(() => {
    if (!settings) {
      return
    }
    const { draft, signature } = buildLoadedSettingsDraftState(settings)
    if (lastLoadedSettingsSignatureRef.current === signature) {
      return
    }
    setSettingsDraft(draft)
    lastLoadedSettingsSignatureRef.current = signature
  }, [lastLoadedSettingsSignatureRef, setSettingsDraft, settings])
}
