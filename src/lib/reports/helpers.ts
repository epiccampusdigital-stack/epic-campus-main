import * as XLSX from 'xlsx'
import { COURSE_MAP, COURSES } from '@/lib/constants/courses'
import {
  CATEGORY_LABELS,
  sumByCategory,
  type UtilityBill,
  type UtilityBillCategory,
} from '@/lib/utility-bills/helpers'
import type { AttendanceRecord, CourseId, Payment, Student } from '@/types'

export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

export const COURSE_CHART_COLORS: Record<CourseId, string> = {
  'japan-ssw': '#0B3D6B',
  'korea-d2d4': '#E8A020',
  china: '#1a5fa8',
  ielts: '#10b981',
  'nvq-it': '#6366f1',
  'nvq-hospitality': '#f59e0b',
  'nvq-caregiving': '#ec4899',
  'nvq-construction': '#78716c',
  'nvq-logistics': '#14b8a6',
}

export function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

export function getPeriodStart(period: ReportPeriod, ref = new Date()): Date {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  if (period === 'daily') {
    d.setDate(d.getDate() - 29)
    return d
  }
  if (period === 'weekly') {
    d.setDate(d.getDate() - 7 * 11)
    return d
  }
  d.setMonth(d.getMonth() - 11)
  d.setDate(1)
  return d
}

export function isInPeriod(iso: string, period: ReportPeriod, ref = new Date()): boolean {
  const start = getPeriodStart(period, ref)
  const date = new Date(iso.slice(0, 10) + 'T12:00:00')
  return date >= start && date <= ref
}

export function formatPeriodLabel(date: string, period: ReportPeriod): string {
  const d = new Date(date.slice(0, 10) + 'T12:00:00')
  if (period === 'monthly') {
    return d.toLocaleDateString('en-LK', { month: 'short', year: 'numeric' })
  }
  if (period === 'weekly') {
    return `W/C ${d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })}`
  }
  return d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })
}

export function groupPaymentsByDate(
  payments: Payment[],
  period: ReportPeriod,
): Record<string, number> {
  const groups: Record<string, number> = {}

  for (const p of payments) {
    if (p.currency !== 'LKR' || p.status === 'cancelled') continue
    if (!isInPeriod(p.paymentDate, period)) continue

    const d = new Date(p.paymentDate.slice(0, 10) + 'T12:00:00')
    let key: string

    if (period === 'monthly') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    } else if (period === 'weekly') {
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(diff)
      key = toDateKey(monday.toISOString())
    } else {
      key = toDateKey(p.paymentDate)
    }

    groups[key] = (groups[key] ?? 0) + p.amount
  }

  return groups
}

export function paymentsToChartData(
  payments: Payment[],
  period: ReportPeriod,
): { date: string; amount: number; label: string }[] {
  const grouped = groupPaymentsByDate(payments, period)
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      date,
      amount,
      label: formatPeriodLabel(date, period),
    }))
}

export function groupStudentsByCourse(students: Student[]): Record<string, number> {
  const groups: Record<string, number> = {}
  for (const s of students) {
    const label = COURSE_MAP[s.courseId]?.label ?? s.courseId
    groups[label] = (groups[label] ?? 0) + 1
  }
  return groups
}

export function studentsToChartData(students: Student[]) {
  return COURSES.map((c) => ({
    course: c.label.split(' ')[0] + (c.label.includes('NVQ') ? ' NVQ' : ''),
    fullName: c.label,
    count: students.filter((s) => s.courseId === c.id).length,
    fill: COURSE_CHART_COLORS[c.id],
  }))
}

