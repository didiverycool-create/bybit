import { useState } from 'react'
import { X } from 'lucide-react'

import type { StrategyKernel, StrategySummary } from '../types'
import { normalizeDraftValue } from '../utils/app-helpers'

type StrategyEditorPanelProps = {
  open: boolean
  strategy: StrategySummary | null
  parameterDrafts: Record<string, string>
  onParameterDraftChange: (key: string, value: string) => void
  riskBudgetDraft: string
  onRiskBudgetDraftChange: (value: string) => void
  hasParameterDraftChanges: boolean
  parameterDraftPatchCount: number
  riskBudgetChanged: boolean
  serviceAvailable: boolean
  pending: boolean
  onSubmitParameterUpdate: () => void
  onSubmitRiskUpdate: () => void
  onClose: () => void
}

const KERNEL_OPTIONS: { value: StrategyKernel; label: string }[] = [
  { value: 'trend', label: '趋势跟随 trend' },
  { value: 'mean_revert', label: '均值回归 mean_revert' },
  { value: 'breakout', label: '区间突破 breakout' },
  { value: 'momentum', label: '动量确认 momentum' },
  { value: 'bollinger_squeeze', label: '布林挤压 bollinger_squeeze' },
  { value: 'rsi_reversal', label: 'RSI 反转 rsi_reversal' },
]

function currentKernel(strategy: StrategySummary, drafts: Record<string, string>): string {
  const draft = drafts.kernel
  if (typeof draft === 'string' && draft !== '') return draft
  return strategy.kernel ?? ''
}

function currentText(
  strategy: StrategySummary,
  drafts: Record<string, string>,
  key: keyof StrategySummary,
): string {
  const draft = drafts[key as string]
  if (typeof draft === 'string') return draft
  const value = strategy[key]
  if (value == null) return ''
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return normalizeDraftValue(value)
  }
  return ''
}

function partialTakeProfitSummary(strategy: StrategySummary): string {
  if (!strategy.partial_take_profits || strategy.partial_take_profits.length === 0) {
    return '未设置'
  }
  return strategy.partial_take_profits
    .map((rung) => `触发 ${rung.trigger_pct}% / 平 ${Math.round(rung.exit_ratio * 100)}%`)
    .join('、')
}

