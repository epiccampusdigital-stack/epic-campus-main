'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseAttendance } from '@/lib/attendance/helpers'
import { parsePayment } from '@/lib/payments/helpers'
import { parseStudent } from '@/lib/students/helpers'
import { parseUtilityBill } from '@/lib/utility-bills/helpers'
import {
  computeAttendanceSummary,
  computeCoursePerformance,
  computeRevenueStats,
  computeUtilityExpenses,
  formatLKR,
  formatUSD,
  generateExcelReport,
  isInPeriod,
  paymentsToChartData,
  studentsToChartData,
  type ReportPeriod,
} from '@/lib/reports/helpers'
import type { AttendanceRecord, Payment, Student } from '@/types'
import type { UtilityBill } from '@/lib/utility-bills/helpers'

const RevenueChart = dynamic(() => import('@/components/reports/RevenueChart'), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-[#DDE3EC]" />,
})

const EnrollmentChart = dynamic(() => import('@/components/reports/EnrollmentChart'), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-[#DDE3EC]" />,
})

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

function StatCard({
  label,
  value,
  loading,
}: {
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-gray-400">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-8 w-28 animate-pulse rounded bg-[#DDE3EC]" />
      ) : (
        <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">{value}</p>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">{children}</h3>
  )
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('monthly')
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [utilityBills, setUtilityBills] = useState<UtilityBill[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [paymentsSnap, studentsSnap, attendanceSnap, utilitySnap] = await Promise.all([
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'attendance')),
        getDocs(collection(db, 'utilityBills')).catch(() => ({ docs: [] })),
      ])
      setPayments(
        paymentsSnap.docs.map((d) =>
          parsePayment(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setAttendance(
        attendanceSnap.docs.map((d) =>
          parseAttendance(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setUtilityBills(
        utilitySnap.docs.map((d) =>
          parseUtilityBill(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } catch (err) {
      console.error('[ReportsPage]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const revenueStats = useMemo(
    () => computeRevenueStats(payments, students, period),
    [payments, students, period],
  )

  const revenueChartData = useMemo(
    () => paymentsToChartData(payments, period),
    [payments, period],
  )

  const enrollmentChartData = useMemo(() => studentsToChartData(students), [students])

  const attendanceSummary = useMemo(
    () => computeAttendanceSummary(attendance),
    [attendance],
  )

  const coursePerformance = useMemo(
    () => computeCoursePerformance(students, payments, period),
    [students, payments, period],
  )

  const utilityExpenses = useMemo(
    () => computeUtilityExpenses(utilityBills, period),
    [utilityBills, period],
  )

  const utilityTotal = useMemo(
    () => utilityExpenses.reduce((sum, row) => sum + row.amount, 0),
    [utilityExpenses],
  )

  function handleExportPdf() {
    window.print()
  }

  function handleExportExcel() {
    const periodPayments = payments.filter(
      (p) => p.status !== 'cancelled' && isInPeriod(p.paymentDate, period),
    )
    generateExcelReport({
      revenue: periodPayments.map((p) => ({
        date: p.paymentDate.slice(0, 10),
        amount: p.amount,
        currency: p.currency,
        student: p.studentName,
      })),
      enrollments: enrollmentChartData
        .filter((e) => e.count > 0)
        .map((e) => ({ course: e.fullName, count: e.count })),
      attendance: attendanceSummary,
    })
  }

  return (
    <div id="reports-print" className="space-y-8">
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Reports</h2>
          <p className="font-inter text-sm text-[#5A6A7A]">Business intelligence</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-4 py-2 font-jakarta text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
          >
            <span className="ti ti-file-type-pdf" aria-hidden="true" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
          >
            <span className="ti ti-file-spreadsheet" aria-hidden="true" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="no-print flex gap-1 rounded-lg border border-[#DDE3EC] bg-white p-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`flex-1 rounded-md px-4 py-2 font-jakarta text-sm font-semibold transition-colors ${
              period === p.id
                ? 'bg-[#0B3D6B] text-white'
                : 'text-[#5A6A7A] hover:bg-[#F5F7FB]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section>
        <SectionTitle>Revenue Overview</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Revenue (LKR)"
            value={formatLKR(revenueStats.lkr)}
            loading={loading}
          />
          <StatCard
            label="Total Revenue (USD)"
            value={formatUSD(revenueStats.usd)}
            loading={loading}
          />
          <StatCard
            label="Avg Payment / Student"
            value={formatLKR(revenueStats.avgPerStudent)}
            loading={loading}
          />
          <StatCard
            label="Collection Rate"
            value={revenueStats.collectionRate}
            loading={loading}
          />
        </div>
      </section>

      <section className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <SectionTitle>Revenue Over Time</SectionTitle>
        <div className="mt-4">
          <RevenueChart data={revenueChartData} loading={loading} />
        </div>
      </section>

      <section className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <SectionTitle>Enrollments by Course</SectionTitle>
        <div className="mt-4">
          <EnrollmentChart data={enrollmentChartData} loading={loading} />
        </div>
      </section>

      <section className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <SectionTitle>Attendance Summary</SectionTitle>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <div className="h-32 animate-pulse rounded bg-[#DDE3EC]" />
          ) : attendanceSummary.length === 0 ? (
            <p className="text-sm text-[#5A6A7A]">No attendance data available.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  {['Course', 'Total Sessions', 'Avg Attendance Rate', 'Best Day', 'Worst Day'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {attendanceSummary.map((row) => (
                  <tr key={row.course}>
                    <td className="px-4 py-3 font-medium text-[#0D1B2A]">{row.course}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{row.totalSessions}</td>
                    <td className="px-4 py-3 text-[#0B3D6B] font-semibold">{row.avgRate}</td>
                    <td className="px-4 py-3 text-emerald-700">{row.bestDay}</td>
                    <td className="px-4 py-3 text-red-600">{row.worstDay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Expenses — Utilities</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[#DDE3EC]" />
            ))
          ) : (
            <>
              {utilityExpenses.map((row) => (
                <div
                  key={row.category}
                  className="rounded-xl border border-[#DDE3EC] bg-white p-5"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
                    {row.label}
                  </p>
                  <p className="mt-1 font-jakarta text-xl font-bold text-[#0B3D6B]">
                    {formatLKR(row.amount)}
                  </p>
                </div>
              ))}
              <div className="rounded-xl border border-[#E8A020]/40 bg-[#FFF8EB] p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
                  Utilities Total
                </p>
                <p className="mt-1 font-jakarta text-xl font-bold text-[#E8A020]">
                  {formatLKR(utilityTotal)}
                </p>
              </div>
            </>
          )}
        </div>
        {!loading && utilityTotal === 0 && (
          <p className="mt-3 text-sm text-[#5A6A7A]">
            No utility bills recorded for this period. Add bills in Utility Bills.
          </p>
        )}
      </section>

      <section>
        <SectionTitle>Course Performance</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-[#DDE3EC]" />
            ))
          ) : coursePerformance.length === 0 ? (
            <p className="text-sm text-[#5A6A7A]">No course data for this period.</p>
          ) : (
            coursePerformance.map((c) => (
              <div
                key={c.courseId}
                className="rounded-xl border border-[#DDE3EC] bg-white p-5"
              >
                <h4 className="font-jakarta font-bold text-[#0B3D6B]">{c.label}</h4>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase text-[#5A6A7A]">Enrolled</p>
                    <p className="font-semibold text-[#0D1B2A]">{c.enrolled}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-[#5A6A7A]">Active</p>
                    <p className="font-semibold text-[#0D1B2A]">{c.active}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-[#5A6A7A]">Completion</p>
                    <p className="font-semibold text-[#0D1B2A]">{c.completionRate}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-[#5A6A7A]">Revenue</p>
                    <p className="font-semibold text-[#E8A020]">{formatLKR(c.revenue)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
