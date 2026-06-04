'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { parsePayment, getStatusColor } from '@/lib/payments/helpers'
import { parseStudent } from '@/lib/students/helpers'
import { parseAttendance } from '@/lib/attendance/helpers'
import { COURSES, COURSE_MAP } from '@/lib/constants/courses'
import {
  currentMonthKey,
  filterAttendance,
  filterPayments,
  filterStudents,
  getMonthPickerOptions,
} from '@/lib/dashboard/helpers'
import TeacherDashboard from '@/components/dashboard/TeacherDashboard'
import { useManagement } from '@/components/layout/ManagementContext'
import type { CourseId, Payment, Student, AttendanceRecord } from '@/types'

interface DashboardStats {
  monthIncome: number
  todayCollection: number
  activeStudents: number
  pendingPayments: number
  attendanceSessions: number
  attendancePresent: number
}

const STATUS_STYLES: Record<Student['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  withdrawn: 'bg-red-50 text-red-700 border-red-200',
}

const PAYMENT_STATUS_STYLES: Record<Payment['status'], string> = {
  paid: getStatusColor('paid'),
  partial: getStatusColor('partial'),
  pending: getStatusColor('pending'),
  cancelled: getStatusColor('cancelled'),
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
      <div className="mb-3 h-3 w-24 rounded bg-[#DDE3EC]" />
      <div className="mb-2 h-8 w-32 rounded bg-[#DDE3EC]" />
      <div className="h-3 w-20 rounded bg-[#DDE3EC]" />
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-[#DDE3EC]/60" />
      ))}
    </div>
  )
}

function isTodayInMonth(monthKey: string): boolean {
  return monthKey === currentMonthKey()
}