export default function StrategyEditorPanel({
  open,
  strategy,
  parameterDrafts,
  onParameterDraftChange,
  riskBudgetDraft,
  onRiskBudgetDraftChange,
  hasParameterDraftChanges,
  parameterDraftPatchCount,
  riskBudgetChanged,
  serviceAvailable,
  pending,
  onSubmitParameterUpdate,
  onSubmitRiskUpdate,
  onClose,
}: StrategyEditorPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (!open || !strategy) {
    return null
  }

  const kernelValue = currentKernel(strategy, parameterDrafts)
  const isMomentum = kernelValue === 'momentum'
  const isBollingerSqueeze = kernelValue === 'bollinger_squeeze'
  const isRsiReversal = kernelValue === 'rsi_reversal'

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel floating-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-label="策略参数编辑窗口"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">策略参数编辑</span>
            <h3>{strategy.name}</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭策略参数编辑窗口"
            aria-label="关闭策略参数编辑窗口"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="floating-panel__body">
          <div className="parameter-grid">
            {strategy.parameters.map((parameter) => (
              <div key={parameter.key} className="parameter-card">
                <span>{parameter.label}</span>
                <input
                  value={parameterDrafts[parameter.key] ?? normalizeDraftValue(parameter.value)}
                  onChange={(event) => onParameterDraftChange(parameter.key, event.target.value)}
                />
                {parameter.unit ? <small>{parameter.unit}</small> : null}
              </div>
            ))}
            <div className="parameter-card">
              <span>风险预算</span>
              <input value={riskBudgetDraft} onChange={(event) => onRiskBudgetDraftChange(event.target.value)} />
              <small>支持直接填写如 18%</small>
            </div>
            <div className="parameter-card">
              <span>内核选择 kernel</span>
              <select
                value={kernelValue}
                onChange={(event) => onParameterDraftChange('kernel', event.target.value)}
              >
                <option value="">沿用策略默认路由</option>
                {KERNEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>留空即沿用当前路由，切换后请务必回测验证</small>
            </div>
          </div>

          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setAdvancedOpen((current) => !current)}
              aria-expanded={advancedOpen}
            >
              {advancedOpen ? '收起高级配置' : '展开高级配置'}
            </button>
            <small style={{ color: 'var(--text-soft)' }}>
              仅在需要时覆盖；留空字段不会触发回写。
            </small>
          </div>

          {advancedOpen && (
            <div className="parameter-grid" style={{ marginTop: 12 }}>
              <div className="parameter-card">
                <span>追踪止损 trailing_stop_pct</span>
                <input
                  value={currentText(strategy, parameterDrafts, 'trailing_stop_pct')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('trailing_stop_pct', event.target.value)}
                />
                <small>以百分点表示，如 1.5 代表 1.5%</small>
              </div>
              <div className="parameter-card">
                <span>保本触发 break_even_trigger_pct</span>
                <input
                  value={currentText(strategy, parameterDrafts, 'break_even_trigger_pct')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('break_even_trigger_pct', event.target.value)}
                />
              </div>
              <div className="parameter-card">
                <span>分批止盈 partial_take_profits</span>
                <small style={{ marginTop: 4 }}>{partialTakeProfitSummary(strategy)}</small>
                <small>桌面端暂仅展示，如需调整请由提案流程下发</small>
              </div>

              <div className="parameter-card">
                <span>波动率目标 sizing 开关</span>
                <select
                  value={currentText(strategy, parameterDrafts, 'volatility_sizing_enabled')}
                  onChange={(event) =>
                    onParameterDraftChange('volatility_sizing_enabled', event.target.value)
                  }
                >
                  <option value="">沿用当前配置</option>
                  <option value="true">开启</option>
                  <option value="false">关闭</option>
                </select>
              </div>
              <div className="parameter-card">
                <span>波动窗口 volatility_lookback</span>
                <input
                  value={currentText(strategy, parameterDrafts, 'volatility_lookback')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('volatility_lookback', event.target.value)}
                />
                <small>ATR 样本条数，整数</small>
              </div>
              <div className="parameter-card">
                <span>波动目标 volatility_target_pct</span>
                <input
                  value={currentText(strategy, parameterDrafts, 'volatility_target_pct')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('volatility_target_pct', event.target.value)}
                />
              </div>
              <div className="parameter-card">
                <span>低波阈值 regime_low_pct</span>
                <input
                  value={parameterDrafts.volatility_regime_low_pct ?? (strategy.volatility_regime_thresholds?.low_pct?.toString() ?? '')}
                  placeholder="留空即不覆盖"
                  onChange={(event) =>
                    onParameterDraftChange('volatility_regime_low_pct', event.target.value)
                  }
                />
                <small>ATR/价格百分比</small>
              </div>
              <div className="parameter-card">
                <span>高波阈值 regime_high_pct</span>
                <input
                  value={parameterDrafts.volatility_regime_high_pct ?? (strategy.volatility_regime_thresholds?.high_pct?.toString() ?? '')}
                  placeholder="留空即不覆盖"
                  onChange={(event) =>
                    onParameterDraftChange('volatility_regime_high_pct', event.target.value)
                  }
                />
              </div>
              <div className="parameter-card">
                <span>低波倍数 regime_exposure_low</span>
                <input
                  value={parameterDrafts.regime_exposure_low ?? (strategy.regime_exposure_multipliers?.low?.toString() ?? '')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('regime_exposure_low', event.target.value)}
                />
              </div>
              <div className="parameter-card">
                <span>正常倍数 regime_exposure_normal</span>
                <input
                  value={parameterDrafts.regime_exposure_normal ?? (strategy.regime_exposure_multipliers?.normal?.toString() ?? '')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('regime_exposure_normal', event.target.value)}
                />
              </div>
              <div className="parameter-card">
                <span>高波倍数 regime_exposure_high</span>
                <input
                  value={parameterDrafts.regime_exposure_high ?? (strategy.regime_exposure_multipliers?.high?.toString() ?? '')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('regime_exposure_high', event.target.value)}
                />
              </div>

              <div className="parameter-card">
                <span>置信度校准开关</span>
                <select
                  value={currentText(strategy, parameterDrafts, 'confidence_calibration_enabled')}
                  onChange={(event) =>
                    onParameterDraftChange('confidence_calibration_enabled', event.target.value)
                  }
                >
                  <option value="">沿用当前配置</option>
                  <option value="true">开启</option>
                  <option value="false">关闭</option>
                </select>
              </div>
              <div className="parameter-card">
                <span>低波置信系数 confidence_regime_low</span>
                <input
                  value={parameterDrafts.confidence_regime_low ?? (strategy.confidence_regime_adjustments?.low?.toString() ?? '')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('confidence_regime_low', event.target.value)}
                />
              </div>
              <div className="parameter-card">
                <span>正常置信系数 confidence_regime_normal</span>
                <input
                  value={parameterDrafts.confidence_regime_normal ?? (strategy.confidence_regime_adjustments?.normal?.toString() ?? '')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('confidence_regime_normal', event.target.value)}
                />
              </div>
              <div className="parameter-card">
                <span>高波置信系数 confidence_regime_high</span>
                <input
                  value={parameterDrafts.confidence_regime_high ?? (strategy.confidence_regime_adjustments?.high?.toString() ?? '')}
                  placeholder="留空即不覆盖"
                  onChange={(event) => onParameterDraftChange('confidence_regime_high', event.target.value)}
                />
              </div>
              <div className="parameter-card">
                <span>参数漂移惩罚 confidence_parameter_drift_penalty</span>
                <input
                  value={currentText(strategy, parameterDrafts, 'confidence_parameter_drift_penalty')}
                  placeholder="留空即不覆盖"
                  onChange={(event) =>
                    onParameterDraftChange('confidence_parameter_drift_penalty', event.target.value)
                  }
                />
              </div>
              <div className="parameter-card">
                <span>多周期置信增益 confidence_multi_timeframe_alignment</span>
                <select
                  value={currentText(strategy, parameterDrafts, 'confidence_multi_timeframe_alignment')}
                  onChange={(event) =>
                    onParameterDraftChange('confidence_multi_timeframe_alignment', event.target.value)
                  }
                >
                  <option value="">沿用当前配置</option>
                  <option value="true">开启</option>
                  <option value="false">关闭</option>
                </select>
              </div>

              {isMomentum && (
                <>
                  <div className="parameter-card">
                    <span>动量 ROC 窗口 roc_window</span>
                    <input
                      value={currentText(strategy, parameterDrafts, 'roc_window')}
                      placeholder="留空即不覆盖"
                      onChange={(event) => onParameterDraftChange('roc_window', event.target.value)}
                    />
                  </div>
                  <div className="parameter-card">
                    <span>EMA 趋势窗口 ema_trend_window</span>
                    <input
                      value={currentText(strategy, parameterDrafts, 'ema_trend_window')}
                      placeholder="留空即不覆盖"
                      onChange={(event) => onParameterDraftChange('ema_trend_window', event.target.value)}
                    />
                  </div>
                  <div className="parameter-card">
                    <span>动量阈值 momentum_threshold_pct</span>
                    <input
                      value={currentText(strategy, parameterDrafts, 'momentum_threshold_pct')}
                      placeholder="留空即不覆盖"
                      onChange={(event) =>
                        onParameterDraftChange('momentum_threshold_pct', event.target.value)
                      }
                    />
                  </div>
                </>
              )}

              {isBollingerSqueeze && (
                <>
                  <div className="parameter-card">
                    <span>布林窗口 bollinger_window</span>
                    <input
                      value={currentText(strategy, parameterDrafts, 'bollinger_window')}
                      placeholder="留空即不覆盖"
                      onChange={(event) => onParameterDraftChange('bollinger_window', event.target.value)}
                    />
                  </div>
                  <div className="parameter-card">
                    <span>布林标准差 bollinger_std</span>
                    <input
                      value={currentText(strategy, parameterDrafts, 'bollinger_std')}
                      placeholder="留空即不覆盖"
                      onChange={(event) => onParameterDraftChange('bollinger_std', event.target.value)}
                    />
                  </div>
                  <div className="parameter-card">
                    <span>挤压带宽 squeeze_bandwidth_pct</span>
                    <input
                      value={currentText(strategy, parameterDrafts, 'squeeze_bandwidth_pct')}
                      placeholder="留空即不覆盖"
                      onChange={(event) =>
                        onParameterDraftChange('squeeze_bandwidth_pct', event.target.value)
                      }
                    />
                  </div>
                </>
              )}

              {isRsiReversal && (
                <>
                  <div className="parameter-card">
                    <span>RSI 窗口 rsi_window</span>
                    <input
                      value={currentText(strategy, parameterDrafts, 'rsi_window')}
                      placeholder="留空即不覆盖"
                      onChange={(event) => onParameterDraftChange('rsi_window', event.target.value)}
                    />
                  </div>
                  <div className="parameter-card">
                    <span>超买阈值 rsi_overbought</span>
                    <input
                      value={currentText(strategy, parameterDrafts, 'rsi_overbought')}
                      placeholder="留空即不覆盖"
                      onChange={(event) => onParameterDraftChange('rsi_overbought', event.target.value)}
                    />
                  </div>
                  <div className="parameter-card">
                    <span>超卖阈值 rsi_oversold</span>
                    <input
                      value={currentText(strategy, parameterDrafts, 'rsi_oversold')}
                      placeholder="留空即不覆盖"
                      onChange={(event) => onParameterDraftChange('rsi_oversold', event.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {(hasParameterDraftChanges || riskBudgetChanged) && (
            <p className="panel-note">
              当前有未提交修改: 参数 {parameterDraftPatchCount} 项，风险预算 {riskBudgetChanged ? '已修改' : '未修改'}。
            </p>
          )}

          <div className="inline-actions">
            <button
              type="button"
              className="primary-button"
              disabled={!serviceAvailable || pending || !hasParameterDraftChanges}
              onClick={onSubmitParameterUpdate}
            >
              提交参数变更
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={!serviceAvailable || pending || !riskBudgetChanged}
              onClick={onSubmitRiskUpdate}
            >
              更新风控
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
