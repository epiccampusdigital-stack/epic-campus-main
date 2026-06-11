import type { InventoryItem } from '@/types/kitchen'

export type ExpiryStatus = 'expired' | 'alert' | 'soon' | 'safe' | 'none'

export function daysUntilExpiry(expiryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(`${expiryDate.slice(0, 10)}T12:00:00`)
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000)
}

export function getExpiryStatus(item: InventoryItem): ExpiryStatus {
  if (!item.expiryDate) return 'none'
  const days = daysUntilExpiry(item.expiryDate)
  if (days < 0) return 'expired'
  const alertDays = item.expiryAlertDays ?? 3
  if (days <= alertDays) return 'alert'
  if (days <= 7) return 'soon'
  return 'safe'
}

export function getExpirySortKey(item: InventoryItem): number {
  const status = getExpiryStatus(item)
  const order: Record<ExpiryStatus, number> = {
    expired: 0,
    alert: 1,
    soon: 2,
    safe: 3,
    none: 4,
  }
  return order[status]
}

export function formatExpiryLabel(item: InventoryItem): { text: string; className: string } | null {
  if (!item.expiryDate) return null
  const status = getExpiryStatus(item)
  const date = item.expiryDate.slice(0, 10)
  switch (status) {
    case 'expired':
      return {
        text: `EXPIRED ${date}`,
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      }
    case 'alert':
      return {
        text: `Expires ${date}`,
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      }
    case 'soon':
      return {
        text: `Exp: ${date}`,
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      }
    default:
      return {
        text: `Exp: ${date}`,
        className: 'text-gray-400 text-[10px]',
      }
  }
}
