// Compatibility shim. All call sites now import directly from the per-module
// files (apiHttp / apiMarket / apiStrategy / apiControlRuntime / apiAiWorkflow /
// apiOpsMonitoring / apiAccountTrading / apiSystemIntegration). This file will
// be deleted in a follow-up cleanup once external consumers stop importing it.
export { CONTROL_API_BASE, getServiceHealth } from './apiHttp'
