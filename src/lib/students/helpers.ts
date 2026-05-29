import { Timestamp } from 'firebase/firestore'
import type { CourseId, Student } from '@/types'

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

export function parseStudent(id: string, data: Record<string, unknown>): Student {
  const created = toDate(data.createdAt)
  const year = new Date().getFullYear()
  return {
    id,
    studentCode: String(data.studentCode ?? `EC-${year}-${id.slice(0, 3).toUpperCase()}`),
    uid: data.uid ? String(data.uid) : undefined,
    name: String(data.name ?? ''),
    nic: String(data.nic ?? ''),
    email: data.email ? String(data.email) : undefined,
    mobile: String(data.mobile ?? ''),
    address: data.address ? String(data.address) : undefined,
    dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth) : undefined,
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
    courseId: (data.courseId as CourseId) ?? 'ielts',
    batchId: String(data.batchId ?? ''),
    branchId: String(data.branchId ?? ''),
    enrollmentDate: data.enrollmentDate ? String(data.enrollmentDate) : undefined,
    expectedCompletionDate: data.expectedCompletionDate
      ? String(data.expectedCompletionDate)
      : undefined,
    feeAmount: data.feeAmount != null ? Number(data.feeAmount) : undefined,
    feeCurrency: (data.feeCurrency as Student['feeCurrency']) ?? 'LKR',
    registrationFee: Number(data.registrationFee ?? data.feeAmount ?? 0),
    paymentStatus: (data.paymentStatus as Student['paymentStatus']) ?? 'pending',
    status: (data.status as Student['status']) ?? 'pending',
    visaStatus: (data.visaStatus as Student['visaStatus']) ?? 'not-started',
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: created?.toISOString() ?? new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
  }
}

export async function generateStudentCode(existingCount: number): Promise<string> {
  const year = new Date().getFullYear()
  const seq = String(existingCount + 1).padStart(3, '0')
  return `EC-${year}-${seq}`
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  let pwd = 'Epic'
  for (let i = 0; i < 8; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}

/** Placeholder — wire to Twilio/WhatsApp Business API later */
export async function sendWhatsAppNotification(
  mobile: string,
  message: string,
): Promise<void> {
  console.info('[WhatsApp placeholder]', { mobile, message })
}

/** Placeholder — wire to SendGrid/email service later */
export async function sendCredentialsEmail(
  email: string,
  name: string,
  password: string,
): Promise<void> {
  console.info('[Email placeholder]', { email, name, password: '***' })
}

export const STATUS_STYLES: Record<Student['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  withdrawn: 'bg-red-50 text-red-700 border-red-200',
}

export const PAYMENT_STATUS_STYLES: Record<
  NonNullable<Student['paymentStatus']>,
  string
> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-orange-50 text-orange-700 border-orange-200',
}

export const VISA_STATUS_STYLES: Record<
  NonNullable<Student['visaStatus']>,
  string
> = {
  'not-started': 'bg-gray-50 text-gray-600 border-gray-200',
  'in-progress': 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

export function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'ST'
  )
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
