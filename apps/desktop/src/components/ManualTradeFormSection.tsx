import type { ManualTradeFormSectionProps } from './manualTradePanelTypes'

export default function ManualTradeFormSection({
  editingOrder,
  manualOrder,
  onManualOrderChange,
}: ManualTradeFormSectionProps) {
  return (
    <div className="field-grid">
      <label className="field">
        <span>方向</span>
        <select
          value={manualOrder.side}
          disabled={Boolean(editingOrder)}
          onChange={(event) =>
            onManualOrderChange({
              ...manualOrder,
              side: event.target.value as 'buy' | 'sell',
            })
          }
        >
          <option value="buy">买入</option>
          <option value="sell">卖出</option>
        </select>
      </label>
      <label className="field">
        <span>数量</span>
        <input
          value={manualOrder.quantity}
          onChange={(event) =>
            onManualOrderChange({
              ...manualOrder,
              quantity: event.target.value,
            })
          }
        />
      </label>
      <label className="field">
        <span>价格</span>
        <input
          value={manualOrder.price}
          onChange={(event) =>
            onManualOrderChange({
              ...manualOrder,
              price: event.target.value,
            })
          }
        />
      </label>
      <label className="field field--wide">
        <span>备注</span>
        <input
          value={manualOrder.note}
          onChange={(event) =>
            onManualOrderChange({
              ...manualOrder,
              note: event.target.value,
            })
          }
          placeholder="例如：盘中人工接管后的手动对冲"
        />
      </label>
    </div>
  )
}
