'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { auth, db } from '@/lib/firebase/client'
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
import ReceptionDashboard from '@/components/dashboard/ReceptionDashboard'
import StudentRiskAlertsWidget from '@/components/risk/StudentRiskAlertsWidget'
import LocationFilterSelect from '@/components/ui/LocationFilterSelect'
import { useManagement } from '@/components/layout/ManagementContext'
import { fetchUnreadPartnerNotifications } from '@/lib/partners/helpers'
import type { PartnerNotification } from '@/types'
import type { CourseId, Payment, Student, AttendanceRecord, StudentLocation } from '@/types'

interface DashboardStats {
  monthIncome: number
  todayCollection: number
  activeStudents: number
  pendingPayments: number
  attendanceSessions: number
  attendancePresent: number
  totalPendingFees: number
}

const STATUS_STYLES: Record<Student['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  completed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  withdrawn: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
}

const PAYMENT_STATUS_STYLES: Record<Payment['status'], string> = {
  paid: getStatusColor('paid'),
  partial: getStatusColor('partial'),
  pending: getStatusColor('pending'),
  cancelled: getStatusColor('cancelled'),
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-[12px] border border-white/90 dark:border-white/[0.08] bg-white/65 dark:bg-white/[0.05] backdrop-blur-2xl p-3 sm:p-[14px] transition-all duration-300">
      <div className="mb-3 h-3 w-24 rounded bg-[#DDE3EC] dark:bg-white/10" />
      <div className="mb-2 h-8 w-32 rounded bg-[#DDE3EC] dark:bg-white/10" />
      <div className="h-3 w-20 rounded bg-[#DDE3EC] dark:bg-white/10" />
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

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// Installment paidAt may be an ISO string (new records) or a Timestamp/{seconds}
// object (old records). Return a 'YYYY-MM-DD' day key for "paid today" checks.
function installmentDateKey(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  if (typeof value === 'object' && value !== null) {
    const v = value as { toDate?: () => Date; seconds?: number }
    if (typeof v.toDate === 'function') return v.toDate().toISOString().slice(0, 10)
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString().slice(0, 10)
  }
  return String(value).slice(0, 10)
}

interface KitchenOverview {
  monthCost: number
  lowStock: number
  pendingOrders: number
  weekWaste: number
  lastWeekWaste: number
}

interface DashExpense {
  amount: number
  category: string
  location: string
  month: string
}

interface FinanceAccom {
  rentPaid: number
  budget: number | null
  houseCount: number
  billsUtil: number
}

/** Additive finance/expense summary tile (Finance Overview + Expense Breakdown rows). */
function FinanceTile({
  label,
  value,
  valueClass,
  sub,
  borderColor,
  badge,
}: {
  label: string
  value: string
  valueClass: string
  sub?: string
  borderColor: string
  badge?: ReactNode
}) {
  return (
    <div
      className="card-hover rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:backdrop-blur-sm"
      style={{ borderTopWidth: 2, borderTopColor: borderColor }}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/40">{label}</p>
      <p className={`text-2xl font-black ${valueClass}`}>{value}</p>
      {badge && <div className="mt-1">{badge}</div>}
      {sub && <p className="mt-1 text-xs text-gray-500 dark:text-white/40">{sub}</p>}
    </div>
  )
}

function FinanceTileSkeleton() {
  return <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
}

export default function DashboardPage() {
  const { user, hasRole } = useManagement()
  const userRoles = user?.roles ?? []
  const isPureTeacher = userRoles.length > 0 && userRoles.every((r) => r === 'teacher')
  const isPureReception = userRoles.length > 0 && userRoles.every((r) => r === 'reception')
  // Finance visibility — income/expense/profit data is restricted to these roles only.
  const canSeeFinance = hasRole('admin') || hasRole('owner') || hasRole('accountant')
  const [loading, setLoading] = useState(true)
  const [kitchenOverview, setKitchenOverview] = useState<KitchenOverview | null>(null)
  const [accomOverview, setAccomOverview] = useState<{ rent: number; billsThis: number; billsPrev: number; budget: number | null; rentPaid: number } | null>(null)
  const [expensesThisMonth, setExpensesThisMonth] = useState<number | null>(null)
  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [locationFilter, setLocationFilter] = useState<StudentLocation | ''>('')
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [allPayments, setAllPayments] = useState<Payment[]>([])
  // FIX 5 — paid installments extracted from raw payment-plan docs (parsePayment
  // drops the installments array), used to count installment-level collections.
  const [installmentEntries, setInstallmentEntries] = useState<
    { studentId: string; courseId: string; amount: number; paidDate: string }[]
  >([])
  // FIX 2 — student ids whose payment plan has EVERY installment paid, even if the
  // student doc's paymentStatus field was never updated to 'paid' when the last
  // installment was marked. Combined with student-doc status for the paid count.
  const [fullyPaidPlanStudentIds, setFullyPaidPlanStudentIds] = useState<string[]>([])
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([])
  const [partnerNotifications, setPartnerNotifications] = useState<PartnerNotification[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<
    { id: string; displayName: string; email: string; requestedRole: string; createdAt: unknown }[]
  >([])
  // Which pending approval is currently being processed (approve/reject), for the spinner.
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null)
  const [staffCount, setStaffCount] = useState(0)
  const [pendingEnrollments, setPendingEnrollments] = useState(0)
  const [todayExamAttempts, setTodayExamAttempts] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)
  // Finance overview / expense breakdown tile data (all filter-aware).
  const [allExpenses, setAllExpenses] = useState<DashExpense[]>([])
  const [financeAccom, setFinanceAccom] = useState<FinanceAccom | null>(null)
  const [financeAccomLoading, setFinanceAccomLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [studentsSnap, paymentsSnap, attendanceSnap, staffSnap, enrollSnap, examSnap, consultSnap, expensesSnap] = await Promise.all([
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'attendance')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'enrollmentApplications'), where('status', '==', 'pending'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'examAttempts'), where('completedAt', '>=', todayStart))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'consultationRequests'), where('status', '==', 'pending'))).catch(() => ({ docs: [] })),
        // Additive: expenses for the Finance/Expense tiles. Resilient so a read
        // denial (e.g. teacher role) never breaks the rest of the dashboard load.
        getDocs(collection(db, 'expenses')).catch(() => ({ docs: [] as { data: () => Record<string, unknown> }[] })),
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
      // FIX 5 — capture paid installments from plan docs (keyed by student id) so
      // installment-level collections made today count toward Today's Collection.
      const instEntries: { studentId: string; courseId: string; amount: number; paidDate: string }[] = []
      const fullyPaidIds: string[] = []
      for (const d of paymentsSnap.docs) {
        const data = d.data() as Record<string, unknown>
        const insts = Array.isArray(data.installments)
          ? (data.installments as Array<Record<string, unknown>>)
          : null
        if (!insts) continue
        const sid = String(data.studentId ?? d.id)
        const courseId = String(data.courseId ?? data.program ?? '')
        // FIX 2 — a plan whose every installment carries a paidAt is a fully-paid
        // student, regardless of whether the student doc's paymentStatus was updated.
        if (insts.length > 0 && insts.every((inst) => inst.paidAt)) fullyPaidIds.push(sid)
        for (const inst of insts) {
          if (!inst.paidAt) continue
          instEntries.push({
            studentId: sid,
            courseId,
            amount: Number(inst.amount ?? 0),
            paidDate: installmentDateKey(inst.paidAt),
          })
        }
      }
      setInstallmentEntries(instEntries)
      setFullyPaidPlanStudentIds(fullyPaidIds)
      setAllAttendance(
        attendanceSnap.docs.map((d) =>
          parseAttendance(d.id, d.data() as Record<string, unknown>),
        ),
      )
      const staffDocs = staffSnap.docs.filter(d => {
        const role = String(d.data().role ?? '')
        return role !== 'student' && role !== '' && d.data().status === 'active'
      })
      setStaffCount(staffDocs.length)
      setPendingEnrollments(enrollSnap.docs.length)
      setTodayExamAttempts(examSnap.docs.length)
      setPendingConsultations(consultSnap.docs.length)
      setAllExpenses(
        expensesSnap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>
          return {
            amount: Number(data.amount || 0),
            category: String(data.category ?? ''),
            location: String(data.location ?? ''),
            month: String(data.month ?? ''),
          }
        }),
      )
      if (hasRole('admin') || hasRole('owner')) {
        setPartnerNotifications(await fetchUnreadPartnerNotifications())
        const appSnap = await getDocs(
          query(collection(db, 'pendingApprovals'), where('status', '==', 'pending'))
        ).catch(() => ({ docs: [] }))
        setPendingApprovals(
          appSnap.docs.map(d => ({ id: d.id, ...d.data() } as {
            id: string
            displayName: string
            email: string
            requestedRole: string
            createdAt: unknown
          })),
        )
      } else {
        setPartnerNotifications([])
        setPendingApprovals([])
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [hasRole])

  useEffect(() => {
    if (isPureTeacher) {
      setLoading(false)
      return
    }
    loadData()
  }, [loadData, isPureTeacher])

  useEffect(() => {
    if (!user || !(hasRole('admin') || hasRole('owner'))) return
    async function loadKitchen() {
      try {
        const today = new Date()
        const monthStr = today.toISOString().slice(0, 7)
        const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7)
        const lastWeekAgo = new Date(today); lastWeekAgo.setDate(today.getDate() - 14)
        const weekAgoStr = weekAgo.toISOString().slice(0, 10)
        const lastWeekAgoStr = lastWeekAgo.toISOString().slice(0, 10)

        const [mealSnap, wasteSnap, invSnap, orderSnap] = await Promise.all([
          getDocs(collection(db, 'mealLogs')),
          getDocs(collection(db, 'wasteLog')),
          getDocs(query(collection(db, 'inventory'), where('isActive', '==', true))),
          getDocs(query(collection(db, 'kitchenOrders'), where('status', '==', 'submitted'))),
        ])

        const monthCost = mealSnap.docs
          .filter((d) => d.data().date?.startsWith(monthStr))
          .reduce((s, d) => s + (Number(d.data().estimatedCost) || 0), 0)

        const weekWaste = wasteSnap.docs
          .filter((d) => d.data().date >= weekAgoStr)
          .reduce((s, d) => s + (Number(d.data().estimatedLoss) || 0), 0)

        const lastWeekWaste = wasteSnap.docs
          .filter((d) => d.data().date >= lastWeekAgoStr && d.data().date < weekAgoStr)
          .reduce((s, d) => s + (Number(d.data().estimatedLoss) || 0), 0)

        const lowStock = invSnap.docs.filter((d) => {
          const data = d.data()
          return Number(data.currentStock) <= Number(data.minStockLevel)
        }).length

        setKitchenOverview({
          monthCost,
          lowStock,
          pendingOrders: orderSnap.size,
          weekWaste,
          lastWeekWaste,
        })
      } catch {}
    }
    loadKitchen()
  }, [user, hasRole])

  useEffect(() => {
    if (!user || !(hasRole('admin') || hasRole('owner'))) return
    async function loadAccommodation() {
      try {
        const now = new Date()
        const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const prevDt = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const prevKey = `${prevDt.getFullYear()}-${String(prevDt.getMonth() + 1).padStart(2, '0')}`

        const housesSnap = await getDocs(collection(db, 'accommodations'))
        let rent = 0
        let billsThis = 0
        let billsPrev = 0
        let rentPaid = 0
        await Promise.all(
          housesSnap.docs.map(async (h) => {
            const monthlyRent = Number(h.data().monthlyRent || 0)
            rent += monthlyRent
            const [curSnap, prevSnap, rentSnap] = await Promise.all([
              getDoc(doc(db, 'accommodations', h.id, 'bills', curKey)).catch(() => null),
              getDoc(doc(db, 'accommodations', h.id, 'bills', prevKey)).catch(() => null),
              getDoc(doc(db, 'accommodations', h.id, 'rentPayments', curKey)).catch(() => null),
            ])
            if (curSnap?.exists()) billsThis += Number((curSnap.data() as { totalAmount?: number }).totalAmount || 0)
            if (prevSnap?.exists()) billsPrev += Number((prevSnap.data() as { totalAmount?: number }).totalAmount || 0)
            if (rentSnap?.exists() && (rentSnap.data() as { paid?: boolean }).paid) rentPaid += monthlyRent
          }),
        )
        const budgetSnap = await getDoc(doc(db, 'accommodationBudget', curKey)).catch(() => null)
        const budget = budgetSnap?.exists() ? Number((budgetSnap.data() as { budget?: number }).budget ?? 0) : null
        setAccomOverview({ rent, billsThis, billsPrev, budget, rentPaid })

        // Total tracked expenses for the current month (from the Expenses page).
        try {
          const expSnap = await getDocs(query(collection(db, 'expenses'), where('month', '==', curKey)))
          setExpensesThisMonth(expSnap.docs.reduce((s, d) => s + Number(d.data().amount || 0), 0))
        } catch {
          /* ignore — expenses card simply won't render */
        }
      } catch {
        /* ignore — card simply won't render */
      }
    }
    void loadAccommodation()
  }, [user, hasRole])

  // Finance tiles: rent paid + monthly budget + accommodation utility bills for the
  // SELECTED month/location. Separate effect (keyed on the filters) because rent
  // payments and bills live in per-month subcollections that must be re-read when
  // the month or location filter changes — the once-only loadData can't cover that.
  useEffect(() => {
    if (!user || !(hasRole('admin') || hasRole('owner') || hasRole('accountant') || hasRole('reception'))) {
      setFinanceAccomLoading(false)
      return
    }
    let cancelled = false
    async function loadFinanceAccom() {
      setFinanceAccomLoading(true)
      try {
        const housesSnap = await getDocs(collection(db, 'accommodations'))
        let rentPaid = 0
        let houseCount = 0
        let billsUtil = 0
        await Promise.all(
          housesSnap.docs.map(async (h) => {
            const data = h.data()
            const loc = String(data.location ?? '').toLowerCase()
            if (locationFilter && loc !== locationFilter) return
            houseCount++
            const [rentSnap, billSnap] = await Promise.all([
              getDoc(doc(db, 'accommodations', h.id, 'rentPayments', monthFilter)).catch(() => null),
              getDoc(doc(db, 'accommodations', h.id, 'bills', monthFilter)).catch(() => null),
            ])
            if (rentSnap?.exists() && (rentSnap.data() as { paid?: boolean }).paid) {
              rentPaid += Number(data.monthlyRent || 0)
            }
            if (billSnap?.exists()) {
              const b = billSnap.data() as { electricity?: number; water?: number; internet?: number }
              billsUtil += Number(b.electricity || 0) + Number(b.water || 0) + Number(b.internet || 0)
            }
          }),
        )
        const budgetSnap = await getDoc(doc(db, 'accommodationBudget', monthFilter)).catch(() => null)
        const budget = budgetSnap?.exists() ? Number((budgetSnap.data() as { budget?: number }).budget ?? 0) : null
        if (!cancelled) setFinanceAccom({ rentPaid, budget, houseCount, billsUtil })
      } catch {
        if (!cancelled) setFinanceAccom(null)
      } finally {
        if (!cancelled) setFinanceAccomLoading(false)
      }
    }
    void loadFinanceAccom()
    return () => { cancelled = true }
  }, [user, hasRole, monthFilter, locationFilter])

  useEffect(() => {
    if (
      user &&
      (hasRole('reception') || hasRole('teacher')) &&
      user.locationAssigned
    ) {
      setLocationFilter(user.locationAssigned)
    }
  }, [user, hasRole])

  const filteredStudents = useMemo(
    () => filterStudents(allStudents, courseFilter, locationFilter),
    [allStudents, courseFilter, locationFilter],
  )

  const filteredPayments = useMemo(() => {
    const byMonthCourse = filterPayments(allPayments, monthFilter, courseFilter)
    if (!locationFilter) return byMonthCourse
    const ids = new Set(filteredStudents.map((s) => s.id))
    return byMonthCourse.filter((p) => ids.has(p.studentId))
  }, [allPayments, monthFilter, courseFilter, locationFilter, filteredStudents])

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

    // FIX 1 + FIX 5 — installment-level payments from plan docs. parsePayment drops
    // the installments array, so plan docs contribute 0 to the loop above and the
    // real money (installments) was never summed into monthIncome — that's why the
    // tile only ever showed a single legacy payment. Add every installment paid in
    // the SELECTED month to monthIncome, and those paid today to todayCollection.
    // Scoped to the same course/location filters. Disjoint from the loop above:
    // legacy payment docs have no installments array, plan docs default to status
    // 'pending'/amount 0, so there is no double counting.
    {
      const scopedIds = new Set(filteredStudents.map((s) => s.id))
      const viewingCurrentMonth = isTodayInMonth(monthFilter)
      for (const inst of installmentEntries) {
        if (courseFilter && inst.courseId !== courseFilter) continue
        if (locationFilter && !scopedIds.has(inst.studentId)) continue
        if (inst.paidDate.slice(0, 7) === monthFilter) monthIncome += inst.amount
        if (viewingCurrentMonth && inst.paidDate === today) todayCollection += inst.amount
      }
    }

    const activeStudents = filteredStudents.filter((s) => s.status === 'active').length
    const attendancePresent = filteredAttendance.filter((a) => a.status === 'present').length
    const totalPendingFees = filteredStudents
      .filter((s) =>
        s.paymentStatus === 'partial' ||
        s.paymentStatus === 'pending'
      )
      .reduce((sum, s) => {
        // Use pendingAmount if set, else fall back to
        // feeAmount - paidAmount, else feeAmount
        const pending = s.pendingAmount
          ?? ((s.feeAmount ?? 0) - (s.paidAmount ?? 0))
        return sum + Math.max(0, pending)
      }, 0)

    return {
      monthIncome,
      todayCollection,
      activeStudents,
      pendingPayments,
      attendanceSessions: filteredAttendance.length,
      attendancePresent,
      totalPendingFees,
    }
  }, [filteredPayments, filteredStudents, filteredAttendance, monthFilter, installmentEntries, courseFilter, locationFilter])

  // FIX 2 — paid student count from BOTH sources, deduped: (1) student docs whose
  // paymentStatus is 'paid', and (2) students whose payment plan has every
  // installment paid but whose student doc was never updated. Scoped to the current
  // course/location filters so it stays consistent with the rest of the dashboard.
  const paidStudentCount = useMemo(() => {
    const scoped = new Set(filteredStudents.map((s) => s.id))
    const ids = new Set<string>()
    for (const s of filteredStudents) {
      if (s.paymentStatus === 'paid') ids.add(s.id)
    }
    for (const sid of fullyPaidPlanStudentIds) {
      if (scoped.has(sid)) ids.add(sid)
    }
    return ids.size
  }, [filteredStudents, fullyPaidPlanStudentIds])

  // Expense breakdown for the selected month + location (case-insensitive; a 'Both'
  // expense counts under any single-location filter).
  const financeExpense = useMemo(() => {
    const locMatch = (loc: string) => {
      if (!locationFilter) return true
      const l = loc.toLowerCase()
      return l === locationFilter || l === 'both'
    }
    const rows = allExpenses.filter((e) => e.month === monthFilter && locMatch(e.location))
    const total = rows.reduce((s, e) => s + e.amount, 0)
    const salary = rows.filter((e) => e.category === 'Salary').reduce((s, e) => s + e.amount, 0)
    const utility = rows
      .filter((e) => e.category.toLowerCase().includes('utilit') || e.category.toLowerCase().includes('telecom'))
      .reduce((s, e) => s + e.amount, 0)
    const excluded = new Set(['Salary', 'Utilities (CEB/Water/Internet)', 'Rent', 'Telecom'])
    const misc = rows.filter((e) => !excluded.has(e.category)).reduce((s, e) => s + e.amount, 0)
    return { total, salary, utility, misc }
  }, [allExpenses, monthFilter, locationFilter])

  const pendingItems = useMemo(() => {
    const scopedIds = new Set(filteredStudents.map((s) => s.id))
    const paymentPending = allPayments.filter((p) => {
      if (p.status !== 'pending' && p.status !== 'partial') return false
      if (!matchesCourseForPending(p, courseFilter)) return false
      if (locationFilter && !scopedIds.has(p.studentId)) return false
      return true
    })
    const studentPending = filteredStudents.filter(
      (s) => s.paymentStatus === 'pending' || s.paymentStatus === 'partial',
    )
    return { paymentPending, studentPending }
  }, [allPayments, filteredStudents, courseFilter, locationFilter])

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

  if (isPureTeacher) {
    return <TeacherDashboard showFinances={user?.showFinances ?? false} />
  }

  if (isPureReception) {
    return <ReceptionDashboard showFinances={user?.showFinances ?? false} />
  }

  const statCards: { label: string; value: string; sub: string; amber?: boolean; finance?: boolean }[] = [
    {
      label: isTodayInMonth(monthFilter) ? "Today's Collection" : 'Month collection',
      value: formatLKR(
        isTodayInMonth(monthFilter) ? stats.todayCollection : stats.monthIncome,
      ),
      sub: isTodayInMonth(monthFilter) ? 'Paid today' : `Paid in ${monthFilter}`,
      finance: true,
    },
    {
      label: 'Active Students',
      value: String(stats.activeStudents),
      sub: courseFilter ? 'In selected course' : 'All courses',
    },
    {
      label: 'Paid Students',
      value: String(paidStudentCount),
      sub: 'Fully paid (status or plan)',
    },
    {
      label: 'Pending Payments',
      value: String(stats.pendingPayments),
      sub: 'In selected month & course',
      finance: true,
    },
    {
      label: 'Month Income',
      value: formatLKR(stats.monthIncome),
      sub: monthFilter,
      finance: true,
    },
    {
      label: 'Attendance (month)',
      value: `${stats.attendancePresent} / ${stats.attendanceSessions}`,
      sub: 'Present / sessions',
    },
    // Total Pending Fees moved to the new Finance Overview row below.
  ].filter((c) => canSeeFinance || !c.finance)

  const quickActions = [
    { title: 'Register Student', subtitle: 'Add a new enrolment', href: '/students', icon: 'ti-user-plus' },
    { title: 'Record Payment', subtitle: 'Log a fee payment', href: '/payments', icon: 'ti-receipt' },
    { title: 'View Reports', subtitle: 'Financial summaries', href: '/reports', icon: 'ti-chart-pie' },
    { title: 'Audit Log', subtitle: 'Track all changes', href: '/audit-log', icon: 'ti-list-search' },
  ]

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          {getGreeting()}, {user?.displayName?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-[12px] border border-white/90 dark:border-white/[0.08] bg-white/65 dark:bg-white/[0.05] backdrop-blur-2xl p-4 transition-all duration-300 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
            Location
          </label>
          <LocationFilterSelect value={locationFilter} onChange={setLocationFilter} />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
            Course / program
          </label>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value as CourseId | '')}
            className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
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
          <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
            Month
          </label>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          />
        </div>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
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
                className="stat-card-glass card-hover p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/50">
                  {card.label}
                </p>
                <p className={`mt-2 font-jakarta text-xl font-black leading-tight sm:text-2xl ${
                  card.amber ? 'text-amber-600 dark:text-amber-400' : 'text-[#0B3D6B] dark:text-[#E8A020]'
                }`}>
                  {card.value}
                </p>
                <p className={`mt-1 text-[11px] font-medium ${
                  card.amber ? 'text-amber-600/70 dark:text-amber-400/60' : 'text-green-600 dark:text-green-400'
                }`}>{card.sub}</p>
              </div>
            ))}

        {/* Staff count */}
        <Link href="/staff" className="stat-card-glass card-hover p-6 block">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/50">Active Staff</p>
          {loading ? <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" /> : (
            <>
              <p className="mt-2 font-jakarta text-2xl font-black text-[#0B3D6B] dark:text-[#E8A020]">{staffCount}</p>
              <p className="mt-1 font-inter text-xs text-[#5A6A7A] dark:text-white/40">Team members</p>
            </>
          )}
        </Link>

        {/* Pending enrollments */}
        {(hasRole('admin') || hasRole('owner')) && (
          <Link href="/enrollments" className="card-hover rounded-2xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-md p-6 block">
            <p className="font-inter text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">Pending Enrollments</p>
            {loading ? <div className="mt-2 h-8 w-16 animate-pulse rounded bg-amber-200/50" /> : (
              <>
                <p className="mt-1 font-jakarta text-2xl font-bold text-amber-700 dark:text-amber-300">{pendingEnrollments}</p>
                <p className="mt-1 font-inter text-xs text-amber-600/70 dark:text-amber-400/60">Awaiting approval</p>
              </>
            )}
          </Link>
        )}

        {/* Today's exam attempts */}
        <Link href="/exam-results" className="stat-card-glass card-hover p-6 block">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/50">Exams Today</p>
          {loading ? <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" /> : (
            <>
              <p className="mt-2 font-jakarta text-2xl font-black text-[#0B3D6B] dark:text-[#E8A020]">{todayExamAttempts}</p>
              <p className="mt-1 font-inter text-xs text-[#5A6A7A] dark:text-white/40">Attempts today</p>
            </>
          )}
        </Link>

        {/* Pending consultations */}
        {(hasRole('admin') || hasRole('owner')) && (
          <Link href="/consultations/requests" className="card-hover rounded-2xl border border-blue-200/80 dark:border-blue-800/50 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-md p-6 block">
            <p className="font-inter text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">Consultations</p>
            {loading ? <div className="mt-2 h-8 w-16 animate-pulse rounded bg-blue-200/50" /> : (
              <>
                <p className="mt-1 font-jakarta text-2xl font-bold text-blue-700 dark:text-blue-300">{pendingConsultations}</p>
                <p className="mt-1 font-inter text-xs text-blue-600/70 dark:text-blue-400/60">Pending requests</p>
              </>
            )}
          </Link>
        )}
      </section>

      {/* ── FINANCE OVERVIEW ── (finance roles only: admin / owner / accountant) */}
      {canSeeFinance && (
      <div>
        <p className="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30">
          Finance Overview
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <FinanceTileSkeleton key={i} />)
          ) : (
            <>
              <FinanceTile
                label="Total Income This Month"
                value={formatLKR(stats.monthIncome)}
                valueClass="text-[#059669]"
                sub="From student payments"
                borderColor="#059669"
              />
              <FinanceTile
                label="Total Expenses This Month"
                value={formatLKR(financeExpense.total)}
                valueClass="text-[#dc2626]"
                sub="Salaries + utilities + misc"
                borderColor="#dc2626"
              />
              {(() => {
                const net = stats.monthIncome - financeExpense.total
                const badge =
                  net > 0 ? (
                    <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/20 dark:text-green-400">Profit ↑</span>
                  ) : net < 0 ? (
                    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">Loss ↓</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">Break even</span>
                  )
                return (
                  <FinanceTile
                    label="Net Profit / Loss"
                    value={formatLKR(net)}
                    valueClass={net > 0 ? 'text-[#059669]' : net < 0 ? 'text-[#dc2626]' : 'text-[#E8A020]'}
                    sub="Income minus expenses"
                    borderColor="#E8A020"
                    badge={badge}
                  />
                )
              })()}
              <FinanceTile
                label="Total Pending Fees"
                value={formatLKR(stats.totalPendingFees)}
                valueClass="text-[#d97706]"
                sub="Outstanding on partial payments"
                borderColor="#d97706"
              />
            </>
          )}
        </div>

        {/* ── EXPENSE BREAKDOWN ── */}
        <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30">
          Expense Breakdown
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {loading || financeAccomLoading ? (
            Array.from({ length: 4 }).map((_, i) => <FinanceTileSkeleton key={i} />)
          ) : (
            <>
              {(() => {
                const rentPaid = financeAccom?.rentPaid ?? 0
                const budget = financeAccom?.budget ?? null
                const houses = financeAccom?.houseCount ?? 0
                const badge =
                  budget == null ? (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-white/[0.08] dark:text-white/50">No budget set</span>
                  ) : rentPaid < budget ? (
                    <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/20 dark:text-green-400">Under budget</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">Over budget</span>
                  )
                return (
                  <FinanceTile
                    label="Accommodation This Month"
                    value={formatLKR(rentPaid)}
                    valueClass="text-[#0B3D6B] dark:text-[#E8A020]"
                    sub={`${houses} house${houses === 1 ? '' : 's'} · Budget: ${budget != null ? formatLKR(budget) : '—'}`}
                    borderColor="#0B3D6B"
                    badge={badge}
                  />
                )
              })()}
              <FinanceTile
                label="Salary Expenses"
                value={formatLKR(financeExpense.salary)}
                valueClass="text-[#0B3D6B] dark:text-[#E8A020]"
                sub="Staff salaries this month"
                borderColor="#0B3D6B"
              />
              <FinanceTile
                label="Utility Bills"
                value={formatLKR(financeExpense.utility + (financeAccom?.billsUtil ?? 0))}
                valueClass="text-[#0B3D6B] dark:text-[#E8A020]"
                sub="CEB + Water + Internet"
                borderColor="#0B3D6B"
              />
              <FinanceTile
                label="Miscellaneous Expenses"
                value={formatLKR(financeExpense.misc)}
                valueClass="text-[#0B3D6B] dark:text-[#E8A020]"
                sub="Other expenses this month"
                borderColor="#0B3D6B"
              />
            </>
          )}
        </div>
      </div>
      )}

      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white/65 dark:bg-white/[0.05] backdrop-blur-2xl p-4">
        <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50 mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: '+ Add Student', href: '/enrollments', icon: 'ti-user-plus', color: 'bg-[#0B3D6B] text-white' },
            { label: '+ Add Staff', href: '/staff', icon: 'ti-id-badge', color: 'bg-[#1A6BAD] text-white' },
            { label: 'Create Exam', href: '/admin-exams', icon: 'ti-writing', color: 'bg-[#E8A020] text-[#0B3D6B]' },
            { label: 'AI Questions', href: '/admin-exams/ai-builder', icon: 'ti-sparkles', color: 'bg-purple-600 text-white' },
            { label: 'Broadcast', href: '/broadcast', icon: 'ti-speakerphone', color: 'bg-emerald-600 text-white' },
            { label: 'Reports', href: '/reports', icon: 'ti-chart-bar', color: 'bg-[#0B3D6B]/80 text-white' },
          ].filter(a => {
            if (a.href === '/staff' && !(hasRole('admin') || hasRole('owner'))) return false
            if (a.href === '/broadcast' && !(hasRole('admin') || hasRole('owner') || hasRole('reception'))) return false
            return true
          }).map(action => (
            <Link key={action.href} href={action.href}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-80 ${action.color}`}>
              <span className={`ti ${action.icon}`} />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {pendingApprovals.length > 0 && (hasRole('admin') || hasRole('owner')) && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="ti ti-user-check text-xl text-amber-600" />
            <h3 className="font-jakarta font-bold text-amber-800 dark:text-amber-400">
              {pendingApprovals.length} Pending Approval{pendingApprovals.length > 1 ? 's' : ''}
            </h3>
          </div>
          <div className="space-y-2">
            {pendingApprovals.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-white/[0.04] px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">{a.displayName}</p>
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40">{a.email} — wants to join as {a.requestedRole}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button"
                    disabled={approvalBusyId === a.id}
                    onClick={async () => {
                      setApprovalBusyId(a.id)
                      try {
                        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
                        await updateDoc(doc(db, 'pendingApprovals', a.id), { status: 'rejected', updatedAt: serverTimestamp() })
                        setPendingApprovals(prev => prev.filter(x => x.id !== a.id))
                        toast.success('Request rejected')
                      } catch (err) {
                        console.error('[Approvals] reject failed', err)
                        toast.error(err instanceof Error ? err.message : 'Could not reject request')
                      } finally {
                        setApprovalBusyId(null)
                      }
                    }}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Reject
                  </button>
                  <button type="button"
                    disabled={approvalBusyId === a.id}
                    onClick={async () => {
                      setApprovalBusyId(a.id)
                      try {
                        // The create-account route requires a staff Bearer token — without
                        // it the call 401s and the approval silently no-ops (the original bug).
                        const token = await auth.currentUser?.getIdToken()
                        if (!token) throw new Error('Not signed in — please reload and try again.')
                        const res = await fetch('/api/students/create-account', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            email: a.email,
                            displayName: a.displayName,
                            role: a.requestedRole === 'staff' ? 'teacher' : 'student',
                          }),
                        })
                        const data = (await res.json().catch(() => ({}))) as { error?: string }
                        if (!res.ok) throw new Error(data.error || `Approval failed (${res.status})`)
                        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
                        await updateDoc(doc(db, 'pendingApprovals', a.id), { status: 'approved', updatedAt: serverTimestamp() })
                        setPendingApprovals(prev => prev.filter(x => x.id !== a.id))
                        toast.success('Student approved')
                      } catch (err) {
                        console.error('[Approvals] approve failed', err)
                        toast.error(err instanceof Error ? err.message : 'Approval failed')
                      } finally {
                        setApprovalBusyId(null)
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {approvalBusyId === a.id ? (
                      <><span className="ti ti-loader animate-spin" /> Approving…</>
                    ) : (
                      'Approve'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(hasRole('admin') || hasRole('owner')) && (
        <StudentRiskAlertsWidget />
      )}

      <section className="overflow-hidden rounded-[12px] border border-white/90 dark:border-white/[0.08] bg-white/65 dark:bg-white/[0.05] backdrop-blur-2xl transition-all duration-300">
          <div className="flex flex-col gap-3 border-b border-white/80 dark:border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-jakarta text-base font-bold text-[#0D1B2A] dark:text-white/90">
            Pending & follow-up
          </h2>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value as CourseId | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
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
          pendingItems.studentPending.length === 0 &&
          partnerNotifications.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#5A6A7A]">No pending items for this course.</p>
        ) : (
          <div className="divide-y divide-white/80 dark:divide-white/[0.06]">
            {partnerNotifications.map((n) => (
              <div
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-[#E8A020]/5 px-5 py-3"
              >
                <div>
                  <p className="font-medium text-[#0D1B2A] dark:text-white">{n.title}</p>
                  <p className="text-xs text-[#5A6A7A]">
                    Partner · {n.companyName} · {n.studentDisplayName}
                  </p>
                  <p className="text-xs text-[#5A6A7A]">{n.message}</p>
                </div>
                <Link
                  href="/partner-companies"
                  className="text-sm font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
                >
                  Review →
                </Link>
              </div>
            ))}
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
              className="group card-hover rounded-xl border border-[#DDE3EC] bg-white p-5 hover:border-[#E8A020] hover:shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
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
          <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="border-b border-[#DDE3EC] px-5 py-4 dark:border-white/[0.05]">
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
                    <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:bg-white/[0.02]">
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#5A6A7A] dark:text-white/40">Name</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#5A6A7A] dark:text-white/40">Course</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#5A6A7A] dark:text-white/40">Batch</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#5A6A7A] dark:text-white/40">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentStudents.map((student) => {
                      const course = COURSE_MAP[student.courseId]
                      return (
                        <tr key={student.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                          <td className="px-5 py-3 font-medium text-[#0D1B2A] dark:text-white">
                            {student.name}
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE3EC] bg-[#F5F7FB] px-2.5 py-0.5 text-xs text-[#0B3D6B] dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-blue-300">
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
          <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
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

      {/* Total Expenses — admin/owner only */}
      {(hasRole('admin') || hasRole('owner')) && expensesThisMonth !== null && (
        <section>
          <Link href="/expenses" className="block rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl transition-all hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.05]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="ti ti-cash-banknote text-[#0B3D6B] dark:text-[#E8A020]" />
                <h2 className="font-bold text-[#0D1B2A] dark:text-white">Total Expenses</h2>
                <span className="rounded-full bg-[#0B3D6B]/10 px-2 py-0.5 text-[10px] font-medium text-[#0B3D6B] dark:bg-white/[0.06] dark:text-white/60">This month</span>
              </div>
              <span className="ti ti-chevron-right text-[#5A6A7A] dark:text-white/40" />
            </div>
            <p className="mt-2 font-jakarta text-2xl font-black text-[#E8A020]">{formatLKR(expensesThisMonth)}</p>
          </Link>
        </section>
      )}

      {/* Accommodation Expenses — admin/owner only */}
      {(hasRole('admin') || hasRole('owner')) && accomOverview && (
        <section>
          <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="ti ti-home text-[#0B3D6B] dark:text-[#E8A020]" />
                <h2 className="font-bold text-[#0D1B2A] dark:text-white">Accommodation Expenses</h2>
                <span className="rounded-full bg-[#0B3D6B]/10 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#0B3D6B] dark:text-white/60">This month</span>
              </div>
              <Link href="/accommodation" className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-xs font-medium text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-white/[0.08] dark:text-white/70">
                Manage Houses
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {(() => {
                const momPct = accomOverview.billsPrev > 0
                  ? Math.round(((accomOverview.billsThis - accomOverview.billsPrev) / accomOverview.billsPrev) * 100)
                  : null
                const balance = accomOverview.budget != null ? accomOverview.budget - accomOverview.rent : null
                const cards = [
                  { label: 'Rent This Month', value: formatLKR(accomOverview.rent), color: 'text-[#0B3D6B] dark:text-white' },
                  { label: 'Rent Paid', value: formatLKR(accomOverview.rentPaid), color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Bills This Month', value: formatLKR(accomOverview.billsThis), color: 'text-[#0B3D6B] dark:text-white' },
                  { label: 'Combined Cost', value: formatLKR(accomOverview.rent + accomOverview.billsThis), color: 'text-[#E8A020]' },
                  {
                    label: 'Budget',
                    value: accomOverview.budget != null ? formatLKR(accomOverview.budget) : '—',
                    color: 'text-[#0B3D6B] dark:text-white',
                  },
                  {
                    label: 'Balance',
                    value: balance == null ? '—' : formatLKR(balance),
                    color: balance == null ? 'text-gray-400 dark:text-white/40' : balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                  },
                  {
                    label: 'Bills vs Last Month',
                    value: momPct === null ? '—' : `${momPct > 0 ? '+' : ''}${momPct}%`,
                    color: momPct === null ? 'text-gray-400 dark:text-white/40' : momPct > 0 ? 'text-red-600' : 'text-emerald-600',
                  },
                ]
                return cards.map((s) => (
                  <div key={s.label} className="rounded-[10px] border border-[#DDE3EC] bg-white p-3 dark:border-white/[0.07] dark:bg-white/[0.04]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">{s.label}</p>
                    <p className={`mt-1.5 text-base font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))
              })()}
            </div>
          </div>
        </section>
      )}

      {/* Kitchen Overview Widget — admin/owner only */}
      {(hasRole('admin') || hasRole('owner')) && kitchenOverview && (
        <section>
          <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="ti ti-soup text-[#0B3D6B] dark:text-[#E8A020]" />
                <h2 className="font-bold text-[#0D1B2A] dark:text-white">Kitchen Overview</h2>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">Ahangama</span>
              </div>
              <div className="flex gap-2">
                <Link href="/admin/kitchen-orders" className="rounded-lg bg-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a3460]">
                  Review Orders {kitchenOverview.pendingOrders > 0 && `(${kitchenOverview.pendingOrders})`}
                </Link>
                <Link href="/kitchen/reports" className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-xs font-medium text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-white/[0.08] dark:text-white/70">
                  Kitchen Reports
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: 'Month Cost', value: formatLKR(kitchenOverview.monthCost), color: 'text-[#0B3D6B] dark:text-[#E8A020]' },
                { label: 'Low Stock Items', value: String(kitchenOverview.lowStock), color: kitchenOverview.lowStock > 0 ? 'text-amber-600' : 'text-emerald-600' },
                { label: 'Pending Orders', value: String(kitchenOverview.pendingOrders), color: kitchenOverview.pendingOrders > 0 ? 'text-blue-600' : 'text-[#0B3D6B] dark:text-[#E8A020]' },
                {
                  label: 'Waste Change',
                  value: kitchenOverview.lastWeekWaste > 0
                    ? `${((kitchenOverview.weekWaste - kitchenOverview.lastWeekWaste) / kitchenOverview.lastWeekWaste * 100).toFixed(0)}%`
                    : '—',
                  color: kitchenOverview.weekWaste > kitchenOverview.lastWeekWaste ? 'text-red-600' : 'text-emerald-600',
                },
              ].map((s) => (
                <div key={s.label} className="rounded-[10px] border border-[#DDE3EC] bg-white p-3 dark:border-white/[0.07] dark:bg-white/[0.04]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">{s.label}</p>
                  <p className={`mt-1.5 text-base font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="border-b border-[#DDE3EC] px-5 py-4 dark:border-white/[0.05]">
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
                  <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:bg-white/[0.02]">
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#5A6A7A] dark:text-white/40">Receipt</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#5A6A7A] dark:text-white/40">Student</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#5A6A7A] dark:text-white/40">Amount</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#5A6A7A] dark:text-white/40">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3 font-medium text-[#0D1B2A] dark:text-white">
                        {payment.receiptNumber || '—'}
                      </td>
                      <td className="px-5 py-3 text-[#0D1B2A] dark:text-white">{payment.studentName}</td>
                      <td className="px-5 py-3 font-medium text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(payment.amount)}</td>
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
