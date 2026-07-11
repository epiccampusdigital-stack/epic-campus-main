'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { auth, db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { useManagement } from '@/components/layout/ManagementContext'

function thisMonthPrefix(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 7)
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Salaries are logged as expenses with this exact category string, or in the payroll collection.
const SALARY_CATEGORY = 'Salary'
const UTILITY_CATEGORY = 'Utilities (CEB/Water/Internet)'

// Firestore paidAt / date values may be a Timestamp, a {seconds} object, or an ISO string.
function monthKeyOf(value: unknown): string {
  if (!value) return ''
  if (value instanceof Timestamp) return value.toDate().toISOString().slice(0, 7)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString().slice(0, 7)
  }
  return String(value).slice(0, 7)
}

// Same as monthKeyOf but to day precision ('YYYY-MM-DD') — for "today" comparisons.
// Handles both Timestamp objects (old records) and ISO strings (new records).
function dateKeyOf(value: unknown): string {
  if (!value) return ''
  if (value instanceof Timestamp) return value.toDate().toISOString().slice(0, 10)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString().slice(0, 10)
  }
  return String(value).slice(0, 10)
}

type SnapLike = { docs: Array<{ id: string; data: () => Record<string, unknown> }> }
const EMPTY_SNAP: SnapLike = { docs: [] }

// ── AI Finance Intelligence types (mirror the /api/finance/ai-summary response) ──
interface AiAnomaly {
  type: 'warning' | 'info' | 'critical'
  title: string
  description: string
  amount: number
}
interface AiFinanceSummary {
  summary: { totalIncome: number; totalExpenses: number; netProfit: number; profitMargin: number; pendingFees: number; collectionRate: number }
  income: { fromEnrollments: number; fromInstallments: number; fromRegistration: number; total: number; breakdown: { source: string; amount: number }[] }
  expenses: { salaries: number; accommodation: number; utilities: number; kitchen: number; miscellaneous: number; total: number; breakdown: { category: string; amount: number }[] }
  students: { total: number; paid: number; pending: number; partial: number; conversionRate: number }
  trends: { incomeVsLastMonth: number; expenseVsLastMonth: number; topRevenueSource: string; topExpenseCategory: string }
  forecasts: { projectedMonthlyIncome: number; projectedYearlyIncome: number; expectedCollections: number; commentary: string }
  anomalies: AiAnomaly[]
  insights: string[]
  dataQuality: { score: number; issues: string[] }
}

const INCOME_COLORS = ['#E8A020', '#0B3D6B', '#1A6BAD']
const EXPENSE_COLORS = ['#0B3D6B', '#1A6BAD', '#E8A020', '#059669', '#9333EA']

