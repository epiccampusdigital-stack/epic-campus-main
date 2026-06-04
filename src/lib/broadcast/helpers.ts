import { Timestamp } from 'firebase/firestore'
import { getCourseBatchStatus, parseStudent } from '@/lib/students/helpers'
import type {
  BroadcastAudience,
  BroadcastFilters,
  BroadcastLog,
  BroadcastMessage,
  BroadcastPaymentFilter,
  BroadcastRecipient,
  BroadcastStatus,
  Student,
} from '@/types'

export function toIso(value: unknown): string {
  if (!value) return new Date().toISOString()
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString()
  }
  return new Date().toISOString()
}

export function parseBroadcast(id: string, data: Record<string, unknown>): BroadcastMessage {
  const filters = (data.filters as Record<string, unknown>) ?? {}
  return {
    id,
    title: String(data.title ?? ''),
    message: String(data.message ?? ''),
    mediaUrl: data.mediaUrl ? String(data.mediaUrl) : undefined,
    mediaType: data.mediaType as BroadcastMessage['mediaType'],
    audience: (data.audience as BroadcastAudience) ?? 'all',
    filters: {
      location: Array.isArray(filters.location)
        ? (filters.location as BroadcastFilters['location'])
        : undefined,
      course: Array.isArray(filters.course)
        ? filters.course.map(String)
        : undefined,
      visaStatus: Array.isArray(filters.visaStatus)
        ? filters.visaStatus.map(String)
        : undefined,
      paymentStatus: filters.paymentStatus as BroadcastPaymentFilter | undefined,
      batchStatus: Array.isArray(filters.batchStatus)
        ? (filters.batchStatus as BroadcastFilters['batchStatus'])
        : undefined,
    },
    recipientCount: Number(data.recipientCount ?? 0),
    recipientNumbers: Array.isArray(data.recipientNumbers)
      ? data.recipientNumbers.map(String)
      : [],
    status: (data.status as BroadcastStatus) ?? 'draft',
    scheduledAt: data.scheduledAt ? toIso(data.scheduledAt) : undefined,
    sentAt: data.sentAt ? toIso(data.sentAt) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? ''),
    createdAt: toIso(data.createdAt),
  }
}

export function parseBroadcastLog(
  id: string,
  data: Record<string, unknown>,
): BroadcastLog {
  return {
    id,
    broadcastId: String(data.broadcastId ?? ''),
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    phone: String(data.phone ?? ''),
    status: (data.status as BroadcastLog['status']) ?? 'pending',
    error: data.error ? String(data.error) : undefined,
    sentAt: toIso(data.sentAt),
  }
}

export function hasValidPhone(mobile: string): boolean {
  const digits = mobile.replace(/\D/g, '')
  return digits.length >= 9
}

function matchesPaymentFilter(
  student: Student,
  filter?: BroadcastPaymentFilter,
): boolean {
  if (!filter) return true
  const status = student.paymentStatus ?? 'pending'
  if (filter === 'unpaid') return status === 'pending'
  return status === filter
}

export function filterStudentsForBroadcast(
  students: Student[],
  audience: BroadcastAudience,
  filters: BroadcastFilters,
): BroadcastRecipient[] {
  const eligible = students.filter(
    (s) => s.status !== 'withdrawn' && hasValidPhone(s.mobile),
  )

  const filtered =
    audience === 'all'
      ? eligible
      : eligible.filter((s) => {
          if (filters.location?.length && s.location) {
            if (!filters.location.includes(s.location)) return false
          } else if (filters.location?.length && !s.location) {
            return false
          }
          if (filters.course?.length && !filters.course.includes(s.courseId)) {
            return false
          }
          if (filters.visaStatus?.length) {
            const vs = s.visaStatus ?? 'not-started'
            if (!filters.visaStatus.includes(vs)) return false
          }
          if (!matchesPaymentFilter(s, filters.paymentStatus)) return false
          if (filters.batchStatus?.length) {
            const batch = getCourseBatchStatus(s)
            if (!filters.batchStatus.includes(batch)) return false
          }
          return true
        })

  return filtered.map((s) => ({
    studentId: s.id,
    studentName: s.name,
    phone: s.mobile.trim(),
  }))
}

export function buildWhatsAppPreview(
  message: string,
  mediaUrl?: string,
  mediaType?: BroadcastMessage['mediaType'],
): string {
  let preview = message.trim()
  if (mediaUrl && mediaType === 'image') {
    preview += '\n\n[Image attachment]'
  } else if (mediaUrl && mediaType === 'pdf') {
    preview += '\n\n[PDF attachment]'
  }
  return preview
}

export const BROADCAST_STATUS_STYLES: Record<BroadcastStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  scheduled: 'bg-amber-50 text-amber-800 border-amber-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  partial: 'bg-orange-50 text-orange-800 border-orange-200',
}

export const LOG_STATUS_STYLES: Record<BroadcastLog['status'], string> = {
  sent: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  pending: 'bg-slate-100 text-slate-600',
}

export function formatBroadcastDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function parseStudentsFromDocs(
  docs: { id: string; data: () => Record<string, unknown> }[],
): Student[] {
  return docs.map((d) => parseStudent(d.id, d.data()))
}
