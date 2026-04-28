import type { BrowserWindow } from 'electron'

import { runMarketSwitchSmoke } from './runMarketSwitchSmoke'
import { runStrategyActivitySmoke } from './runStrategyActivitySmoke'

type RunRequestedSmokeOnLoadArgs = {
  shouldRunStrategyActivitySmoke: boolean
  shouldRunMarketSwitchSmoke: boolean
  controlApiBase: string
  strategyActivitySmokeRenderBudgetMs: number
}

type RequestedSmokeTask = {
  completionToken: string
  failureLogPrefix: string
  run: () => Promise<void>
}

const REQUESTED_SMOKE_TOKENS = {
  strategyActivity: '[renderer:smoke:strategy-activity:result]',
  marketSwitch: '[renderer:smoke:result]',
} as const

function buildRequestedSmokeTasks(
  win: BrowserWindow,
  {
    shouldRunStrategyActivitySmoke,
    shouldRunMarketSwitchSmoke,
    controlApiBase,
    strategyActivitySmokeRenderBudgetMs,
  }: RunRequestedSmokeOnLoadArgs,
) {
  const tasks: RequestedSmokeTask[] = []

  if (shouldRunStrategyActivitySmoke) {
    tasks.push({
      completionToken: REQUESTED_SMOKE_TOKENS.strategyActivity,
      failureLogPrefix: '[renderer:strategy-activity-smoke:failed]',
      run: () =>
        runStrategyActivitySmoke(win, {
          controlApiBase,
          renderBudgetMs: strategyActivitySmokeRenderBudgetMs,
        }),
    })
  }

  if (shouldRunMarketSwitchSmoke) {
    tasks.push({
      completionToken: REQUESTED_SMOKE_TOKENS.marketSwitch,
      failureLogPrefix: '[renderer:dom-failed]',
      run: () =>
        runMarketSwitchSmoke(win, {
          controlApiBase,
        }),
    })
  }

  return tasks
}

export function shouldCloseRequestedSmokeOnLogMessage(
  message: string,
  {
    shouldRunStrategyActivitySmoke,
    shouldRunMarketSwitchSmoke,
  }: Pick<RunRequestedSmokeOnLoadArgs, 'shouldRunStrategyActivitySmoke' | 'shouldRunMarketSwitchSmoke'>,
) {
  const completionTokens = [
    ...(shouldRunStrategyActivitySmoke ? [REQUESTED_SMOKE_TOKENS.strategyActivity] : []),
    ...(shouldRunMarketSwitchSmoke ? [REQUESTED_SMOKE_TOKENS.marketSwitch] : []),
  ]
  return completionTokens.some((token) => message.includes(token))
}

export async function runRequestedSmokeOnLoad(
  win: BrowserWindow,
  {
    shouldRunStrategyActivitySmoke,
    shouldRunMarketSwitchSmoke,
    controlApiBase,
    strategyActivitySmokeRenderBudgetMs,
  }: RunRequestedSmokeOnLoadArgs,
) {
  for (const task of buildRequestedSmokeTasks(win, {
    shouldRunStrategyActivitySmoke,
    shouldRunMarketSwitchSmoke,
    controlApiBase,
    strategyActivitySmokeRenderBudgetMs,
  })) {
    try {
      await task.run()
    } catch (error) {
      console.error(task.failureLogPrefix, error)
    }
  }
}
