import { Timestamp } from 'firebase/firestore'
import { COURSE_MAP } from '@/lib/constants/courses'
import type {
  BookingStatus,
  CourseId,
  RecurringType,
  ScheduleSession,
  SessionStatus,
  SessionType,
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

export function parseSession(id: string, data: Record<string, unknown>): ScheduleSession {
  const created = toDate(data.createdAt)
  const dateRaw = data.date
  const date =
    typeof dateRaw === 'string'
      ? dateRaw.slice(0, 10)
      : toDate(dateRaw)?.toISOString().slice(0, 10) ?? ''

  const courseId = (data.courseId as CourseId) ?? 'ielts'

  return {
    id,
    type: (data.type as SessionType) ?? 'class',
    courseId,
    courseName: String(data.courseName ?? COURSE_MAP[courseId]?.label ?? ''),
    staffId: String(data.staffId ?? ''),
    staffName: String(data.staffName ?? ''),
    studentId: data.studentId ? String(data.studentId) : undefined,
    studentName: data.studentName ? String(data.studentName) : undefined,
    batchName: data.batchName ? String(data.batchName) : undefined,
    date,
    startTime: String(data.startTime ?? '09:00'),
    endTime: String(data.endTime ?? '10:00'),
    location: String(data.location ?? ''),
    notes: data.notes ? String(data.notes) : undefined,
    status: (data.status as SessionStatus) ?? 'scheduled',
    bookingStatus: data.bookingStatus as BookingStatus | undefined,
    isRecurring: Boolean(data.isRecurring),
    recurringType: (data.recurringType as RecurringType) ?? 'once',
    createdAt: created?.toISOString() ?? new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
  }
}

export function getSessionColor(type: SessionType): string {
  switch (type) {
    case 'class':
      return '#0B3D6B'
    case 'consultation':
      return '#E8A020'
    case 'exam':
      return '#DC2626'
    default:
      return '#0B3D6B'
  }
}

export function getSessionTypeLabel(type: SessionType): string {
  switch (type) {
    case 'class':
      return 'Class'
    case 'consultation':
      return 'Consultation'
    case 'exam':
      return 'Exam'
    default:
      return type
  }
}

export function getStatusLabel(status: SessionStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

export function getStatusColor(status: SessionStatus): string {
  switch (status) {
    case 'scheduled':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-[#F5F7FB] text-[#5A6A7A] border-[#DDE3EC]'
  }
}

export function getBookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'pending':
      return 'Pending Approval'
    case 'approved':
      return 'Approved'
    case 'declined':
      return 'Declined'
    default:
      return status
  }
}

function parseTimeParts(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

export function formatSessionTime(start: string, end: string): string {
  const fmt = (t: string) => {
    const { hours, minutes } = parseTimeParts(t)
    const d = new Date()
    d.setHours(hours, minutes, 0, 0)
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
  return `${fmt(start)} - ${fmt(end)}`
}

export function formatSessionDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function groupSessionsByDate(
  sessions: ScheduleSession[],
): Record<string, ScheduleSession[]> {
  const grouped: Record<string, ScheduleSession[]> = {}
  for (const s of sessions) {
    const key = s.date.slice(0, 10)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.startTime.localeCompare(b.startTime))
  }
  return grouped
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function isToday(date: string): boolean {
  return date.slice(0, 10) === new Date().toISOString().slice(0, 10)
}

export function isPastSession(session: ScheduleSession): boolean {
  const today = new Date().toISOString().slice(0, 10)
  if (session.date < today) return true
  if (session.date > today) return false
  const now = new Date()
  const { hours, minutes } = parseTimeParts(session.endTime)
  const end = new Date()
  end.setHours(hours, minutes, 0, 0)
  return now > end
}

export function dateToISO(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function addWeeks(iso: string, weeks: number): string {
  return addDays(iso, weeks * 7)
}

export function generateRecurringDates(
  startDate: string,
  recurringType: RecurringType,
  count = 12,
): string[] {
  if (recurringType === 'once') return [startDate]
  const dates = [startDate]
  for (let i = 1; i < count; i++) {
    dates.push(
      recurringType === 'daily' ? addDays(startDate, i) : addWeeks(startDate, i),
    )
  }
  return dates
}

export function countStudentsLabel(
  session: ScheduleSession,
  batchCounts: Record<string, number>,
): string {
  if (session.type === 'consultation') {
    if (session.studentName) return session.studentName
    if (session.bookingStatus === 'open') return 'Open slot'
    return '—'
  }
  if (session.batchName && batchCounts[session.batchName]) {
    return `${batchCounts[session.batchName]} students`
  }
  return session.batchName ?? '—'
}

export function isConsultationSlotAvailable(session: ScheduleSession): boolean {
  return (
    session.type === 'consultation' &&
    session.status === 'scheduled' &&
    (session.bookingStatus === 'open' || !session.studentId) &&
    !isPastSession(session)
  )
}