function TrendArrow({ pct }: { pct: number }) {
  if (!Number.isFinite(pct) || pct === 0) {
    return <span className="text-xs text-gray-400 dark:text-white/40">—</span>
  }
  const up = pct > 0
  return (
    <span className={`text-xs font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function minutesAgoLabel(when: Date | null): string {
  if (!when) return ''
  const mins = Math.max(0, Math.round((Date.now() - when.getTime()) / 60000))
  if (mins === 0) return 'just now'
  if (mins === 1) return '1 minute ago'
  return `${mins} minutes ago`
}

// ── Tile breakdown row shapes (FIX 2 expandable details) ──────────────────────
interface PaymentRow { name: string; course: string; amount: number; date: string; method: string }
interface PendingRow { name: string; course: string; fee: number; paid: number; balance: number }
interface HouseRow { name: string; rent: number; ceb: number; water: number; internet: number; total: number; paid: boolean }
interface SalaryRow { name: string; role: string; netPay: number; status: string }
interface UtilityRow { place: string; ceb: number; water: number; internet: number; other: number; total: number; month: string }
interface MiscRow { date: string; category: string; description: string; amount: number }
interface MonthRevRow { month: string; collections: number; studentsPaid: number; runningTotal: number }

/** Finance tile that expands in-place to reveal a detailed breakdown (FIX 2). */
function ExpandableTile({
  tileId,
  label,
  value,
  sub,
  valueClass = 'text-[#0B3D6B] dark:text-[#E8A020]',
  loading,
  badge,
  expandedTile,
  onToggle,
  children,
}: {
  tileId?: string
  label: string
  value: string
  sub?: string
  valueClass?: string
  loading?: boolean
  badge?: { text: string; tone: string } | null
  expandedTile?: string | null
  onToggle?: (id: string) => void
  children?: React.ReactNode
}) {
  const hasDetail = !!tileId && !!children
  const open = hasDetail && expandedTile === tileId
  return (
    <div
      className={`rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05] ${hasDetail ? 'cursor-pointer' : ''}`}
      onClick={hasDetail ? () => onToggle?.(tileId!) : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">{label}</p>
        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.tone}`}>{badge.text}</span>
        )}
      </div>
      <p className={`mt-2 text-xl font-bold ${valueClass}`}>{loading ? '…' : value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-white/40">{sub}</p>}
      {hasDetail && (
        <p className="mt-1 text-right text-[10px] font-semibold text-[#0B3D6B] dark:text-[#E8A020]">
          {open ? '▲ Close' : '▼ Details'}
        </p>
      )}
      {hasDetail && (
        <div className={`overflow-hidden transition-all duration-300 ${open ? 'mt-3 max-h-[560px] overflow-y-auto' : 'max-h-0'}`}>
          <div onClick={(e) => e.stopPropagation()} className="border-t border-[#DDE3EC] pt-2 dark:border-white/[0.08]">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

// Keep the plain tile for cards that have no drill-down (Today / Net Profit).
function FinanceTile(props: {
  label: string
  value: string
  sub?: string
  valueClass?: string
  loading?: boolean
  badge?: { text: string; tone: string } | null
}) {
  return <ExpandableTile {...props} />
}

export default function AccountantKitchenDashboard() {
  const { user } = useManagement()
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Kitchen KPIs (existing)
  const [monthCost, setMonthCost] = useState(0)
  const [lastMonthCost, setLastMonthCost] = useState(0)
  const [avgCostPerPersonPerDay, setAvgCostPerPersonPerDay] = useState(0)
  const [chartData, setChartData] = useState<{ month: string; income: number; kitchen: number; utility: number }[]>([])

  // Commissions (existing)
  const [agentCommPaidMonth, setAgentCommPaidMonth] = useState(0)
  const [staffReferralMonth, setStaffReferralMonth] = useState(0)
  const [registrationRevenueMonth, setRegistrationRevenueMonth] = useState(0)

  // Finance Overview tiles
  const [incomeThisMonth, setIncomeThisMonth] = useState(0)
  const [incomeCount, setIncomeCount] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [todayCollection, setTodayCollection] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [pendingFees, setPendingFees] = useState(0)
  const [pendingStudentCount, setPendingStudentCount] = useState(0)
  const [salaryTotal, setSalaryTotal] = useState(0)
  const [utilityBillsTotal, setUtilityBillsTotal] = useState(0)
  const [miscExpenses, setMiscExpenses] = useState(0)
  const [rentTotal, setRentTotal] = useState(0)
  const [accomUtilities, setAccomUtilities] = useState(0)
  const [rentUnpaidCount, setRentUnpaidCount] = useState(0)
  const [kitchenExpMonth, setKitchenExpMonth] = useState(0)

  // Tile drill-down data (FIX 2)
  const [expandedTile, setExpandedTile] = useState<string | null>(null)
  const [monthPayments, setMonthPayments] = useState<PaymentRow[]>([])
  const [pendingList, setPendingList] = useState<PendingRow[]>([])
  const [houseRows, setHouseRows] = useState<HouseRow[]>([])
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([])
  const [utilityRows, setUtilityRows] = useState<UtilityRow[]>([])
  const [miscRows, setMiscRows] = useState<MiscRow[]>([])
  const [monthlyRevRows, setMonthlyRevRows] = useState<MonthRevRow[]>([])
  const [fullyPaidCount, setFullyPaidCount] = useState(0)
  const [enrolledCount, setEnrolledCount] = useState(0)
  const [historicalGapCount, setHistoricalGapCount] = useState(0)

  // Kitchen daily meal cost (FIX 3)
  const [activeStudentCount, setActiveStudentCount] = useState(0)
  const [kitchenMealsCount, setKitchenMealsCount] = useState(0)
  const [kitchenDailySpend, setKitchenDailySpend] = useState<{ date: string; amount: number }[]>([])

  const toggleTile = (id: string) => setExpandedTile((prev) => (prev === id ? null : id))

  // AI Finance Intelligence
  const [aiData, setAiData] = useState<AiFinanceSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [aiError, setAiError] = useState('')
  const [aiLastAt, setAiLastAt] = useState<Date | null>(null)

  const fetchAiSummary = useCallback(async (force = false) => {
    setAiLoading(true)
    setAiError('')
    const month = new Date().toISOString().slice(0, 7)
    const cacheKey = `ai-finance-${month}`

    // Use a cached analysis if it's under 30 minutes old (skip when force-refreshing).
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          const { data, timestamp } = JSON.parse(cached) as { data: AiFinanceSummary; timestamp: number }
          if (Date.now() - timestamp < 30 * 60 * 1000) {
            setAiData(data)
            setAiLastAt(new Date(timestamp))
            setAiLoading(false)
            return
          }
        }
      } catch {
        /* ignore malformed cache */
      }
    }

    try {
      const currentUser = auth.currentUser
      const token = currentUser ? await currentUser.getIdToken() : null
      if (!token) {
        setAiError('Not authenticated')
        return
      }
      const res = await fetch('/api/finance/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month }),
      })
      const data = (await res.json()) as AiFinanceSummary & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'AI analysis failed')
      setAiData(data)
      const now = Date.now()
      setAiLastAt(new Date(now))
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: now }))
      } catch {
        /* sessionStorage full/unavailable — non-fatal */
      }
    } catch (err) {
      console.error('[AI finance]', err)
      setAiError(err instanceof Error ? err.message : 'AI analysis failed')
    } finally {
      setAiLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const curMonth = thisMonthPrefix()
      const prevMonth = thisMonthPrefix(-1)
      const now = new Date()

      const [mealSnap, expensesSnap, agentCommSnap, staffRefSnap, paymentsSnap, housesSnap, payrollSnap, studentsSnap] =
        await Promise.all([
          getDocs(collection(db, 'mealLogs')).catch(() => EMPTY_SNAP),
          getDocs(collection(db, 'expenses')).catch(() => EMPTY_SNAP),
          getDocs(query(collection(db, 'agentCommissions'), where('status', '==', 'paid'))).catch(() => EMPTY_SNAP),
          getDocs(query(collection(db, 'staffReferrals'), where('includedInPayroll', '==', true))).catch(() => EMPTY_SNAP),
          getDocs(collection(db, 'payments')).catch(() => EMPTY_SNAP),
          getDocs(collection(db, 'accommodations')).catch(() => EMPTY_SNAP),
          getDocs(collection(db, 'payroll')).catch(() => EMPTY_SNAP),
          getDocs(collection(db, 'students')).catch(() => EMPTY_SNAP),
        ])

      // ── Utility bills (current month, real utilityBills collection) — TILE 7 ──
      const billsSnap = await getDocs(
        query(
          collection(db, 'utilityBills'),
          where('year', '==', now.getFullYear()),
          where('month', '==', MONTH_NAMES[now.getMonth()]),
        ),
      ).catch(() => EMPTY_SNAP)
      let utilBillsTotal = 0
      const utilityRowsData: UtilityRow[] = []
      for (const b of billsSnap.docs) {
        const d = b.data()
        const ceb = Number(d.ceb ?? 0)
        const water = Number(d.water ?? 0)
        const internet = Number(d.internet ?? 0)
        const other = Number(d.other ?? 0)
        utilBillsTotal += ceb + water + internet + other
        utilityRowsData.push({
          place: String(d.houseName ?? d.location ?? d.houseId ?? '—'),
          ceb,
          water,
          internet,
          other,
          total: ceb + water + internet + other,
          month: String(d.month ?? ''),
        })
      }

      // ── Collections, all-time revenue + pending, from payment-plan installments ──
      const planStudentIds = new Set<string>() // any student that has a plan doc
      const paidThisMonthIds = new Set<string>() // Set A: has a paid installment THIS month
      const paidEverIds = new Set<string>()      // has a paid installment on ANY date
      for (const p of paymentsSnap.docs) {
        planStudentIds.add(p.id)
        const sid = p.data().studentId
        if (sid) planStudentIds.add(String(sid))
      }

      const todayKey = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
      const incomeByMonth: Record<string, number> = {}
      const paidStudentsByMonth: Record<string, Set<string>> = {}
      const payments: PaymentRow[] = [] // this-month payment detail (tile drill-down)
      const pendingRows: PendingRow[] = []
      let incomeMonth = 0          // TILE A: installments paid this month
      let incomeMonthCount = 0
      let todayIncome = 0          // installments paid today
      let allTimeInstallments = 0  // TILE B: every paid installment, any date
      let pendingFromPlans = 0     // unpaid installments across all plans
      let plansWithOutstanding = 0

      const markPaidStudent = (mk: string, id: string) => {
        if (!paidStudentsByMonth[mk]) paidStudentsByMonth[mk] = new Set()
        paidStudentsByMonth[mk].add(id)
      }

      for (const p of paymentsSnap.docs) {
        const data = p.data() as Record<string, unknown>
        const sid = String(data.studentId ?? p.id)
        const studentName = String(data.studentName ?? '')
        const program = String(data.program ?? data.courseId ?? '')
        const installments = Array.isArray(data.installments)
          ? (data.installments as Array<Record<string, unknown>>)
          : null
        if (installments) {
          let hasUnpaid = false
          let unpaidSum = 0
          let paidSum = 0
          const totalFee = Number(data.totalFee ?? 0)
          for (const inst of installments) {
            const amt = Number(inst.amount ?? 0)
            if (inst.paidAt) {
              const mk = monthKeyOf(inst.paidAt)
              incomeByMonth[mk] = (incomeByMonth[mk] ?? 0) + amt
              allTimeInstallments += amt
              paidEverIds.add(sid)
              markPaidStudent(mk, sid)
              paidSum += amt
              if (mk === curMonth) {
                incomeMonth += amt
                incomeMonthCount += 1
                paidThisMonthIds.add(sid)
                payments.push({
                  name: studentName,
                  course: program,
                  amount: amt,
                  date: dateKeyOf(inst.paidAt),
                  method: inst.paidBy ? String(inst.paidBy) : '—',
                })
              }
              if (dateKeyOf(inst.paidAt) === todayKey) todayIncome += amt
            } else {
              pendingFromPlans += amt
              unpaidSum += amt
              hasUnpaid = true
            }
          }
          if (hasUnpaid) {
            plansWithOutstanding += 1
            pendingRows.push({
              name: studentName,
              course: program,
              fee: totalFee || paidSum + unpaidSum,
              paid: paidSum,
              balance: unpaidSum,
            })
          }
        } else if (data.amount != null) {
          // Defensive: flat transaction receipts (amount + status/verified + a date field)
          const status = String(data.status ?? '')
          const paid = status === 'paid' || status === 'approved' || data.verified === true
          const dateVal = data.paymentDate ?? data.createdAt ?? data.date
          const amt = Number(data.amount ?? 0)
          if (paid) {
            const mk = monthKeyOf(dateVal)
            incomeByMonth[mk] = (incomeByMonth[mk] ?? 0) + amt
            allTimeInstallments += amt
            paidEverIds.add(sid)
            markPaidStudent(mk, sid)
            if (mk === curMonth) {
              incomeMonth += amt
              incomeMonthCount += 1
              paidThisMonthIds.add(sid)
              payments.push({ name: studentName, course: program, amount: amt, date: dateKeyOf(dateVal), method: '—' })
            }
            if (dateKeyOf(dateVal) === todayKey) todayIncome += amt
          } else {
            pendingFromPlans += amt
          }
        }
      }

      // ── Student-doc FALLBACK (FIX 1): historical 'paid' students whose paidAt was
      // never recorded on installments still count, via feeAmount + enrollmentDate.
      // Dedup: skip students already represented by a paid installment (Set A / ever).
      let enrollmentsPaidThisMonth = 0   // TILE A add-on
      let paidEnrollmentCount = 0
      let revenueFromPaidStudents = 0    // TILE B add-on (paid students with no paid installment)
      let pendingFromStudents = 0        // no-plan pending/partial
      let noPlanPendingCount = 0
      let fullyPaid = 0
      let activeStudents = 0
      let historicalGap = 0
      for (const sDoc of studentsSnap.docs) {
        const s = sDoc.data() as Record<string, unknown>
        const sid = sDoc.id
        const status = String(s.paymentStatus ?? '').toLowerCase()
        const fee = Number(s.feeAmount ?? 0)
        const paidAmt = Number(s.paidAmount ?? 0)
        const name = String(s.name ?? '')
        const course = String(s.courseId ?? '')
        if (String(s.status ?? '') === 'active') activeStudents += 1

        if (status === 'paid') {
          fullyPaid += 1
          // Only add via student doc when NOT already captured by a paid installment.
          if (!paidEverIds.has(sid)) {
            historicalGap += 1
            revenueFromPaidStudents += fee
            const enrollMk = monthKeyOf(s.enrollmentDate) || monthKeyOf(s.createdAt)
            markPaidStudent(enrollMk, sid)
            if (enrollMk === curMonth && !paidThisMonthIds.has(sid)) {
              enrollmentsPaidThisMonth += fee
              paidEnrollmentCount += 1
              payments.push({ name, course, amount: fee, date: String(s.enrollmentDate ?? '').slice(0, 10), method: 'Enrollment' })
            }
          }
        } else if ((status === 'pending' || status === 'partial') && !planStudentIds.has(sid)) {
          const balance = paidAmt > 0 ? Math.max(0, fee - paidAmt) : fee
          pendingFromStudents += balance
          noPlanPendingCount += 1
          pendingRows.push({ name, course, fee, paid: paidAmt, balance })
        }
      }

      const thisMonthCollections = incomeMonth + enrollmentsPaidThisMonth
      const allTimeRevenue = allTimeInstallments + revenueFromPaidStudents
      const totalPending = pendingFromPlans + pendingFromStudents
      const outstandingStudents = plansWithOutstanding + noPlanPendingCount

      payments.sort((a, b) => b.date.localeCompare(a.date))
      pendingRows.sort((a, b) => b.balance - a.balance)

      // ── Expenses (current month) ──
      const monthExpenses = expensesSnap.docs
        .map((d) => d.data() as Record<string, unknown>)
        .filter((d) => {
          const m = String(d.month ?? String(d.date ?? '').slice(0, 7))
          return m === curMonth
        })
      // Exclude Rent + Utilities — rent comes from accommodations.monthlyRent and
      // utilities from utilityBills, so counting them here too would double-count.
      const expensesTotalMonth = monthExpenses
        .filter((d) => {
          const c = String(d.category ?? '')
          return c !== 'Rent' && c !== UTILITY_CATEGORY
        })
        .reduce((s, d) => s + Number(d.amount ?? 0), 0)
      const salaryFromExpenses = monthExpenses
        .filter((d) => String(d.category ?? '') === SALARY_CATEGORY)
        .reduce((s, d) => s + Number(d.amount ?? 0), 0)
      const misc = monthExpenses
        .filter((d) => {
          const c = String(d.category ?? '')
          return c !== SALARY_CATEGORY && c !== UTILITY_CATEGORY
        })
        .reduce((s, d) => s + Number(d.amount ?? 0), 0)
      const kitchenExpMonthVal = monthExpenses
        .filter((d) => String(d.category ?? '') === 'Kitchen & Canteen')
        .reduce((s, d) => s + Number(d.amount ?? 0), 0)
      const miscRowsData: MiscRow[] = monthExpenses
        .filter((d) => {
          const c = String(d.category ?? '')
          return c !== SALARY_CATEGORY && c !== UTILITY_CATEGORY
        })
        .map((d) => ({
          date: String(d.date ?? '').slice(0, 10),
          category: String(d.category ?? 'Other'),
          description: String(d.description ?? ''),
          amount: Number(d.amount ?? 0),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10)

      // ── Salaries (TILE 6): prefer payroll collection for the current period ──
      const periodPayroll = payrollSnap.docs
        .map((d) => d.data() as Record<string, unknown>)
        .filter((d) => String(d.period ?? '') === curMonth)
      const payrollTotal = periodPayroll.reduce((s, d) => s + Number(d.netPay ?? 0), 0)
      const salary = periodPayroll.length > 0 ? payrollTotal : salaryFromExpenses
      const salaryRowsData: SalaryRow[] = periodPayroll.map((d) => ({
        name: String(d.staffName ?? ''),
        role: String(d.role ?? ''),
        netPay: Number(d.netPay ?? 0),
        status: String(d.status ?? 'pending'),
      }))

      // ── Accommodation rent + utilities (TILE 5), from each house's current bill ──
      const houses = housesSnap.docs
        .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
        .filter((h) => h.data.status !== 'inactive')
      const rent = houses.reduce((s, h) => s + Number(h.data.monthlyRent ?? 0), 0)
      const billResults = await Promise.all(
        houses.map(async (h) => {
          const name = String(h.data.name ?? '')
          const houseRent = Number(h.data.monthlyRent ?? 0)
          try {
            const s = await getDoc(doc(db, 'accommodations', h.id, 'bills', curMonth))
            if (!s.exists()) return { name, rent: houseRent, ceb: 0, water: 0, internet: 0, utilities: 0, paid: false }
            const b = s.data() as Record<string, unknown>
            const ceb = Number(b.ceb ?? 0)
            const water = Number(b.water ?? 0)
            const internet = Number(b.internet ?? 0)
            const other = Number(b.other ?? 0)
            const utilities = ceb + water + internet + other
            return { name, rent: houseRent, ceb, water, internet, utilities, paid: Boolean(b.rentPaid ?? b.paid ?? false) }
          } catch {
            return { name, rent: houseRent, ceb: 0, water: 0, internet: 0, utilities: 0, paid: false }
          }
        }),
      )
      const accomUtil = billResults.reduce((s, r) => s + r.utilities, 0)
      const rentUnpaid = billResults.filter((r) => !r.paid).length
      const houseRowsData: HouseRow[] = billResults.map((r) => ({
        name: r.name,
        rent: r.rent,
        ceb: r.ceb,
        water: r.water,
        internet: r.internet,
        total: r.rent + r.utilities,
        paid: r.paid,
      }))

      // ── Total expenses (TILE 2): all expenses + accommodation rent + utility bills.
      // Add payroll salaries only when they aren't already logged in the expenses
      // collection, so salaries aren't double-counted. ──
      const payrollAddon = periodPayroll.length > 0 && salaryFromExpenses === 0 ? payrollTotal : 0
      const expensesGrandTotal = expensesTotalMonth + rent + utilBillsTotal + payrollAddon

      // ── Kitchen KPIs (existing) ──
      const allMeals = mealSnap.docs.map((d) => d.data() as Record<string, unknown>)
      const curMeals = allMeals.filter((m) => String(m.date ?? '').startsWith(curMonth))
      const prevMeals = allMeals.filter((m) => String(m.date ?? '').startsWith(prevMonth))
      const curCost = curMeals.reduce((s, m) => s + (Number(m.estimatedCost) || Number(m.totalCost) || 0), 0)
      const prevCost = prevMeals.reduce((s, m) => s + (Number(m.estimatedCost) || Number(m.totalCost) || 0), 0)
      const curServings = curMeals.reduce((s, m) => s + (Number(m.totalServings) || 0), 0)

      // ── Chart: last 6 months — income (gold) + kitchen cost + kitchen-category expenses ──
      const kitchenCatExpenses = expensesSnap.docs
        .map((d) => d.data() as Record<string, unknown>)
        .filter((d) => String(d.category ?? '') === 'Kitchen & Canteen')
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - (5 - i))
        return d.toISOString().slice(0, 7)
      })
      const nextChart = months.map((m) => ({
        month: m.slice(5),
        income: incomeByMonth[m] ?? 0,
        kitchen: allMeals
          .filter((x) => String(x.date ?? '').startsWith(m))
          .reduce((s, x) => s + (Number(x.estimatedCost) || Number(x.totalCost) || 0), 0),
        utility: kitchenCatExpenses
          .filter((d) => monthKeyOf(d.date) === m)
          .reduce((s, d) => s + (Number(d.amount) || 0), 0),
      }))

      // ── Monthly revenue detail (Total Revenue tile drill-down) ──
      let runningRev = 0
      const monthlyRevData: MonthRevRow[] = months.map((m) => {
        const collections = incomeByMonth[m] ?? 0
        runningRev += collections
        return {
          month: m.slice(5),
          collections,
          studentsPaid: paidStudentsByMonth[m]?.size ?? 0,
          runningTotal: runningRev,
        }
      })

      // ── Kitchen daily spend — last 14 days (FIX 3) ──
      const dailyCostMap: Record<string, number> = {}
      for (const m of allMeals) {
        const dstr = String(m.date ?? '').slice(0, 10)
        if (!dstr) continue
        dailyCostMap[dstr] = (dailyCostMap[dstr] ?? 0) + (Number(m.estimatedCost) || Number(m.totalCost) || 0)
      }
      const dailySpend = Array.from({ length: 14 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (13 - i))
        const iso = d.toISOString().slice(0, 10)
        return { date: `${iso.slice(5, 7)}/${iso.slice(8, 10)}`, amount: dailyCostMap[iso] ?? 0 }
      })

      // ── Commissions (existing) ──
      const agentPaid = agentCommSnap.docs.reduce((sum, dRef) => {
        const data = dRef.data()
        if (monthKeyOf(data.paidAt) !== curMonth) return sum
        return sum + (Number(data.commissionAmount) || 0)
      }, 0)
      const staffRef = staffRefSnap.docs.reduce((sum, dRef) => {
        const data = dRef.data()
        const mk = data.createdAt ? monthKeyOf(data.createdAt) : String(data.period ?? '').slice(0, 7)
        if (mk !== curMonth) return sum
        return sum + (Number(data.commissionAmount) || 0)
      }, 0)

      // Commit all state
      setMonthCost(curCost)
      setLastMonthCost(prevCost)
      setAvgCostPerPersonPerDay(curServings > 0 ? curCost / curServings : 0)
      setChartData(nextChart)
      setAgentCommPaidMonth(agentPaid)
      setStaffReferralMonth(staffRef)
      setRegistrationRevenueMonth(thisMonthCollections) // % of income vs this month's collections

      setIncomeThisMonth(thisMonthCollections)
      setIncomeCount(incomeMonthCount + paidEnrollmentCount)
      setTotalRevenue(allTimeRevenue)
      setTodayCollection(todayIncome)
      setTotalExpenses(expensesGrandTotal)
      setPendingFees(totalPending)
      setPendingStudentCount(outstandingStudents)
      setSalaryTotal(salary)
      setUtilityBillsTotal(utilBillsTotal)
      setMiscExpenses(misc)
      setRentTotal(rent)
      setAccomUtilities(accomUtil)
      setRentUnpaidCount(rentUnpaid)
      setKitchenExpMonth(kitchenExpMonthVal)

      // Tile drill-down data (FIX 2)
      setMonthPayments(payments)
      setPendingList(pendingRows)
      setHouseRows(houseRowsData)
      setSalaryRows(salaryRowsData)
      setUtilityRows(utilityRowsData)
      setMiscRows(miscRowsData)
      setMonthlyRevRows(monthlyRevData)
      setFullyPaidCount(fullyPaid)
      setEnrolledCount(studentsSnap.docs.length)
      setHistoricalGapCount(historicalGap)

      // Kitchen (FIX 3)
      setActiveStudentCount(activeStudents)
      setKitchenMealsCount(curMeals.length)
      setKitchenDailySpend(dailySpend)

      setLastUpdated(new Date())
    } catch (err) {
      console.error('[AccountantKitchenDashboard]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Auto-run the AI analysis once Firebase auth is ready (needed for the ID token).
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) void fetchAiSummary()
    })
    return () => unsub()
  }, [fetchAiSummary])

  const changePercent = lastMonthCost > 0 ? ((monthCost - lastMonthCost) / lastMonthCost) * 100 : 0
  const monthYearLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  // Net Profit intentionally uses THIS MONTH's collections (incomeThisMonth), not all-time revenue.
  const netProfit = incomeThisMonth - totalExpenses
  const netColor =
    netProfit > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : netProfit < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-[#E8A020]'

  const incomeBreakdown = [
    { name: 'Enrollments', value: aiData?.income?.fromEnrollments ?? 0 },
    { name: 'Installments', value: aiData?.income?.fromInstallments ?? 0 },
    { name: 'Registration', value: aiData?.income?.fromRegistration ?? 0 },
  ].filter((d) => d.value > 0)
  const expenseBreakdown = [
    { name: 'Salaries', value: aiData?.expenses?.salaries ?? 0 },
    { name: 'Accommodation', value: aiData?.expenses?.accommodation ?? 0 },
    { name: 'Utilities', value: aiData?.expenses?.utilities ?? 0 },
    { name: 'Kitchen', value: aiData?.expenses?.kitchen ?? 0 },
    { name: 'Miscellaneous', value: aiData?.expenses?.miscellaneous ?? 0 },
  ].filter((d) => d.value > 0)

  // Kitchen daily-cost derived stats (FIX 3)
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const kitchenDailyAvg = daysInMonth > 0 ? monthCost / daysInMonth : 0
  const kitchenPerStudentDay = activeStudentCount > 0 ? kitchenDailyAvg / activeStudentCount : 0

  // Sub-total of this month's collections by course (tile drill-down)
  const collectionsByCourse = Object.entries(
    monthPayments.reduce<Record<string, number>>((acc, p) => {
      const k = p.course || '—'
      acc[k] = (acc[k] ?? 0) + p.amount
      return acc
    }, {}),
  )

  // Finance data is sensitive — only admin/owner/accountant may view this page.
  const allowedRoles = ['admin', 'owner', 'accountant']
  if (user && !allowedRoles.includes(user.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Finance Overview</h1>
        <Link
          href="/accountant/expenses"
          className="rounded-lg bg-[#0B3D6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3460]"
        >
          View Expense Entries
        </Link>
      </div>

      {/* ── Finance Overview (8 tiles) ─────────────────────────────────────── */}
      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0D1B2A] dark:text-white">Finance Overview</h2>
        </div>

        <div className="grid grid-cols-2 items-start gap-4 lg:grid-cols-4">
          <ExpandableTile
            tileId="collections"
            label="This Month's Collections"
            value={formatLKR(incomeThisMonth)}
            sub={`Payments received in ${monthYearLabel}`}
            valueClass="text-emerald-600 dark:text-emerald-400"
            loading={loading}
            expandedTile={expandedTile}
            onToggle={toggleTile}
          >
            <div className="space-y-1 text-[11px]">
              {monthPayments.length === 0 ? (
                <p className="text-gray-400 dark:text-white/40">No payments recorded this month.</p>
              ) : (
                <>
                  {monthPayments.slice(0, 10).map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[#0D1B2A] dark:text-white">
                        {p.name || '—'} <span className="text-gray-400">· {p.course || '—'}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatLKR(p.amount)}</span>{' '}
                        <span className="text-gray-400">{p.date}</span>
                      </span>
                    </div>
                  ))}
                  {monthPayments.length > 10 && (
                    <Link href="/payments" className="block pt-1 font-semibold text-[#0B3D6B] dark:text-[#E8A020]">
                      View all {monthPayments.length} payments →
                    </Link>
                  )}
                  {collectionsByCourse.length > 0 && (
                    <div className="mt-1 border-t border-[#DDE3EC] pt-1 dark:border-white/10">
                      {collectionsByCourse.map(([c, amt]) => (
                        <div key={c} className="flex justify-between text-gray-500 dark:text-white/50">
                          <span className="truncate">{c}</span>
                          <span>{formatLKR(amt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </ExpandableTile>

          <FinanceTile
            label="Today's Collection"
            value={formatLKR(todayCollection)}
            sub={`Payments marked paid today${incomeCount ? ` · ${incomeCount} this month` : ''}`}
            valueClass="text-emerald-600 dark:text-emerald-400"
            loading={loading}
          />

          <ExpandableTile
            tileId="revenue"
            label="Total Revenue (All Time)"
            value={formatLKR(totalRevenue)}
            sub="All confirmed payments to date"
            valueClass="text-[#0B3D6B] dark:text-[#1A6BAD]"
            loading={loading}
            expandedTile={expandedTile}
            onToggle={toggleTile}
          >
            <div className="space-y-1 text-[11px]">
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevRows}>
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
                    <Bar dataKey="collections" fill="#0B3D6B" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {monthlyRevRows.map((r) => (
                <div key={r.month} className="flex items-center justify-between gap-2 text-gray-500 dark:text-white/50">
                  <span>{r.month}</span>
                  <span className="text-[#0D1B2A] dark:text-white">{formatLKR(r.collections)}</span>
                  <span>{r.studentsPaid} paid</span>
                  <span className="text-gray-400">Σ {formatLKR(r.runningTotal)}</span>
                </div>
              ))}
              <p className="mt-1 border-t border-[#DDE3EC] pt-1 font-semibold text-[#0D1B2A] dark:border-white/10 dark:text-white">
                {fullyPaidCount} of {enrolledCount} students fully paid
              </p>
            </div>
          </ExpandableTile>

          <ExpandableTile
            tileId="expenses"
            label="Total Expenses This Month"
            value={formatLKR(totalExpenses)}
            sub="Salaries + utilities + misc"
            valueClass="text-[#0B3D6B] dark:text-white"
            loading={loading}
            expandedTile={expandedTile}
            onToggle={toggleTile}
          >
            <div className="space-y-1 text-[11px]">
              {[
                { label: 'Salaries', value: salaryTotal, href: '/payroll', extra: `${salaryRows.length} staff` },
                { label: 'Accommodation rent', value: rentTotal + accomUtilities, href: '/accommodation', extra: `${houseRows.length} houses` },
                { label: 'Utility bills', value: utilityBillsTotal, href: '/utility-bills', extra: '' },
                { label: 'Kitchen & Canteen', value: kitchenExpMonth, href: '/kitchen/reports', extra: '' },
                { label: 'Miscellaneous', value: miscExpenses, href: '/accountant/expenses', extra: '' },
              ].map((row) => (
                <Link key={row.label} href={row.href} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.05]">
                  <span className="text-[#0D1B2A] dark:text-white">{row.label} {row.extra && <span className="text-gray-400">({row.extra})</span>}</span>
                  <span className="font-semibold text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(row.value)}</span>
                </Link>
              ))}
            </div>
          </ExpandableTile>

          <FinanceTile
            label="Net Profit / Loss"
            value={formatLKR(netProfit)}
            sub="Income minus expenses"
            valueClass={netColor}
            loading={loading}
          />

          <ExpandableTile
            tileId="pending"
            label="Total Pending Fees"
            value={formatLKR(pendingFees)}
            sub={`${pendingStudentCount} student${pendingStudentCount === 1 ? '' : 's'} with outstanding balance`}
            valueClass="text-amber-600 dark:text-amber-400"
            loading={loading}
            expandedTile={expandedTile}
            onToggle={toggleTile}
          >
            <div className="space-y-1 text-[11px]">
              {pendingList.length === 0 ? (
                <p className="text-gray-400 dark:text-white/40">No outstanding balances.</p>
              ) : (
                <>
                  {pendingList.slice(0, 10).map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[#0D1B2A] dark:text-white">
                        {p.name || '—'} <span className="text-gray-400">· {p.course || '—'}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-amber-600 dark:text-amber-400">{formatLKR(p.balance)}</span>
                    </div>
                  ))}
                  {pendingList.length > 10 && (
                    <Link href="/payments" className="block pt-1 font-semibold text-[#0B3D6B] dark:text-[#E8A020]">
                      View all →
                    </Link>
                  )}
                  <p className="mt-1 border-t border-[#DDE3EC] pt-1 font-semibold text-[#0D1B2A] dark:border-white/10 dark:text-white">
                    {formatLKR(pendingFees)} from {pendingList.length} students
                  </p>
                </>
              )}
            </div>
          </ExpandableTile>

          <ExpandableTile
            tileId="accommodation"
            label="Accommodation This Month"
            value={formatLKR(rentTotal + accomUtilities)}
            sub={`${formatLKR(rentTotal)} rent + ${formatLKR(accomUtilities)} utilities`}
            loading={loading}
            expandedTile={expandedTile}
            onToggle={toggleTile}
            badge={
              !loading && rentUnpaidCount > 0
                ? { text: `${rentUnpaidCount} unpaid`, tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
                : null
            }
          >
            <div className="space-y-1 text-[11px]">
              {houseRows.length === 0 ? (
                <p className="text-gray-400 dark:text-white/40">No houses.</p>
              ) : (
                <>
                  {houseRows.map((h, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[#0D1B2A] dark:text-white">{h.name || '—'}</span>
                      <span className="shrink-0">
                        <span className="font-semibold text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(h.total)}</span>{' '}
                        <span className={h.paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                          {h.paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </span>
                    </div>
                  ))}
                  <p className="mt-1 border-t border-[#DDE3EC] pt-1 font-semibold text-[#0D1B2A] dark:border-white/10 dark:text-white">
                    {formatLKR(rentTotal + accomUtilities)} across {houseRows.length} houses
                  </p>
                </>
              )}
            </div>
          </ExpandableTile>

          <ExpandableTile
            tileId="salary"
            label="Salary Expenses"
            value={formatLKR(salaryTotal)}
            sub="Staff salaries this month"
            valueClass="text-[#0B3D6B] dark:text-white"
            loading={loading}
            expandedTile={expandedTile}
            onToggle={toggleTile}
          >
            <div className="space-y-1 text-[11px]">
              {salaryRows.length === 0 ? (
                <p className="text-gray-400 dark:text-white/40">No payroll processed for this month.</p>
              ) : (
                <>
                  {salaryRows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[#0D1B2A] dark:text-white">
                        {r.name || '—'} <span className="text-gray-400">· {r.role || '—'}</span>
                      </span>
                      <span className="shrink-0">
                        <span className="font-semibold text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(r.netPay)}</span>{' '}
                        <span className={r.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                          {r.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </span>
                    </div>
                  ))}
                  <p className="mt-1 border-t border-[#DDE3EC] pt-1 font-semibold text-[#0D1B2A] dark:border-white/10 dark:text-white">
                    {formatLKR(salaryTotal)} for {salaryRows.length} staff
                  </p>
                </>
              )}
            </div>
          </ExpandableTile>

          <ExpandableTile
            tileId="utility"
            label="Utility Bills"
            value={formatLKR(utilityBillsTotal)}
            sub="CEB + water + internet + other"
            valueClass="text-[#0B3D6B] dark:text-white"
            loading={loading}
            expandedTile={expandedTile}
            onToggle={toggleTile}
          >
            <div className="space-y-1 text-[11px]">
              {utilityRows.length === 0 ? (
                <p className="text-gray-400 dark:text-white/40">No utility bills this month.</p>
              ) : (
                <>
                  {utilityRows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[#0D1B2A] dark:text-white">{r.place}</span>
                      <span className="shrink-0 font-semibold text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(r.total)}</span>
                    </div>
                  ))}
                  <p className="mt-1 border-t border-[#DDE3EC] pt-1 font-semibold text-[#0D1B2A] dark:border-white/10 dark:text-white">
                    Grand total {formatLKR(utilityBillsTotal)}
                  </p>
                </>
              )}
            </div>
          </ExpandableTile>

          <ExpandableTile
            tileId="misc"
            label="Miscellaneous Expenses"
            value={formatLKR(miscExpenses)}
            sub="Other expenses this month"
            valueClass="text-[#0B3D6B] dark:text-white"
            loading={loading}
            expandedTile={expandedTile}
            onToggle={toggleTile}
          >
            <div className="space-y-1 text-[11px]">
              {miscRows.length === 0 ? (
                <p className="text-gray-400 dark:text-white/40">No miscellaneous expenses.</p>
              ) : (
                miscRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[#0D1B2A] dark:text-white">
                      <span className="text-gray-400">{r.date}</span> {r.category}{r.description ? ` · ${r.description}` : ''}
                    </span>
                    <span className="shrink-0 font-semibold text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(r.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </ExpandableTile>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#DDE3EC] dark:border-white/[0.08] pt-3">
          <p className="text-xs text-gray-400 dark:text-white/40">
            {lastUpdated ? `Data as of ${lastUpdated.toLocaleString('en-GB')}` : 'Loading…'}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE3EC] dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-[#0B3D6B] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06] disabled:opacity-50"
          >
            <span className={`ti ti-refresh ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Kitchen This Month (FIX 3) ─────────────────────────────────────── */}
      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">Kitchen This Month</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Total Kitchen Spend', value: formatLKR(monthCost), sub: monthYearLabel },
            { label: 'Daily Average Spend', value: formatLKR(kitchenDailyAvg), sub: 'per day' },
            { label: 'Per Student Per Day', value: activeStudentCount > 0 ? formatLKR(kitchenPerStudentDay) : '—', sub: `${activeStudentCount} active students` },
            { label: 'Meals Logged', value: String(kitchenMealsCount), sub: 'meal sessions' },
          ].map((c) => (
            <div key={c.label} className="rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">{c.label}</p>
              <p className="mt-2 text-xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">{loading ? '…' : c.value}</p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-white/40">{c.sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Daily Kitchen Spend — Last 14 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={kitchenDailySpend}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
              <Bar dataKey="amount" fill="#0B3D6B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── AI FINANCE INTELLIGENCE (additional — below the 8 tiles) ─────────── */}
      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="ti ti-sparkles text-lg text-[#E8A020]" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#0D1B2A] dark:text-white">AI Finance Intelligence</h2>
          </div>
          <div className="flex items-center gap-3">
            {aiLastAt && !aiLoading && (
              <span className="text-xs text-gray-400 dark:text-white/40">Last analyzed: {minutesAgoLabel(aiLastAt)}</span>
            )}
            <button
              type="button"
              onClick={() => void fetchAiSummary(true)}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE3EC] dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-[#0B3D6B] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06] disabled:opacity-50"
            >
              <span className={`ti ti-refresh ${aiLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {aiLoading ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-[#5A6A7A] dark:text-white/50">
              <span className="ti ti-sparkles animate-pulse text-[#E8A020]" />
              AI is analyzing your finances…
            </p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-56 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
              <div className="h-56 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
            </div>
          </div>
        ) : aiError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            AI analysis unavailable: {aiError}
          </div>
        ) : aiData ? (
          <div className="space-y-6">
            {/* PANEL 1 — Summary bar */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Total Income</p>
                <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatLKR(aiData.summary?.totalIncome ?? 0)}</p>
                <div className="mt-1"><TrendArrow pct={aiData.trends?.incomeVsLastMonth ?? 0} /></div>
              </div>
              <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Total Expenses</p>
                <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">{formatLKR(aiData.summary?.totalExpenses ?? 0)}</p>
                <div className="mt-1"><TrendArrow pct={aiData.trends?.expenseVsLastMonth ?? 0} /></div>
              </div>
              <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Net Profit</p>
                <p className={`mt-1 text-xl font-bold ${(aiData.summary?.netProfit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatLKR(aiData.summary?.netProfit ?? 0)}
                </p>
                <p className="mt-1 text-[11px] text-gray-400 dark:text-white/40">Margin {(aiData.summary?.profitMargin ?? 0).toFixed(1)}%</p>
              </div>
              <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Collection Rate</p>
                <p className="mt-1 text-xl font-bold text-[#E8A020]">{(aiData.summary?.collectionRate ?? 0).toFixed(1)}%</p>
              </div>
            </div>

            {/* PANELS 2 & 3 — Income & Expense breakdown */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Income Breakdown</h3>
                {incomeBreakdown.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400 dark:text-white/40">No income recorded</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={incomeBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                          {incomeBreakdown.map((entry, i) => (
                            <Cell key={entry.name} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1">
                      {incomeBreakdown.map((entry, i) => (
                        <div key={entry.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-[#5A6A7A] dark:text-white/60">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: INCOME_COLORS[i % INCOME_COLORS.length] }} />
                            {entry.name}
                          </span>
                          <span className="font-semibold text-[#0D1B2A] dark:text-white">{formatLKR(entry.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Expense Breakdown</h3>
                {expenseBreakdown.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400 dark:text-white/40">No expenses recorded</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                          {expenseBreakdown.map((entry, i) => (
                            <Cell key={entry.name} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1">
                      {expenseBreakdown.map((entry, i) => (
                        <div key={entry.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-[#5A6A7A] dark:text-white/60">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                            {entry.name}
                          </span>
                          <span className="font-semibold text-[#0D1B2A] dark:text-white">{formatLKR(entry.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* PANEL 4 — Student payment status */}
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Student Payment Status</h3>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{aiData.students?.paid ?? 0} Paid</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{aiData.students?.pending ?? 0} Pending</span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{aiData.students?.partial ?? 0} Partial</span>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-gray-400 dark:text-white/40">
                  <span>Collection rate</span>
                  <span>{(aiData.summary?.collectionRate ?? 0).toFixed(1)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, aiData.summary?.collectionRate ?? 0))}%` }} />
                </div>
              </div>
            </div>

            {/* PANEL 5 — Anomalies & alerts */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">AI Anomalies &amp; Alerts</h3>
              {(aiData.anomalies ?? []).length === 0 ? (
                <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                  All finances look healthy this month
                </div>
              ) : (
                (aiData.anomalies ?? []).map((a, i) => {
                  const tone =
                    a.type === 'critical'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : a.type === 'warning'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  return (
                    <div key={i} className={`rounded-lg border-l-4 px-4 py-3 ${tone}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#0D1B2A] dark:text-white">{a.title}</p>
                          <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/60">{a.description}</p>
                        </div>
                        {a.amount ? <span className="shrink-0 text-sm font-bold text-[#0D1B2A] dark:text-white">{formatLKR(a.amount)}</span> : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* PANEL 6 — Insights */}
            {(aiData.insights ?? []).length > 0 && (
              <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">AI Insights</h3>
                <ul className="space-y-2">
                  {(aiData.insights ?? []).map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#0D1B2A] dark:text-white/80">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8A020]" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* PANEL 7 — Forecast */}
            <div className="rounded-xl bg-[#0B3D6B] p-5 text-white dark:bg-[#0B3D6B]/80">
              <div className="mb-3 flex items-center gap-2">
                <span className="ti ti-robot text-lg text-[#E8A020]" aria-hidden="true" />
                <h3 className="text-sm font-bold">AI Forecast</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Projected Monthly Income</p>
                  <p className="mt-1 text-lg font-bold text-[#E8A020]">{formatLKR(aiData.forecasts?.projectedMonthlyIncome ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Expected Collections</p>
                  <p className="mt-1 text-lg font-bold text-white">{formatLKR(aiData.forecasts?.expectedCollections ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Projected Yearly</p>
                  <p className="mt-1 text-lg font-bold text-white">{formatLKR(aiData.forecasts?.projectedYearlyIncome ?? 0)}</p>
                </div>
              </div>
              {aiData.forecasts?.commentary && (
                <p className="mt-3 border-t border-white/10 pt-3 text-sm italic text-white/70">{aiData.forecasts.commentary}</p>
              )}
            </div>
          </div>
        ) : null}

        {/* Powered by Claude badge */}
        <div className="mt-4 flex justify-end">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#0B3D6B]/[0.06] px-3 py-1 text-[10px] font-semibold text-[#5A6A7A] dark:bg-white/[0.06] dark:text-white/50">
            <span className="ti ti-sparkles text-[#E8A020]" /> Powered by Claude AI
          </span>
        </div>
      </div>

      {/* KPI row — kitchen cost (existing) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          {
            label: 'This Month Kitchen Cost',
            value: loading ? '…' : formatLKR(monthCost),
            sub: loading ? '' : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}% vs last month`,
            color: 'text-[#0B3D6B] dark:text-[#E8A020]',
            subColor: changePercent > 0 ? 'text-red-500' : 'text-emerald-500',
          },
          {
            label: 'Last Month Kitchen Cost',
            value: loading ? '…' : formatLKR(lastMonthCost),
            sub: '',
            color: 'text-[#5A6A7A] dark:text-white/60',
            subColor: '',
          },
          {
            label: 'Avg Cost / Student / Day',
            value: loading ? '…' : formatLKR(avgCostPerPersonPerDay),
            sub: 'Per serving per day',
            color: 'text-[#0B3D6B] dark:text-[#E8A020]',
            subColor: 'text-gray-400',
          },
        ].map((s) => (
          <div key={s.label} className="rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">{s.label}</p>
            <p className={`mt-2 text-xl font-bold ${s.color}`}>{s.value}</p>
            {s.sub && <p className={`mt-0.5 text-xs ${s.subColor}`}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Commissions */}
      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">Commissions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Agent commissions paid (month)',
              value: loading ? '…' : formatLKR(agentCommPaidMonth),
            },
            {
              label: 'Staff referral commissions (month)',
              value: loading ? '…' : formatLKR(staffReferralMonth),
            },
            {
              label: 'Total commission expense',
              value: loading ? '…' : formatLKR(agentCommPaidMonth + staffReferralMonth),
            },
            {
              label: '% of income (month)',
              value: loading
                ? '…'
                : registrationRevenueMonth > 0
                  ? `${(((agentCommPaidMonth + staffReferralMonth) / registrationRevenueMonth) * 100).toFixed(1)}%`
                  : '—',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-800/50"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {s.label}
              </p>
              <p className="mt-2 text-lg font-bold text-[#0B3D6B] dark:text-[#E8A020]">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly breakdown chart — income vs expenses */}
      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">
          Income vs Expenses — Last 6 Months
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="income" fill="#E8A020" name="Income" radius={[3, 3, 0, 0]} />
            <Bar dataKey="kitchen" fill="#0B3D6B" name="Kitchen &amp; Canteen" radius={[3, 3, 0, 0]} />
            <Bar dataKey="utility" fill="#1A6BAD" name="Utility &amp; Kitchen Expenses" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
