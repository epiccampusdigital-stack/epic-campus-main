import { Timestamp } from 'firebase/firestore'
import {
  COURSE_FEE_LKR,
  REGISTRATION_FEE_LKR,
} from '@/lib/payments/constants'
import type {
  BatchDuration,
  CourseBatchStatus,
  CourseId,
  Student,
  StudentFeeSchedule,
  StudentLocation,
} from '@/types'

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

export const AGENT_ROLES = ['reception', 'teacher', 'admin', 'owner', 'accountant'] as const

export const LOCATION_LABELS: Record<StudentLocation, string> = {
  ahangama: 'Ahangama',
  galle: 'Galle',
  waduraba: 'Waduraba',
  pinnaduwa: 'Pinnaduwa',
}

export const LOCATION_STYLES: Record<StudentLocation, string> = {
  ahangama: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-700',
  galle: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700',
  waduraba: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700',
  pinnaduwa:
    'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700',
}

export const BATCH_DURATION_LABELS: Record<BatchDuration, string> = {
  '45days': '45 days',
  '90days': '90 days',
  custom: 'Custom',
}

export function computeBatchEndDate(
  startDate: string,
  duration: BatchDuration,
  customDays?: number,
): string {
  const start = new Date(startDate)
  const end = new Date(start)
  if (duration === '45days') end.setDate(end.getDate() + 45)
  else if (duration === '90days') end.setDate(end.getDate() + 90)
  else if (duration === 'custom' && customDays && customDays > 0) {
    end.setDate(end.getDate() + customDays)
  }
  return end.toISOString().slice(0, 10)
}

export function getCourseBatchStatus(student: Student): CourseBatchStatus {
  if (!student.batchEndDate) return 'active'
  const end = new Date(student.batchEndDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  if (end < today) return 'overdue'
  if (student.status === 'completed') return 'completed'
  return 'active'
}

export const COURSE_BATCH_STATUS_STYLES: Record<CourseBatchStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200',
  overdue: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200',
}

export function defaultFeeSchedule(): StudentFeeSchedule {
  return {
    registration: { paid: false, amount: REGISTRATION_FEE_LKR },
    course: { paid: false, amount: COURSE_FEE_LKR },
    otherExpenses: [],
  }
}

function parseFeeSchedule(data: Record<string, unknown>): StudentFeeSchedule | undefined {
  const raw = data.feeSchedule
  if (!raw || typeof raw !== 'object') return undefined
  const fs = raw as Record<string, unknown>
  const reg = fs.registration as Record<string, unknown> | undefined
  const course = fs.course as Record<string, unknown> | undefined
  const others = Array.isArray(fs.otherExpenses) ? fs.otherExpenses : []
  return {
    registration: {
      paid: Boolean(reg?.paid),
      amount: Number(reg?.amount ?? REGISTRATION_FEE_LKR),
      method: reg?.method as StudentFeeSchedule['registration']['method'],
      paymentDate: reg?.paymentDate ? String(reg.paymentDate) : undefined,
      reference: reg?.reference ? String(reg.reference) : undefined,
      stripePaymentLinkUrl: reg?.stripePaymentLinkUrl
        ? String(reg.stripePaymentLinkUrl)
        : undefined,
    },
    course: {
      paid: Boolean(course?.paid),
      amount: Number(course?.amount ?? COURSE_FEE_LKR),
      method: course?.method as StudentFeeSchedule['course']['method'],
      paymentDate: course?.paymentDate ? String(course.paymentDate) : undefined,
      reference: course?.reference ? String(course.reference) : undefined,
      stripePaymentLinkUrl: course?.stripePaymentLinkUrl
        ? String(course.stripePaymentLinkUrl)
        : undefined,
    },
    otherExpenses: others.map((item, i) => {
      const o = item as Record<string, unknown>
      return {
        id: String(o.id ?? `other-${i}`),
        description: String(o.description ?? ''),
        amount: Number(o.amount ?? 0),
        paid: Boolean(o.paid),
        method: o.method as StudentFeeSchedule['otherExpenses'][0]['method'],
        paymentDate: o.paymentDate ? String(o.paymentDate) : undefined,
        reference: o.reference ? String(o.reference) : undefined,
        stripePaymentLinkUrl: o.stripePaymentLinkUrl
          ? String(o.stripePaymentLinkUrl)
          : undefined,
      }
    }),
  }
}

export function formatBatchSummary(student: Student): string {
  if (!student.batchDuration) return student.batchId || '—'
  const label = BATCH_DURATION_LABELS[student.batchDuration]
  const end = student.batchEndDate ? formatDate(student.batchEndDate) : '—'
  return `${label} · ends ${end}`
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
    batchDuration: data.batchDuration
      ? (data.batchDuration as BatchDuration)
      : undefined,
    batchCustomDays:
      data.batchCustomDays != null ? Number(data.batchCustomDays) : undefined,
    batchStartDate: data.batchStartDate
      ? (toDate(data.batchStartDate)?.toISOString().slice(0, 10) ??
        String(data.batchStartDate).slice(0, 10))
      : undefined,
    batchEndDate: data.batchEndDate
      ? (toDate(data.batchEndDate)?.toISOString().slice(0, 10) ??
        String(data.batchEndDate).slice(0, 10))
      : undefined,
    location: data.location ? (data.location as StudentLocation) : undefined,
    agentId: data.agentId ? String(data.agentId) : undefined,
    agentName: data.agentName ? String(data.agentName) : undefined,
    feeSchedule: parseFeeSchedule(data) ?? defaultFeeSchedule(),
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
  console.info('[Email placeholder]', { email, name, hasPassword: Boolean(password) })
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
