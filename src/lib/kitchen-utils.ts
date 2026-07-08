/**
 * Shared kitchen display helpers.
 */

/**
 * Format a stock/order quantity for display: round to max 2 decimals and strip
 * trailing zeros so floating-point noise like 4.699999999 shows as "4.7" and
 * 14.98499999 shows as "14.98". Optionally appends a unit.
 */
export function formatQty(val: number | undefined | null, unit?: string): string {
  if (val == null || isNaN(val)) return '0'
  // Round to max 2 decimal places, strip trailing zeros
  const rounded = Math.round(val * 100) / 100
  const str = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2).replace(/\.?0+$/, '')
  return unit ? `${str} ${unit}` : str
}
