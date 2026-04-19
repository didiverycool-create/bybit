export function preferStrategyActivityValue<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value
    }
  }
  return null
}
