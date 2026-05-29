'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  collection,
  query,
  getDocs,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { COURSE_MAP } from '@/lib/constants/courses'
import type { CourseId, Payment, Student } from '@/types'

interface DashboardStats {
  todayCollection: number
  activeStudents: number
  pendingPayments: number
  monthIncome: number
}

interface CourseEnrollment {
  label: string
  count: number
  target: number
}

const STATUS_STYLES: Record<Student['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  withdrawn: 'bg-red-50 text-red-700 border-red-200',
}

const PAYMENT_STATUS_STYLES: Record<Payment['status'], string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-orange-50 text-orange-700 border-orange-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseStudent(id: string, data: Record<string, unknown>): Student {
  const created = toDate(data.createdAt)
  const year = new Date().getFullYear()
  return {
    id,
    studentCode: String(data.studentCode ?? `EC-${year}-000`),
    uid: data.uid ? String(data.uid) : undefined,
    name: String(data.name ?? ''),
    nic: String(data.nic ?? ''),
    email: data.email ? String(data.email) : undefined,
    mobile: String(data.mobile ?? ''),
    courseId: data.courseId as CourseId,
    batchId: String(data.batchId ?? ''),
    branchId: String(data.branchId ?? ''),
    registrationFee: Number(data.registrationFee ?? data.feeAmount ?? 0),
    status: (data.status as Student['status']) ?? 'pending',
    visaStatus: data.visaStatus as Student['visaStatus'],
    createdAt: created?.toISOString() ?? new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
  }
}

