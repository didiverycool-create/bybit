type ShouldResetEditingOrderStateArgs = {
  editingOrderId: string | null
  editingOrder: unknown
}

export function shouldResetEditingOrderState({
  editingOrderId,
  editingOrder,
}: ShouldResetEditingOrderStateArgs) {
  return Boolean(editingOrderId && !editingOrder)
}
