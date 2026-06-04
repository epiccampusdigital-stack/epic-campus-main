import { filterStudentsByLocation } from '@/lib/locations/helpers'
import type { CourseId, Payment, Student, AttendanceRecord, StudentLocation } from '@/types'

export function monthKeyToRange(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split('-').map(Number)
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0)
  const end = new Date(y, m, 0, 23, 59, 59, 999)
  return { start, end }
}

export function isInMonth(iso: string, monthKey: string): boolean {
  return iso.slice(0, 7) === monthKey
}

export function matchesCourseFilter(
  courseId: CourseId | undefined,
  filter: CourseId | '',
): boolean {
  if (!filter) return true
  if (!courseId) return false
  return courseId === filter
}

export function paymentInMonth(p: Payment, monthKey: string): boolean {
  return isInMonth(p.paymentDate, monthKey) || isInMonth(p.createdAt, monthKey)
}

export function filterPayments(
  payments: Payment[],
  monthKey: string,
  courseFilter: CourseId | '',
): Payment[] {
  return payments.filter(
    (p) =>
      paymentInMonth(p, monthKey) &&
      matchesCourseFilter(p.courseId, courseFilter),
  )
}

export function filterStudents(
  students: Student[],
  courseFilter: CourseId | '',
  locationFilter: StudentLocation | '' = '',
): Student[] {
  let list = students
  if (courseFilter) list = list.filter((s) => s.courseId === courseFilter)
  return filterStudentsByLocation(list, locationFilter)
}

export function filterAttendance(
  records: AttendanceRecord[],
  monthKey: string,
  studentIds: Set<string>,
): AttendanceRecord[] {
  return records.filter(
    (r) => isInMonth(r.date, monthKey) && studentIds.has(r.studentId),
  )
}

export function getMonthPickerOptions(count = 12): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const d = new Date()
  for (let i = 0; i < count; i++) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const value = `${y}-${String(m).padStart(2, '0')}`
    options.push({
      value,
      label: d.toLocaleDateString('en-LK', { month: 'long', year: 'numeric' }),
    })
    d.setMonth(d.getMonth() - 1)
  }
  return options
}

export function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