function parsePayment(id: string, data: Record<string, unknown>): Payment {
  const created = toDate(data.createdAt)
  return {
    id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    amount: Number(data.amount ?? 0),
    type: (data.type as Payment['type']) ?? 'other',
    status: (data.status as Payment['status']) ?? 'pending',
    method: (data.method as Payment['method']) ?? 'cash',
    receiptNo: String(data.receiptNo ?? ''),
    notes: data.notes ? String(data.notes) : undefined,
    branchId: String(data.branchId ?? ''),
    createdAt: created?.toISOString() ?? new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
  }
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[#DDE3EC] bg-white p-5">
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    todayCollection: 0,
    activeStudents: 0,
    pendingPayments: 0,
    monthIncome: 0,
  })
  const [recentStudents, setRecentStudents] = useState<Student[]>([])
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [courseEnrollment, setCourseEnrollment] = useState<CourseEnrollment[]>([])

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const todayStart = Timestamp.fromDate(startOfToday())
        const monthStart = Timestamp.fromDate(startOfMonth())

        const [
          todaySnap,
          activeSnap,
          pendingSnap,
          monthSnap,
          studentsSnap,
          paymentsSnap,
          allStudentsSnap,
        ] = await Promise.all([
          getDocs(query(collection(db, 'payments'), where('createdAt', '>=', todayStart))),
          getDocs(query(collection(db, 'students'), where('status', '==', 'active'))),
          getDocs(query(collection(db, 'payments'), where('status', '==', 'pending'))),
          getDocs(query(collection(db, 'payments'), where('createdAt', '>=', monthStart))),
          getDocs(query(collection(db, 'students'), orderBy('createdAt', 'desc'), limit(10))),
          getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(5))),
          getDocs(collection(db, 'students')),
        ])

        let todayTotal = 0
        todaySnap.forEach((doc) => {
          todayTotal += Number(doc.data().amount ?? 0)
        })

        let monthTotal = 0
        monthSnap.forEach((doc) => {
          monthTotal += Number(doc.data().amount ?? 0)
        })

        setStats({
          todayCollection: todayTotal,
          activeStudents: activeSnap.size,
          pendingPayments: pendingSnap.size,
          monthIncome: monthTotal,
        })

        setRecentStudents(
          studentsSnap.docs.map((d) => parseStudent(d.id, d.data() as Record<string, unknown>))
        )

        setRecentPayments(
          paymentsSnap.docs.map((d) => parsePayment(d.id, d.data() as Record<string, unknown>))
        )

        const counts: Record<string, number> = {
          'japan-ssw': 0,
          'korea-d2d4': 0,
          china: 0,
          ielts: 0,
          nvq: 0,
        }

        allStudentsSnap.forEach((doc) => {
          const courseId = doc.data().courseId as string
          if (courseId === 'japan-ssw') counts['japan-ssw']++
          else if (courseId === 'korea-d2d4') counts['korea-d2d4']++
          else if (courseId === 'china') counts.china++
          else if (courseId === 'ielts') counts.ielts++
          else if (courseId?.startsWith('nvq-')) counts.nvq++
        })

        setCourseEnrollment([
          { label: 'Japan SSW', count: counts['japan-ssw'], target: 20 },
          { label: 'Korea D2/D4', count: counts['korea-d2d4'], target: 20 },
          { label: 'China Program', count: counts.china, target: 20 },
          { label: 'IELTS', count: counts.ielts, target: 20 },
          { label: 'NVQ (combined)', count: counts.nvq, target: 20 },
        ])
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  const statCards = [
    {
      label: "Today's Collection",
      value: formatLKR(stats.todayCollection),
      sub: 'Collected today',
    },
    {
      label: 'Active Students',
      value: String(stats.activeStudents),
      sub: 'Currently enrolled',
    },
    {
      label: 'Pending Payments',
      value: String(stats.pendingPayments),
      sub: 'Awaiting payment',
    },
    {
      label: 'This Month Income',
      value: formatLKR(stats.monthIncome),
      sub: 'Month to date',
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
      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-[#DDE3EC] border-l-[3px] border-l-[#E8A020] bg-white p-5"
              >
                <p className="font-inter text-xs uppercase tracking-wide text-[#5A6A7A]">
                  {card.label}
                </p>
                <p className="font-jakarta mt-2 text-[28px] font-bold leading-tight text-[#0D1B2A]">
                  {card.value}
                </p>
                <p className="mt-1 font-inter text-xs text-[#5A6A7A]">{card.sub}</p>
              </div>
            ))}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="font-jakarta mb-4 text-base font-bold text-[#0D1B2A]">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-xl border border-[#DDE3EC] bg-white p-5 transition-all hover:border-[#E8A020] hover:shadow-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#0B3D6B] text-white">
                <span className={`ti ${action.icon} text-lg`} aria-hidden="true" />
              </div>
              <p className="font-jakarta font-semibold text-[#0D1B2A]">{action.title}</p>
              <p className="mt-1 font-inter text-xs text-[#5A6A7A]">{action.subtitle}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Two column: students + enrollment */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
            <div className="border-b border-[#DDE3EC] px-5 py-4">
              <h2 className="font-jakarta text-base font-bold text-[#0D1B2A]">Recent Students</h2>
            </div>
            {loading ? (
              <TableSkeleton rows={6} />
            ) : recentStudents.length === 0 ? (
              <p className="p-8 text-center font-inter text-sm text-[#5A6A7A]">
                No students yet — register your first student
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-inter text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Name</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Course</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Batch</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentStudents.map((student) => {
                      const course = COURSE_MAP[student.courseId]
                      return (
                        <tr key={student.id} className="border-b border-[#DDE3EC] last:border-0">
                          <td className="px-5 py-3 font-medium text-[#0D1B2A]">{student.name}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE3EC] bg-[#F5F7FB] px-2.5 py-0.5 text-xs text-[#0B3D6B]">
                              {course?.flag} {course?.label.split(' ')[0] ?? student.courseId}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[#5A6A7A]">{student.batchId}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs capitalize ${STATUS_STYLES[student.status]}`}>
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
          <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
            <h2 className="font-jakarta mb-5 text-base font-bold text-[#0D1B2A]">Course Enrollment</h2>
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
                        <span className="text-[#0D1B2A]">{course.label}</span>
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

      {/* Recent payments */}
      <section>
        <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
          <div className="border-b border-[#DDE3EC] px-5 py-4">
            <h2 className="font-jakarta text-base font-bold text-[#0D1B2A]">Recent Payments</h2>
          </div>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : recentPayments.length === 0 ? (
            <p className="p-8 text-center font-inter text-sm text-[#5A6A7A]">
              No payments recorded yet — record your first payment
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-inter text-sm">
                <thead>
                  <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Receipt No</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Student</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Amount</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Type</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Method</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-[#DDE3EC] last:border-0">
                      <td className="px-5 py-3 font-medium text-[#0D1B2A]">{payment.receiptNo || '—'}</td>
                      <td className="px-5 py-3 text-[#0D1B2A]">{payment.studentName}</td>
                      <td className="px-5 py-3 font-medium text-[#0B3D6B]">{formatLKR(payment.amount)}</td>
                      <td className="px-5 py-3 capitalize text-[#5A6A7A]">{payment.type}</td>
                      <td className="px-5 py-3 capitalize text-[#5A6A7A]">{payment.method.replace('-', ' ')}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs capitalize ${PAYMENT_STATUS_STYLES[payment.status]}`}>
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
