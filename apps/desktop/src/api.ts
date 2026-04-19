import {
  CONTROL_API_BASE,
  getServiceHealth,
} from './apiHttp'
import { accountTradingApi } from './apiAccountTrading'
import { aiWorkflowApi } from './apiAiWorkflow'
import { controlRuntimeApi } from './apiControlRuntime'
import { marketApi } from './apiMarket'
import { opsMonitoringApi } from './apiOpsMonitoring'
import { strategyApi } from './apiStrategy'
import { systemIntegrationApi } from './apiSystemIntegration'

export { CONTROL_API_BASE, getServiceHealth }

export const api = {
  getServiceHealth,
  ...controlRuntimeApi,
  ...marketApi,
  ...strategyApi,
  ...aiWorkflowApi,
  ...opsMonitoringApi,
  ...accountTradingApi,
  ...systemIntegrationApi,
}
