export function formatLKR(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style:    'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-LK').format(n)
}
