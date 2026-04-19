import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { SettingsDraft } from '../utils/app-helpers'
import {
  buildRuntimeAndSettingsDerivedState,
  type BuildRuntimeAndSettingsDerivedStateArgs,
} from './buildRuntimeAndSettingsDerivedState'
import { useRuntimeAndSettingsDraftSync } from './useRuntimeAndSettingsDraftSync'

type UseRuntimeAndSettingsModelArgs = BuildRuntimeAndSettingsDerivedStateArgs & {
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
  lastLoadedSettingsSignatureRef: MutableRefObject<string | null>
}

export function useRuntimeAndSettingsModel({
  settings,
  setSettingsDraft,
  lastLoadedSettingsSignatureRef,
  ...derivedStateArgs
}: UseRuntimeAndSettingsModelArgs) {
  useRuntimeAndSettingsDraftSync({
    settings,
    setSettingsDraft,
    lastLoadedSettingsSignatureRef,
  })

  return buildRuntimeAndSettingsDerivedState({
    ...derivedStateArgs,
    settings,
  })
}
