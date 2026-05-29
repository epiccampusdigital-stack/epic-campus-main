import { Timestamp } from 'firebase/firestore'
import type { AttendanceRecord, AttendanceStatus, CourseId } from '@/types'

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function parseAttendance(id: string, data: Record<string, unknown>): AttendanceRecord {
  const created = toDate(data.createdAt)
  const dateRaw = data.date ?? data.createdAt
  const date = toDate(dateRaw)

  return {
    id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    studentCode: String(data.studentCode ?? ''),
    courseId: (data.courseId as CourseId) ?? 'ielts',
    courseName: String(data.courseName ?? ''),
    batchName: String(data.batchName ?? data.batchId ?? ''),
    date: date ? date.toISOString().slice(0, 10) : String(data.date ?? '').slice(0, 10),
    status: (data.status as AttendanceStatus) ?? 'present',
    sessionStart: String(data.sessionStart ?? '09:00'),
    sessionEnd: String(data.sessionEnd ?? '11:00'),
    notes: data.notes ? String(data.notes) : undefined,
    markedBy: String(data.markedBy ?? data.createdBy ?? ''),
    createdAt: created?.toISOString() ?? new Date().toISOString(),
  }
}

export function getAttendanceRate(records: AttendanceRecord[]): string {
  if (records.length === 0) return '0%'
  const attended = records.filter(
    (r) => r.status === 'present' || r.status === 'late',
  ).length
  return `${Math.round((attended / records.length) * 100)}%`
}

export function computeAttendanceStats(records: AttendanceRecord[]) {
  const present = records.filter((r) => r.status === 'present').length
  const absent = records.filter((r) => r.status === 'absent').length
  const late = records.filter((r) => r.status === 'late').length
  return {
    present,
    absent,
    late,
    rate: getAttendanceRate(records),
  }
}

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  excused: 'bg-sky-50 text-sky-700 border-sky-200',
}

export function getStatusColor(status: AttendanceStatus): string {
  return STATUS_STYLES[status] ?? STATUS_STYLES.present
}

export function getStatusLabel(status: AttendanceStatus): string {
  const labels: Record<AttendanceStatus, string> = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
  }
  return labels[status] ?? status
}

function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr ?? '0', 10)
  const m = mStr ?? '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

export function formatSessionTime(start: string, end: string): string {
  return `${formatTime12h(start)} - ${formatTime12h(end)}`
}

export function groupByDate(
  records: AttendanceRecord[],
): Record<string, AttendanceRecord[]> {
  return records.reduce<Record<string, AttendanceRecord[]>>((acc, record) => {
    const key = record.date.slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(record)
    return acc
  }, {})
}

export function formatAttendanceDate(date: string): string {
  const d = new Date(date.slice(0, 10) + 'T12:00:00')
  return d.toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
