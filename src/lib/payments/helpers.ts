import { Timestamp } from 'firebase/firestore'
import type { CourseId, Payment, PaymentMethod, PaymentStatus, PaymentType } from '@/types'

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

const LEGACY_TYPE_MAP: Record<string, PaymentType> = {
  course: 'tuition',
  hostel: 'other',
  registration: 'registration',
  exam: 'exam',
  other: 'other',
  tuition: 'tuition',
  visa: 'visa',
}

const LEGACY_METHOD_MAP: Record<string, PaymentMethod> = {
  cash: 'cash',
  'bank-transfer': 'bank-transfer',
  stripe: 'stripe',
  online: 'stripe',
  cheque: 'bank-transfer',
}

export function parsePayment(id: string, data: Record<string, unknown>): Payment {
  const created = toDate(data.createdAt)
  const paymentDateRaw = data.paymentDate ?? data.createdAt
  const paymentDate = toDate(paymentDateRaw)
  const receiptNumber = String(data.receiptNumber ?? data.receiptNo ?? '')
  const rawType = String(data.type ?? 'other')
  const rawMethod = String(data.method ?? 'cash')

  return {
    id,
    receiptNumber,
    receiptNo: receiptNumber,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    studentCode: data.studentCode ? String(data.studentCode) : undefined,
    courseId: data.courseId as CourseId | undefined,
    courseName: data.courseName ? String(data.courseName) : undefined,
    amount: Number(data.amount ?? 0),
    currency: (data.currency as Payment['currency']) ?? 'LKR',
    type: LEGACY_TYPE_MAP[rawType] ?? 'other',
    method: LEGACY_METHOD_MAP[rawMethod] ?? 'cash',
    bankReference: data.bankReference ? String(data.bankReference) : undefined,
    stripeId: data.stripeId ? String(data.stripeId) : undefined,
    status: (data.status as PaymentStatus) ?? 'pending',
    paymentDate: paymentDate?.toISOString() ?? created?.toISOString() ?? new Date().toISOString(),
    notes: data.notes ? String(data.notes) : undefined,
    branchId: String(data.branchId ?? ''),
    createdAt: created?.toISOString() ?? new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
  }
}

export async function generateReceiptNumber(existingCount: number): Promise<string> {
  const year = new Date().getFullYear()
  const seq = String(existingCount + 1).padStart(3, '0')
  return `REC-${year}-${seq}`
}

export function formatLKR(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatAmount(amount: number, currency: Payment['currency']): string {
  return currency === 'USD' ? formatUSD(amount) : formatLKR(amount)
}

export function getMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'cash':
      return 'Cash'
    case 'bank-transfer':
      return 'Bank Transfer'
    case 'stripe':
      return 'Online (Stripe)'
    default:
      return method
  }
}

export function getTypeLabel(type: PaymentType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function getStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'partial':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'pending':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

export function formatPaymentDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

export function isThisMonth(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

/** Placeholder — wire to Twilio/WhatsApp Business API later */
export async function sendPaymentWhatsApp(
  mobile: string,
  name: string,
  amount: string,
  receiptNumber: string,
): Promise<void> {
  const message = `Dear ${name}, your payment of ${amount} has been received. Receipt: ${receiptNumber}. Thank you - Epic Campus`
  console.info('[WhatsApp placeholder]', { mobile, message })
}

export const PAYMENT_STATS_DEFAULT = {
  todayCollection: 0,
  monthCollection: 0,
  pendingCount: 0,
  totalCollected: 0,
}

export function computePaymentStats(payments: Payment[]) {
  let todayCollection = 0
  let monthCollection = 0
  let pendingCount = 0
  let totalCollected = 0

  for (const p of payments) {
    if (p.status === 'pending' || p.status === 'partial') pendingCount++
    if (p.status === 'paid' || p.status === 'partial') {
      const lkrAmount = p.currency === 'LKR' ? p.amount : p.amount * 320
      totalCollected += lkrAmount
      if (isToday(p.paymentDate)) todayCollection += lkrAmount
      if (isThisMonth(p.paymentDate)) monthCollection += lkrAmount
    }
  }

  return { todayCollection, monthCollection, pendingCount, totalCollected }
}