export default function DashboardPage() {
  const { user } = useManagement()
  const [loading, setLoading] = useState(true)
  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [allPayments, setAllPayments] = useState<Payment[]>([])
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsSnap, paymentsSnap, attendanceSnap] = await Promise.all([
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'attendance')),
      ])
      setAllStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setAllPayments(
        paymentsSnap.docs.map((d) =>
          parsePayment(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setAllAttendance(
        attendanceSnap.docs.map((d) =>
          parseAttendance(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'teacher') {
      setLoading(false)
      return
    }
    loadData()
  }, [loadData, user?.role])

  const filteredStudents = useMemo(
    () => filterStudents(allStudents, courseFilter),
    [allStudents, courseFilter],
  )

  const filteredPayments = useMemo(
    () => filterPayments(allPayments, monthFilter, courseFilter),
    [allPayments, monthFilter, courseFilter],
  )

  const studentIds = useMemo(
    () => new Set(filteredStudents.map((s) => s.id)),
    [filteredStudents],
  )

  const filteredAttendance = useMemo(
    () => filterAttendance(allAttendance, monthFilter, studentIds),
    [allAttendance, monthFilter, studentIds],
  )

  const stats = useMemo((): DashboardStats => {
    const today = new Date().toISOString().slice(0, 10)
    let monthIncome = 0
    let todayCollection = 0
    let pendingPayments = 0

    for (const p of filteredPayments) {
      if (p.status === 'pending' || p.status === 'partial') pendingPayments++
      if (p.status === 'paid' || p.status === 'partial') {
        const lkr = p.currency === 'USD' ? p.amount * 320 : p.amount
        monthIncome += lkr
        if (isTodayInMonth(monthFilter) && p.paymentDate.slice(0, 10) === today) {
          todayCollection += lkr
        }
      }
    }

    const activeStudents = filteredStudents.filter((s) => s.status === 'active').length
    const attendancePresent = filteredAttendance.filter((a) => a.status === 'present').length

    return {
      monthIncome,
      todayCollection,
      activeStudents,
      pendingPayments,
      attendanceSessions: filteredAttendance.length,
      attendancePresent,
    }
  }, [filteredPayments, filteredStudents, filteredAttendance, monthFilter])

  const pendingItems = useMemo(() => {
    const paymentPending = allPayments.filter((p) => {
      if (p.status !== 'pending' && p.status !== 'partial') return false
      if (!matchesCourseForPending(p, courseFilter)) return false
      return true
    })
    const studentPending = filteredStudents.filter(
      (s) => s.paymentStatus === 'pending' || s.paymentStatus === 'partial',
    )
    return { paymentPending, studentPending }
  }, [allPayments, filteredStudents, courseFilter])

  function matchesCourseForPending(p: Payment, filter: CourseId | ''): boolean {
    if (!filter) return true
    return p.courseId === filter
  }

  const recentStudents = useMemo(() => {
    return [...filteredStudents]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)
  }, [filteredStudents])

  const recentPayments = useMemo(() => {
    return [...filteredPayments]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
  }, [filteredPayments])

  const courseEnrollment = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of COURSES) counts[c.id] = 0
    for (const s of filteredStudents) {
      if (counts[s.courseId] != null) counts[s.courseId]++
    }
    return COURSES.map((c) => ({
      label: c.label,
      count: counts[c.id] ?? 0,
      target: 20,
    }))
  }, [filteredStudents])

  const monthOptions = useMemo(() => getMonthPickerOptions(12), [])

  if (user?.role === 'teacher') {
    return <TeacherDashboard />
  }

  const statCards = [
    {
      label: isTodayInMonth(monthFilter) ? "Today's Collection" : 'Month collection',
      value: formatLKR(
        isTodayInMonth(monthFilter) ? stats.todayCollection : stats.monthIncome,
      ),
      sub: isTodayInMonth(monthFilter) ? 'Paid today' : `Paid in ${monthFilter}`,
    },
    {
      label: 'Active Students',
      value: String(stats.activeStudents),
      sub: courseFilter ? 'In selected course' : 'All courses',
    },
    {
      label: 'Pending Payments',
      value: String(stats.pendingPayments),
      sub: 'In selected month & course',
    },
    {
      label: 'Month Income',
      value: formatLKR(stats.monthIncome),
      sub: monthFilter,
    },
    {
      label: 'Attendance (month)',
      value: `${stats.attendancePresent} / ${stats.attendanceSessions}`,
      sub: 'Present / sessions',
    },
  ]

  const quickActions = [
    { title: 'Register Student', subtitle: 'Add a new enrolment', href: '/students', icon: 'ti-user-plus' },
    { title: 'Record Payment', subtitle: 'Log a fee payment', href: '/payments', icon: 'ti-receipt' },
    { title: 'View Reports', subtitle: 'Financial summaries', href: '/reports', icon: 'ti-chart-pie' },
    { title: 'Audit Log', subtitle: 'Track all changes', href: '/audit-log', icon: 'ti-list-search' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-gray-600 dark:bg-gray-800 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
            Course / program
          </label>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value as CourseId | '')}
            className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">All courses</option>
            {COURSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flag} {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
            Month
          </label>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          aria-label="Month quick select"
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)
          : statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-[#DDE3EC] border-l-[3px] border-l-[#E8A020] bg-white p-5 dark:bg-gray-800"
              >
                <p className="font-inter text-xs uppercase tracking-wide text-[#5A6A7A]">
                  {card.label}
                </p>
                <p className="font-jakarta mt-2 text-[28px] font-bold leading-tight text-[#0D1B2A] dark:text-white">
                  {card.value}
                </p>
                <p className="mt-1 font-inter text-xs text-[#5A6A7A]">{card.sub}</p>
              </div>
            ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800">
        <div className="flex flex-col gap-3 border-b border-[#DDE3EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-600">
          <h2 className="font-jakarta text-base font-bold text-[#0D1B2A] dark:text-white">
            Pending & follow-up
          </h2>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value as CourseId | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            aria-label="Filter pending by course"
          >
            <option value="">All courses</option>
            {COURSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : pendingItems.paymentPending.length === 0 &&
          pendingItems.studentPending.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#5A6A7A]">No pending items for this course.</p>
        ) : (
          <div className="divide-y divide-[#DDE3EC] dark:divide-gray-600">
            {pendingItems.paymentPending.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <div>
                  <p className="font-medium text-[#0D1B2A] dark:text-white">{p.studentName}</p>
                  <p className="text-xs text-[#5A6A7A]">
                    Payment · {p.receiptNumber || p.type} · {formatLKR(p.amount)}
                  </p>
                </div>
                <Link
                  href="/payments"
                  className="text-sm font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
                >
                  Record payment →
                </Link>
              </div>
            ))}
            {pendingItems.studentPending.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <div>
                  <p className="font-medium text-[#0D1B2A] dark:text-white">{s.name}</p>
                  <p className="text-xs text-[#5A6A7A]">
                    Student fee · {COURSE_MAP[s.courseId]?.label} · {s.paymentStatus}
                  </p>
                </div>
                <Link
                  href={`/students/${s.id}`}
                  className="text-sm font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
                >
                  View student →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-jakarta mb-4 text-base font-bold text-[#0D1B2A] dark:text-white">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-xl border border-[#DDE3EC] bg-white p-5 transition-all hover:border-[#E8A020] hover:shadow-sm dark:bg-gray-800"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#0B3D6B] text-white">
                <span className={`ti ${action.icon} text-lg`} aria-hidden="true" />
              </div>
              <p className="font-jakarta font-semibold text-[#0D1B2A] dark:text-white">
                {action.title}
              </p>
              <p className="mt-1 font-inter text-xs text-[#5A6A7A]">{action.subtitle}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:bg-gray-800">
            <div className="border-b border-[#DDE3EC] px-5 py-4 dark:border-gray-600">
              <h2 className="font-jakarta text-base font-bold text-[#0D1B2A] dark:text-white">
                Recent Students
              </h2>
            </div>
            {loading ? (
              <TableSkeleton rows={6} />
            ) : recentStudents.length === 0 ? (
              <p className="p-8 text-center font-inter text-sm text-[#5A6A7A]">
                No students match filters
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-inter text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:bg-gray-900">
                      <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Name</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Course</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Batch</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentStudents.map((student) => {
                      const course = COURSE_MAP[student.courseId]
                      return (
                        <tr key={student.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-gray-600">
                          <td className="px-5 py-3 font-medium text-[#0D1B2A] dark:text-white">
                            {student.name}
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE3EC] bg-[#F5F7FB] px-2.5 py-0.5 text-xs text-[#0B3D6B]">
                              {course?.flag} {course?.label.split(' ')[0] ?? student.courseId}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[#5A6A7A]">{student.batchId}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs capitalize ${STATUS_STYLES[student.status]}`}
                            >
                              {student.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
            <h2 className="font-jakarta mb-5 text-base font-bold text-[#0D1B2A] dark:text-white">
              Course Enrollment
            </h2>
            {loading ? (
              <div className="animate-pulse space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 rounded bg-[#DDE3EC]/60" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {courseEnrollment.map((course) => {
                  const pct = Math.min(100, Math.round((course.count / course.target) * 100))
                  return (
                    <div key={course.label}>
                      <div className="mb-1.5 flex justify-between font-inter text-sm">
                        <span className="text-[#0D1B2A] dark:text-white">{course.label}</span>
                        <span className="text-[#5A6A7A]">
                          {course.count} / {course.target}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#DDE3EC]">
                        <div
                          className="h-full rounded-full bg-[#0B3D6B] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:bg-gray-800">
          <div className="border-b border-[#DDE3EC] px-5 py-4 dark:border-gray-600">
            <h2 className="font-jakarta text-base font-bold text-[#0D1B2A] dark:text-white">
              Recent Payments
            </h2>
          </div>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : recentPayments.length === 0 ? (
            <p className="p-8 text-center font-inter text-sm text-[#5A6A7A]">
              No payments in selected period
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-inter text-sm">
                <thead>
                  <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:bg-gray-900">
                    <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Receipt</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Student</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Amount</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-gray-600">
                      <td className="px-5 py-3 font-medium text-[#0D1B2A] dark:text-white">
                        {payment.receiptNumber || '—'}
                      </td>
                      <td className="px-5 py-3 text-[#0D1B2A] dark:text-white">{payment.studentName}</td>
                      <td className="px-5 py-3 font-medium text-[#0B3D6B]">{formatLKR(payment.amount)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs capitalize ${PAYMENT_STATUS_STYLES[payment.status]}`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
