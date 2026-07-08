'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore'
import { redirect } from 'next/navigation'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
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
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'

interface Student {
  id: string
  courseId: string
  location: string
  status: string
  createdAt?: unknown
  visaStatus?: string
}

interface Payment {
  id: string
  amount?: number
  paymentDate?: string
  createdAt?: unknown
  status?: string
  installments?: Array<{ status: string; paidAt: unknown; amount: number }>
}

interface Attempt {
  id: string
  marks250: number
  percentage: number
  passMark?: number
}

const COURSE_LABELS: Record<string, string> = {
  'japan-ssw': 'Japan SSW',
  'korea-d2d4': 'Korea',
  'china': 'China',
  'ielts': 'IELTS',
  'nvq-it': 'NVQ IT',
  'nvq-hospitality': 'NVQ Hospitality',
  'nvq-caregiving': 'NVQ Caregiving',
  'nvq-construction': 'NVQ Construction',
  'nvq-logistics': 'NVQ Logistics',
}

const COURSE_COLORS = ['#0B3D6B', '#E8A020', '#1A6BAD', '#10b981', '#8b5cf6', '#f97316', '#ec4899', '#06b6d4', '#84cc16']

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: string; color: string; sub?: string
}) {
  return (
    <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">{label}</p>
          <p className={`mt-1 font-jakarta text-3xl font-black ${color}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/40">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.replace('text-', 'bg-').replace('[', '[').replace(']', ']')}/10`}>
          <span className={`ti ${icon} text-lg ${color}`} />
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { user } = useManagement()
  const [students, setStudents] = useState<Student[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'enrollment' | 'finance' | 'exams'>('overview')

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      try {
        const [studentsSnap, paymentsSnap, attemptsSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'payments')).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] })),
          getDocs(query(collection(db, 'examAttempts'), orderBy('finishedAt', 'desc'))).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] })),
        ])
        setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)))
        setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)))
        setAttempts(attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Attempt)))
      } catch (err) {
        console.error('[Reports]', err)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [user])

  const monthlyRevenue = useMemo(() => {
    const map: Record<string, number> = {}
    payments.forEach(plan => {
      plan.installments?.forEach(inst => {
        if (inst.paidAt) {
          try {
            const date = typeof inst.paidAt === 'object' && inst.paidAt !== null && 'toDate' in inst.paidAt
              ? (inst.paidAt as { toDate: () => Date }).toDate()
              : new Date(String(inst.paidAt))
            const key = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
            map[key] = (map[key] ?? 0) + (inst.amount ?? 0)
          } catch { /* skip */ }
        }
      })
    })
    return Object.entries(map)
      .map(([month, revenue]) => ({ month, revenue }))
      .slice(-6)
  }, [payments])

  // ── Derived stats ────────────────────────────────────────────────────────
  const activeStudents = students.filter(s => s.status === 'active')
  // Payment docs hold { totalFee, installments[] } (not a flat `amount`); sum paid
  // installments, falling back to a flat `amount` for legacy receipt docs.
  const totalRevenue = payments.reduce((sum, p) => {
    const installmentTotal = (p.installments ?? [])
      .filter((i) => i.paidAt)
      .reduce((is, i) => is + (Number(i.amount) || 0), 0)
    return sum + (installmentTotal || Number(p.amount) || 0)
  }, 0)
  const passedAttempts = attempts.filter(a => a.marks250 >= (a.passMark ?? 200))
  const passRate = attempts.length > 0 ? Math.round((passedAttempts.length / attempts.length) * 100) : 0

  // Enrollment by course
  const byCourse = Object.entries(COURSE_LABELS).map(([id, label], i) => ({
    name: label,
    students: students.filter(s => s.courseId === id).length,
    color: COURSE_COLORS[i],
  })).filter(c => c.students > 0)

  // Enrollment by location
  const byLocation = ['Ahangama', 'Galle', 'Waduraba', 'Pinnaduwa'].map(loc => ({
    name: loc,
    students: students.filter(s => s.location === loc).length,
  })).filter(l => l.students > 0)

  // Monthly enrollments (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const month = MONTHS[d.getMonth()]
    const year = d.getFullYear()
    const count = students.filter(s => {
      if (!s.createdAt) return false
      try {
        const created = typeof s.createdAt === 'object' && s.createdAt !== null && 'toDate' in s.createdAt
          ? (s.createdAt as { toDate: () => Date }).toDate()
          : new Date(String(s.createdAt))
        return created.getMonth() === d.getMonth() && created.getFullYear() === year
      } catch { return false }
    }).length
    return { month, count }
  })

  // Exam score distribution
  const scoreRanges = [
    { range: '0-100', count: attempts.filter(a => a.marks250 < 100).length },
    { range: '100-149', count: attempts.filter(a => a.marks250 >= 100 && a.marks250 < 150).length },
    { range: '150-199', count: attempts.filter(a => a.marks250 >= 150 && a.marks250 < 200).length },
    { range: '200-250', count: attempts.filter(a => a.marks250 >= 200).length },
  ]

  // Reports expose finance totals — only admin/owner/accountant may view this page.
  const allowedRoles = ['admin', 'owner', 'accountant']
  if (user && !allowedRoles.includes(user.role)) {
    redirect('/dashboard')
  }

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-48 rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Reports</h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">Enrollment, finance and exam analytics</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['overview', 'enrollment', 'finance', 'exams'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${
              activeTab === tab
                ? 'bg-[#0B3D6B] text-white'
                : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Students" value={students.length} icon="ti-users" color="text-[#0B3D6B]" sub={`${activeStudents.length} active`} />
            <StatCard label="Total Revenue" value={`LKR ${(totalRevenue / 1000).toFixed(0)}K`} icon="ti-coin" color="text-emerald-600" />
            <StatCard label="Exam Pass Rate" value={`${passRate}%`} icon="ti-trophy" color="text-[#E8A020]" sub={`${passedAttempts.length}/${attempts.length} attempts`} />
            <StatCard label="Courses Running" value={byCourse.length} icon="ti-book" color="text-purple-600" sub="active programs" />
          </div>

          {/* Enrollment trend */}
          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
            <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Enrollment Trend (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EC" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0B3D6B" strokeWidth={2} dot={{ fill: '#E8A020', r: 4 }} name="Students" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Course breakdown */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
              <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Students by Course</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byCourse} dataKey="students" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {byCourse.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
              <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Students by Location</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byLocation}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="students" fill="#0B3D6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Enrollment tab */}
      {activeTab === 'enrollment' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Enrolled" value={students.length} icon="ti-users" color="text-[#0B3D6B]" />
            <StatCard label="Active" value={activeStudents.length} icon="ti-circle-check" color="text-emerald-600" />
          </div>
          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
            <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Enrollment by Course</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCourse} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="students" radius={[0, 4, 4, 0]}>
                  {byCourse.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#DDE3EC] dark:border-white/[0.08]">
              <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Course Breakdown</h3>
            </div>
            {byCourse.map((course, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-[#DDE3EC]/50 dark:border-white/[0.04] last:border-0">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: course.color }} />
                <p className="flex-1 text-sm font-medium text-[#0D1B2A] dark:text-white">{course.name}</p>
                <div className="flex-1 h-2 rounded-full bg-[#DDE3EC] dark:bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${students.length > 0 ? (course.students / students.length) * 100 : 0}%`, backgroundColor: course.color }} />
                </div>
                <p className="w-16 text-right text-sm font-bold text-[#0D1B2A] dark:text-white">{course.students} students</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finance tab */}
      {activeTab === 'finance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Revenue" value={`LKR ${totalRevenue.toLocaleString('en-LK')}`} icon="ti-coin" color="text-emerald-600" />
            <StatCard label="Transactions" value={payments.length} icon="ti-credit-card" color="text-[#0B3D6B]" />
          </div>

          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Monthly Revenue</h3>
              <span className="text-xs text-[#5A6A7A] dark:text-white/50">Last 6 months</span>
            </div>
            {monthlyRevenue.length === 0 ? (
              <div className="py-8 text-center">
                <span className="ti ti-chart-bar text-3xl text-[#DDE3EC] dark:text-white/20" />
                <p className="mt-2 text-sm text-[#5A6A7A] dark:text-white/50">No payment data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyRevenue} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EC" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#5A6A7A' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#5A6A7A' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #DDE3EC', fontSize: '12px' }}
                    formatter={(v) => [`LKR ${Number(v ?? 0).toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#0B3D6B" radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fontSize: 9, fill: '#5A6A7A', formatter: (v) => Number(v ?? 0) > 0 ? `${(Number(v ?? 0)/1000).toFixed(0)}k` : '' }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Total Revenue (Collected)"
              value={`LKR ${totalRevenue.toLocaleString('en-LK')}`}
              icon="ti-coin"
              color="text-emerald-600"
              sub={`${payments.length} payment records`}
            />
            <StatCard
              label="Avg per Student"
              value={`LKR ${(students.length > 0 ? Math.round(totalRevenue / students.length) : 0).toLocaleString('en-LK')}`}
              icon="ti-user-dollar"
              color="text-[#0B3D6B]"
              sub={`${students.length} students`}
            />
          </div>
        </div>
      )}

      {/* Exams tab */}
      {activeTab === 'exams' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Attempts" value={attempts.length} icon="ti-pencil" color="text-[#0B3D6B]" />
            <StatCard label="Passed" value={passedAttempts.length} icon="ti-circle-check" color="text-emerald-600" />
            <StatCard label="Pass Rate" value={`${passRate}%`} icon="ti-trophy" color="text-[#E8A020]" />
            <StatCard label="Avg Score" value={attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.marks250, 0) / attempts.length) : 0} icon="ti-target" color="text-purple-600" sub="out of 250" />
          </div>
          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
            <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Score Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreRanges}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                  {scoreRanges.map((entry, i) => (
                    <Cell key={i} fill={i === 3 ? '#10b981' : i === 2 ? '#E8A020' : '#0B3D6B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex gap-4 justify-center text-xs text-[#5A6A7A] dark:text-white/50">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />200+ (Pass)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#E8A020]" />150-199</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#0B3D6B]" />Below 150</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
