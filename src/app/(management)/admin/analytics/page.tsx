'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, Timestamp } from 'firebase/firestore'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { COURSE_MAP } from '@/lib/constants/courses'
import { parseStudent } from '@/lib/students/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import type { CourseId, Student, VisaApplicationStatus } from '@/types'

const NAVY = '#0B3D6B'
const GOLD = '#E8A020'
const PIE_COLORS = [NAVY, GOLD, '#5A6A7A', '#25D366', '#E74C3C', '#3498DB']

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-LK', { month: 'short', year: '2-digit' })
}

function lastSixMonthKeys(): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(monthKey(d))
  }
  return keys
}

function examScoreRatio(data: Record<string, unknown>): number | null {
  const score = data.score != null ? Number(data.score) : data.totalScore != null ? Number(data.totalScore) : null
  const total = data.total != null ? Number(data.total) : data.maxScore != null ? Number(data.maxScore) : null
  if (score == null || total == null || total <= 0) return null
  return score / total
}

function mapStudentVisaStatus(status?: Student['visaStatus']): VisaApplicationStatus {
  switch (status) {
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    case 'in-progress':
      return 'processing'
    default:
      return 'documents'
  }
}

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string
  value: string
  sub?: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] border-l-[3px] border-l-[#E8A020] bg-white p-5">
      <p className="font-inter text-xs uppercase tracking-wide text-[#5A6A7A]">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-[#DDE3EC]" />
      ) : (
        <>
          <p className="font-jakarta mt-2 text-[28px] font-bold leading-tight text-[#0D1B2A]">{value}</p>
          {sub && <p className="mt-1 font-inter text-xs text-[#5A6A7A]">{sub}</p>}
        </>
      )}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
      <h3 className="font-jakarta mb-4 text-base font-bold text-[#0B3D6B]">{title}</h3>
      {children}
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { user, loading: authLoading, hasRole } = useManagement()
  const [loading, setLoading] = useState(true)
  const [totalStudents, setTotalStudents] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [avgPassRate, setAvgPassRate] = useState(0)
  const [activeVisas, setActiveVisas] = useState(0)
  const [intakeData, setIntakeData] = useState<{ month: string; count: number }[]>([])
  const [revenueByProgram, setRevenueByProgram] = useState<{ name: string; value: number }[]>([])
  const [passRateByPaper, setPassRateByPaper] = useState<{ paper: string; passRate: number }[]>([])
  const [visaBreakdown, setVisaBreakdown] = useState<{ name: string; value: number }[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (!(hasRole('admin') || hasRole('owner'))) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router, hasRole])

  useEffect(() => {
    if (authLoading || !user || !(hasRole('admin') || hasRole('owner'))) return

    async function load() {
      setLoading(true)
      try {
        const [studentsSnap, paymentsSnap, examSnap, visaSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'payments')),
          getDocs(collection(db, 'examResults')),
          getDocs(collection(db, 'visaApplications')),
        ])

        const students = studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        )
        setTotalStudents(students.length)

        let revenue = 0
        const programTotals: Record<string, number> = {}
        paymentsSnap.forEach((d) => {
          const data = d.data()
          const amount = Number(data.amount ?? 0)
          revenue += amount
          const program =
            String(data.courseName ?? '') ||
            COURSE_MAP[data.courseId as CourseId]?.label ||
            String(data.courseId ?? 'Other')
          programTotals[program] = (programTotals[program] ?? 0) + amount
        })
        setTotalRevenue(revenue)
        setRevenueByProgram(
          Object.entries(programTotals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value),
        )

        const ratios: number[] = []
        const paperStats: Record<string, { pass: number; total: number }> = {}
        examSnap.forEach((d) => {
          const data = d.data() as Record<string, unknown>
          const ratio = examScoreRatio(data)
          if (ratio != null) ratios.push(ratio)

          const paper =
            String(data.paperName ?? data.paperTitle ?? data.paperId ?? data.examTitle ?? 'Unknown')
          if (!paperStats[paper]) paperStats[paper] = { pass: 0, total: 0 }
          if (ratio != null) {
            paperStats[paper].total++
            if (ratio >= 0.6) paperStats[paper].pass++
          }
        })
        setAvgPassRate(ratios.length ? Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100) : 0)
        setPassRateByPaper(
          Object.entries(paperStats).map(([paper, s]) => ({
            paper,
            passRate: s.total ? Math.round((s.pass / s.total) * 100) : 0,
          })),
        )

        const monthKeys = lastSixMonthKeys()
        const intakeCounts: Record<string, number> = Object.fromEntries(monthKeys.map((k) => [k, 0]))
        students.forEach((s) => {
          const created = toDate(s.createdAt)
          if (!created) return
          const key = monthKey(created)
          if (key in intakeCounts) intakeCounts[key]++
        })
        setIntakeData(monthKeys.map((k) => ({ month: monthLabel(k), count: intakeCounts[k] })))

        const visaStatusCounts: Record<string, number> = {
          documents: 0,
          submitted: 0,
          processing: 0,
          approved: 0,
          rejected: 0,
        }

        if (visaSnap.size > 0) {
          let active = 0
          visaSnap.forEach((d) => {
            const status = String(d.data().status ?? 'documents') as VisaApplicationStatus
            if (status in visaStatusCounts) visaStatusCounts[status]++
            else visaStatusCounts.documents++
            if (status !== 'rejected') active++
          })
          setActiveVisas(active)
          setVisaBreakdown(
            Object.entries(visaStatusCounts)
              .filter(([, v]) => v > 0)
              .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })),
          )
        } else {
          let active = 0
          students.forEach((s) => {
            const mapped = mapStudentVisaStatus(s.visaStatus)
            visaStatusCounts[mapped]++
            if (s.visaStatus !== 'rejected') active++
          })
          setActiveVisas(active)
          setVisaBreakdown(
            Object.entries(visaStatusCounts)
              .filter(([, v]) => v > 0)
              .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })),
          )
        }
      } catch (err) {
        console.error('[AnalyticsPage]', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user, authLoading, hasRole])

  const isAuthorized = user && (hasRole('admin') || hasRole('owner'))

  const chartEmpty = useMemo(
    () => ({
      intake: !loading && intakeData.every((d) => d.count === 0),
      revenue: !loading && revenueByProgram.length === 0,
      exams: !loading && passRateByPaper.length === 0,
      visa: !loading && visaBreakdown.length === 0,
    }),
    [loading, intakeData, revenueByProgram, passRateByPaper, visaBreakdown],
  )

  if (authLoading || !isAuthorized) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Analytics Dashboard</h1>
        <p className="mt-1 text-sm text-[#5A6A7A]">Real-time insights from Firestore</p>
        <div className="mt-3 h-1 w-16 rounded-full bg-[#E8A020]" />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={String(totalStudents)} sub="All enrolments" loading={loading} />
        <StatCard label="Total Revenue" value={formatLKR(totalRevenue)} sub="Sum of all payments" loading={loading} />
        <StatCard label="Avg Pass Rate" value={`${avgPassRate}%`} sub="Across exam results" loading={loading} />
        <StatCard label="Active Visas" value={String(activeVisas)} sub="Non-rejected applications" loading={loading} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Student Intake by Month">
          {chartEmpty.intake ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-[#5A6A7A]">
              No intake data for the last 6 months
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={intakeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fill: '#5A6A7A', fontSize: 11 }} axisLine={{ stroke: '#DDE3EC' }} />
                <YAxis tick={{ fill: '#5A6A7A', fontSize: 11 }} axisLine={{ stroke: '#DDE3EC' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #DDE3EC', fontSize: 13 }}
                  formatter={(v) => [v, 'Students']}
                />
                <Bar dataKey="count" fill={NAVY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenue by Program">
          {chartEmpty.revenue ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-[#5A6A7A]">
              No payment data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueByProgram}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                >
                  {revenueByProgram.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #DDE3EC', fontSize: 13 }}
                  formatter={(v) => [formatLKR(Number(v ?? 0)), 'Revenue']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Exam Pass Rates by Paper">
          {chartEmpty.exams ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-[#5A6A7A]">
              No exam results yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={passRateByPaper} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="paper" tick={{ fill: '#5A6A7A', fontSize: 10 }} axisLine={{ stroke: '#DDE3EC' }} />
                <YAxis
                  tick={{ fill: '#5A6A7A', fontSize: 11 }}
                  axisLine={{ stroke: '#DDE3EC' }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #DDE3EC', fontSize: 13 }}
                  formatter={(v) => [`${v}%`, 'Pass Rate']}
                />
                <Bar dataKey="passRate" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Visa Status Breakdown">
          {chartEmpty.visa ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-[#5A6A7A]">
              No visa data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={visaBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {visaBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #DDE3EC', fontSize: 13 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>
    </div>
  )
}
