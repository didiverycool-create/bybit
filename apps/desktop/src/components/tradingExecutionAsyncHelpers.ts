import { resolveErrorMessage } from '../utils/app-helpers'

import type { ActionTone } from './tradingExecutionActionHelpers'

export type TradingExecutionFeedback = (
  tone: ActionTone,
  title: string,
  detail: string,
) => void

type RunTradingExecutionActionArgs<T> = {
  execute: () => Promise<T>
  failureTitle: string
  showFeedback: TradingExecutionFeedback
  onSuccess: (result: T) => void | Promise<void>
}

export async function runTradingExecutionAction<T>({
  execute,
  failureTitle,
  showFeedback,
  onSuccess,
}: RunTradingExecutionActionArgs<T>) {
  try {
    const result = await execute()
    await onSuccess(result)
  } catch (error) {
    showFeedback('error', failureTitle, resolveErrorMessage(error))
  }
}
