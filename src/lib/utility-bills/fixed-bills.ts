import { Timestamp } from 'firebase/firestore'
import type { StudentLocation } from '@/types'

export type FixedBillCategory =
  | 'electricity'
  | 'water'
  | 'internet'
  | 'rent'
  | 'phone'

export const UTILITY_LOCATIONS: { id: StudentLocation; label: string }[] = [
  { id: 'ahangama', label: 'Ahangama' },
  { id: 'galle', label: 'Galle' },
  { id: 'waduraba', label: 'Waduraba' },
  { id: 'pinnaduwa', label: 'Pinnaduwa' },
]

export const FIXED_BILL_CATEGORY_LABELS: Record<FixedBillCategory, string> = {
  electricity: 'Electricity',
  water: 'Water',
  internet: 'Internet',
  rent: 'Rent',
  'phone': 'Phone/Mobile',
}

/** Default expected amounts (LKR) per location × category */
export const DEFAULT_EXPECTED_AMOUNTS: Record<
  StudentLocation,
  Record<FixedBillCategory, number>
> = {
  ahangama: {
    electricity: 45_000,
    water: 8_000,
    internet: 12_000,
    rent: 120_000,
    phone: 5_000,
  },
  galle: {
    electricity: 35_000,
    water: 6_000,
    internet: 10_000,
    rent: 90_000,
    phone: 4_000,
  },
  waduraba: {
    electricity: 25_000,
    water: 5_000,
    internet: 8_000,
    rent: 60_000,
    phone: 3_500,
  },
  pinnaduwa: {
    electricity: 22_000,
    water: 4_500,
    internet: 7_500,
    rent: 55_000,
    phone: 3_000,
  },
}

export const FIXED_BILL_CATEGORIES: FixedBillCategory[] = [
  'electricity',
  'water',
  'internet',
  'rent',
  'phone',
]

export interface FixedUtilityBill {
  id: string
  location: StudentLocation
  category: FixedBillCategory
  billName: string
  expectedAmount: number
  month: string
  paid: boolean
  actualAmount?: number
  paymentDate?: string
  receiptUrl?: string
  notes?: string
  stripeSessionId?: string
  stripePaymentLinkUrl?: string
  updatedAt?: string
}

export function fixedBillDocId(
  location: StudentLocation,
  category: FixedBillCategory,
  month: string,
): string {
  return `${location}_${category}_${month}`
}

function timestampToIso(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Timestamp) return value.toDate().toISOString().slice(0, 10)
  return undefined
}

export function parseFixedUtilityBill(
  id: string,
  data: Record<string, unknown>,
): FixedUtilityBill {
  return {
    id,
    location: (data.location as StudentLocation) ?? 'ahangama',
    category: (data.category as FixedBillCategory) ?? 'electricity',
    billName: String(data.billName ?? FIXED_BILL_CATEGORY_LABELS.electricity),
    expectedAmount: Number(data.expectedAmount ?? 0),
    month: String(data.month ?? ''),
    paid: Boolean(data.paid),
    actualAmount: data.actualAmount != null ? Number(data.actualAmount) : undefined,
    paymentDate: data.paymentDate ? String(data.paymentDate).slice(0, 10) : undefined,
    receiptUrl: data.receiptUrl ? String(data.receiptUrl) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    stripeSessionId: data.stripeSessionId ? String(data.stripeSessionId) : undefined,
    stripePaymentLinkUrl: data.stripePaymentLinkUrl
      ? String(data.stripePaymentLinkUrl)
      : undefined,
    updatedAt: timestampToIso(data.updatedAt),
  }
}

export function buildDefaultFixedBills(
  location: StudentLocation,
  month: string,
): Omit<FixedUtilityBill, 'id'>[] {
  return FIXED_BILL_CATEGORIES.map((category) => ({
    location,
    category,
    billName: FIXED_BILL_CATEGORY_LABELS[category],
    expectedAmount: DEFAULT_EXPECTED_AMOUNTS[location][category],
    month,
    paid: false,
  }))
}

export function summarizeFixedBills(bills: FixedUtilityBill[]) {
  const total = bills.length
  const paid = bills.filter((b) => b.paid).length
  const unpaid = total - paid
  const remaining = bills
    .filter((b) => !b.paid)
    .reduce((s, b) => s + b.expectedAmount, 0)
  return { total, paid, unpaid, remaining }
}
