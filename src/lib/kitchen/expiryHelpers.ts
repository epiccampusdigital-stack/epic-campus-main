import type { InventoryItem } from '@/types/kitchen'

export type ExpiryStatus = 'expired' | 'alert' | 'week' | 'safe' | 'none'

export function daysUntilExpiry(expiryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(`${expiryDate}T12:00:00`)
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000)
}

export function getExpiryStatus(item: InventoryItem): ExpiryStatus {
  if (!item.expiryDate) return 'none'
  const days = daysUntilExpiry(item.expiryDate)
  const alertDays = item.expiryAlertDays ?? 3
  if (days < 0) return 'expired'
  if (days <= alertDays) return 'alert'
  if (days <= 7) return 'week'
  return 'safe'
}

export function expirySortPriority(item: InventoryItem): number {
  const status = getExpiryStatus(item)
  if (status === 'expired') return 0
  if (status === 'alert') return 1
  if (status === 'week') return 2
  return 3
}

export function formatExpiryBadgeDate(expiryDate: string): string {
  const d = new Date(`${expiryDate}T12:00:00`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