export function calculateCollectionRate(paid: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((paid / total) * 100)}%`
}

export function computeRevenueStats(payments: Payment[], students: Student[], period: ReportPeriod) {
  const inPeriod = payments.filter(
    (p) => p.status !== 'cancelled' && isInPeriod(p.paymentDate, period),
  )
  const lkr = inPeriod.filter((p) => p.currency === 'LKR').reduce((s, p) => s + p.amount, 0)
  const usd = inPeriod.filter((p) => p.currency === 'USD').reduce((s, p) => s + p.amount, 0)
  const payingStudents = new Set(inPeriod.map((p) => p.studentId)).size
  const avgPerStudent = payingStudents > 0 ? lkr / payingStudents : 0
  const paidStudents = students.filter((s) => s.paymentStatus === 'paid').length
  const collectionRate = calculateCollectionRate(paidStudents, students.length)

  return { lkr, usd, avgPerStudent, collectionRate, payingStudents }
}

export interface AttendanceCourseSummary {
  course: string
  totalSessions: number
  avgRate: string
  bestDay: string
  worstDay: string
}

export function computeAttendanceSummary(records: AttendanceRecord[]): AttendanceCourseSummary[] {
  const byCourse: Record<string, AttendanceRecord[]> = {}

  for (const r of records) {
    const key = r.courseName || r.courseId
    if (!byCourse[key]) byCourse[key] = []
    byCourse[key].push(r)
  }

  return Object.entries(byCourse).map(([course, recs]) => {
    const sessionKeys = new Set(recs.map((r) => `${r.date}|${r.sessionStart}|${r.sessionEnd}`))
    const byDate: Record<string, AttendanceRecord[]> = {}
    for (const r of recs) {
      const dk = r.date.slice(0, 10)
      if (!byDate[dk]) byDate[dk] = []
      byDate[dk].push(r)
    }

    const dateRates = Object.entries(byDate).map(([date, dayRecs]) => {
      const attended = dayRecs.filter((r) => r.status === 'present' || r.status === 'late').length
      return { date, rate: dayRecs.length ? attended / dayRecs.length : 0 }
    })

    dateRates.sort((a, b) => b.rate - a.rate)
    const avgAttended = recs.filter((r) => r.status === 'present' || r.status === 'late').length
    const avgRate = recs.length ? `${Math.round((avgAttended / recs.length) * 100)}%` : '0%'

    const fmt = (d: string) =>
      new Date(d + 'T12:00:00').toLocaleDateString('en-LK', {
        day: 'numeric',
        month: 'short',
      })

    return {
      course,
      totalSessions: sessionKeys.size,
      avgRate,
      bestDay: dateRates[0] ? fmt(dateRates[0].date) : '—',
      worstDay: dateRates[dateRates.length - 1] ? fmt(dateRates[dateRates.length - 1].date) : '—',
    }
  })
}

export interface CoursePerformance {
  courseId: CourseId
  label: string
  enrolled: number
  active: number
  completionRate: string
  revenue: number
}

export function computeCoursePerformance(
  students: Student[],
  payments: Payment[],
  period: ReportPeriod,
): CoursePerformance[] {
  return COURSES.map((c) => {
    const courseStudents = students.filter((s) => s.courseId === c.id)
    const active = courseStudents.filter((s) => s.status === 'active').length
    const completed = courseStudents.filter((s) => s.status === 'completed').length
    const enrolled = courseStudents.length
    const completionRate =
      enrolled > 0 ? `${Math.round((completed / enrolled) * 100)}%` : '0%'
    const revenue = payments
      .filter(
        (p) =>
          p.courseId === c.id &&
          p.currency === 'LKR' &&
          p.status !== 'cancelled' &&
          isInPeriod(p.paymentDate, period),
      )
      .reduce((s, p) => s + p.amount, 0)

    return {
      courseId: c.id,
      label: c.label,
      enrolled,
      active,
      completionRate,
      revenue,
    }
  }).filter((c) => c.enrolled > 0 || c.revenue > 0)
}

export function formatLKR(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export interface UtilityExpenseRow {
  category: UtilityBillCategory
  label: string
  amount: number
}

export function computeUtilityExpenses(
  bills: UtilityBill[],
  period: ReportPeriod,
  ref = new Date(),
): UtilityExpenseRow[] {
  const totals: Record<UtilityBillCategory, number> = {
    electricity: 0,
    water: 0,
    internet: 0,
    other: 0,
  }

  for (const bill of bills) {
    if (!isInPeriod(bill.billDate, period, ref)) continue
    totals[bill.category] += bill.amount
  }

  return (Object.keys(totals) as UtilityBillCategory[]).map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    amount: totals[category],
  }))
}

export function getUtilityTotalForMonth(bills: UtilityBill[], month: string): number {
  const totals = sumByCategory(bills, month)
  return totals.electricity + totals.water + totals.internet + totals.other
}

export interface ExcelReportData {
  revenue: { date: string; amount: number; currency: string; student: string }[]
  enrollments: { course: string; count: number }[]
  attendance: AttendanceCourseSummary[]
}

export function generateExcelReport(data: ExcelReportData, filename = 'epic-campus-report.xlsx'): void {
  const wb = XLSX.utils.book_new()

  const revenueSheet = XLSX.utils.json_to_sheet(
    data.revenue.map((r) => ({
      Date: r.date,
      Amount: r.amount,
      Currency: r.currency,
      Student: r.student,
    })),
  )
  XLSX.utils.book_append_sheet(wb, revenueSheet, 'Revenue')

  const enrollmentSheet = XLSX.utils.json_to_sheet(
    data.enrollments.map((e) => ({ Course: e.course, Enrollments: e.count })),
  )
  XLSX.utils.book_append_sheet(wb, enrollmentSheet, 'Enrollments')

  const attendanceSheet = XLSX.utils.json_to_sheet(
    data.attendance.map((a) => ({
      Course: a.course,
      'Total Sessions': a.totalSessions,
      'Avg Attendance Rate': a.avgRate,
      'Best Day': a.bestDay,
      'Worst Day': a.worstDay,
    })),
  )
  XLSX.utils.book_append_sheet(wb, attendanceSheet, 'Attendance')

  XLSX.writeFile(wb, filename)
}
