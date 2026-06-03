import { Timestamp } from 'firebase/firestore'
import { formatLKR } from '@/lib/payments/helpers'

export type UtilityBillCategory = 'electricity' | 'water' | 'internet' | 'other'

export interface UtilityBill {
  id: string
  category: UtilityBillCategory
  amount: number
  currency: 'LKR'
  billDate: string
  dueDate?: string
  photoUrl?: string
  notes: string
  addedBy: string
  addedByName: string
  createdAt: string
  month: string
}

export const CATEGORY_LABELS: Record<UtilityBillCategory, string> = {
  electricity: 'Electricity',
  water: 'Water',
  internet: 'Internet',
  other: 'Other',
}

export const CATEGORY_BADGE: Record<UtilityBillCategory, string> = {
  electricity: 'bg-amber-100 text-amber-800',
  water: 'bg-blue-100 text-blue-800',
  internet: 'bg-teal-100 text-teal-800',
  other: 'bg-gray-100 text-gray-700',
}

export function monthKeyFromDate(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getLastSixMonthKeys(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const value = `${y}-${String(m).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-LK', { month: 'long', year: 'numeric' })
    options.push({ value, label })
    d.setMonth(d.getMonth() - 1)
  }
  return options
}

function timestampToIso(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return String(value)
}

export function parseUtilityBill(id: string, data: Record<string, unknown>): UtilityBill {
  const billDate = timestampToIso(data.billDate)
  const dueDate = data.dueDate ? timestampToIso(data.dueDate) : undefined
  const createdAt = timestampToIso(data.createdAt) || new Date().toISOString()

  return {
    id,
    category: (data.category as UtilityBillCategory) ?? 'other',
    amount: Number(data.amount) || 0,
    currency: 'LKR',
    billDate,
    dueDate: dueDate || undefined,
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
    notes: String(data.notes ?? ''),
    addedBy: String(data.addedBy ?? ''),
    addedByName: String(data.addedByName ?? ''),
    createdAt,
    month: String(data.month ?? monthKeyFromDate(billDate || createdAt)),
  }
}

export function sumByCategory(
  bills: UtilityBill[],
  month: string,
): Record<UtilityBillCategory, number> {
  const totals: Record<UtilityBillCategory, number> = {
    electricity: 0,
    water: 0,
    internet: 0,
    other: 0,
  }
  for (const b of bills) {
    if (b.month !== month) continue
    totals[b.category] += b.amount
  }
  return totals
}

export function formatBillDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export { formatLKR }
