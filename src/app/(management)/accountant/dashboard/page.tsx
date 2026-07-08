'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'

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

type SnapLike = { docs: Array<{ id: string; data: () => Record<string, unknown> }> }
const EMPTY_SNAP: SnapLike = { docs: [] }

function FinanceTile({
  label,
  value,
  sub,
  valueClass = 'text-[#0B3D6B] dark:text-[#E8A020]',
  loading,
  badge,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
  loading?: boolean
  badge?: { text: string; tone: string } | null
}) {
  return (
    <div className="rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">{label}</p>
        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.tone}`}>{badge.text}</span>
        )}
      </div>
      <p className={`mt-2 text-xl font-bold ${valueClass}`}>{loading ? '…' : value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-white/40">{sub}</p>}
    </div>
  )
}

export default function AccountantKitchenDashboard() {
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

  // Finance Overview (8 tiles)
  const [incomeThisMonth, setIncomeThisMonth] = useState(0)
  const [incomeCount, setIncomeCount] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [pendingFees, setPendingFees] = useState(0)
  const [salaryTotal, setSalaryTotal] = useState(0)
  const [utilityBillsTotal, setUtilityBillsTotal] = useState(0)
  const [miscExpenses, setMiscExpenses] = useState(0)
  const [rentTotal, setRentTotal] = useState(0)
  const [accomUtilities, setAccomUtilities] = useState(0)
  const [rentUnpaidCount, setRentUnpaidCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const curMonth = thisMonthPrefix()
      const prevMonth = thisMonthPrefix(-1)
      const now = new Date()

      const [mealSnap, expensesSnap, agentCommSnap, staffRefSnap, paymentsSnap, housesSnap, payrollSnap] =
        await Promise.all([
          getDocs(collection(db, 'mealLogs')).catch(() => EMPTY_SNAP),
          getDocs(collection(db, 'expenses')).catch(() => EMPTY_SNAP),
          getDocs(query(collection(db, 'agentCommissions'), where('status', '==', 'paid'))).catch(() => EMPTY_SNAP),
          getDocs(query(collection(db, 'staffReferrals'), where('includedInPayroll', '==', true))).catch(() => EMPTY_SNAP),
          getDocs(collection(db, 'payments')).catch(() => EMPTY_SNAP),
          getDocs(collection(db, 'accommodations')).catch(() => EMPTY_SNAP),
          getDocs(collection(db, 'payroll')).catch(() => EMPTY_SNAP),
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
      for (const b of billsSnap.docs) {
        const d = b.data()
        utilBillsTotal += Number(d.ceb ?? 0) + Number(d.water ?? 0) + Number(d.internet ?? 0) + Number(d.other ?? 0)
      }

      // ── Income (TILE 1) + Pending fees (TILE 4), from payment-plan installments ──
      const incomeByMonth: Record<string, number> = {}
      let incomeMonth = 0
      let incomeMonthCount = 0
      let pending = 0
      for (const p of paymentsSnap.docs) {
        const data = p.data() as Record<string, unknown>
        const installments = Array.isArray(data.installments)
          ? (data.installments as Array<Record<string, unknown>>)
          : null
        if (installments) {
          let paidSum = 0
          const installmentsTotal = installments.reduce((s, i) => s + Number(i.amount ?? 0), 0)
          for (const inst of installments) {
            if (!inst.paidAt) continue
            const mk = monthKeyOf(inst.paidAt)
            const amt = Number(inst.amount ?? 0)
            incomeByMonth[mk] = (incomeByMonth[mk] ?? 0) + amt
            paidSum += amt
            if (mk === curMonth) {
              incomeMonth += amt
              incomeMonthCount += 1
            }
          }
          const totalFee = Number(data.totalFee ?? 0)
          const base = totalFee > 0 ? totalFee : installmentsTotal
          pending += Math.max(0, base - paidSum)
        } else if (data.amount != null) {
          // Defensive: flat transaction receipts (amount + status/verified + a date field)
          const status = String(data.status ?? '')
          const paid = status === 'paid' || status === 'approved' || data.verified === true
          const mk = monthKeyOf(data.paymentDate ?? data.createdAt ?? data.date)
          if (paid) {
            incomeByMonth[mk] = (incomeByMonth[mk] ?? 0) + Number(data.amount ?? 0)
            if (mk === curMonth) {
              incomeMonth += Number(data.amount ?? 0)
              incomeMonthCount += 1
            }
          } else {
            pending += Number(data.amount ?? 0)
          }
        }
      }

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

      // ── Salaries (TILE 6): prefer payroll collection for the current period ──
      const periodPayroll = payrollSnap.docs
        .map((d) => d.data() as Record<string, unknown>)
        .filter((d) => String(d.period ?? '') === curMonth)
      const payrollTotal = periodPayroll.reduce((s, d) => s + Number(d.netPay ?? 0), 0)
      const salary = periodPayroll.length > 0 ? payrollTotal : salaryFromExpenses

      // ── Accommodation rent + utilities (TILE 5), from each house's current bill ──
      const houses = housesSnap.docs
        .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
        .filter((h) => h.data.status !== 'inactive')
      const rent = houses.reduce((s, h) => s + Number(h.data.monthlyRent ?? 0), 0)
      const billResults = await Promise.all(
        houses.map(async (h) => {
          try {
            const s = await getDoc(doc(db, 'accommodations', h.id, 'bills', curMonth))
            if (!s.exists()) return { paid: false, utilities: 0 }
            const b = s.data() as Record<string, unknown>
            const utilities = Number(b.ceb ?? 0) + Number(b.water ?? 0) + Number(b.internet ?? 0) + Number(b.other ?? 0)
            return { paid: Boolean(b.rentPaid ?? b.paid ?? false), utilities }
          } catch {
            return { paid: false, utilities: 0 }
          }
        }),
      )
      const accomUtil = billResults.reduce((s, r) => s + r.utilities, 0)
      const rentUnpaid = billResults.filter((r) => !r.paid).length

      // ── Total expenses (TILE 2): all expenses + accommodation rent + utility bills.
      // Add payroll salaries only when they aren't already logged in the expenses
      // collection, so salaries aren't double-counted. ──
      const payrollAddon = periodPayroll.length > 0 && salaryFromExpenses === 0 ? payrollTotal : 0
      const expensesGrandTotal = expensesTotalMonth + rent + utilBillsTotal + payrollAddon

      // ── Kitchen KPIs (existing) ──
      const allMeals = mealSnap.docs.map((d) => d.data() as Record<string, unknown>)
      const curMeals = allMeals.filter((m) => String(m.date ?? '').startsWith(curMonth))
      const prevMeals = allMeals.filter((m) => String(m.date ?? '').startsWith(prevMonth))
      const curCost = curMeals.reduce((s, m) => s + (Number(m.estimatedCost) || 0), 0)
      const prevCost = prevMeals.reduce((s, m) => s + (Number(m.estimatedCost) || 0), 0)
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
          .reduce((s, x) => s + (Number(x.estimatedCost) || 0), 0),
        utility: kitchenCatExpenses
          .filter((d) => monthKeyOf(d.date) === m)
          .reduce((s, d) => s + (Number(d.amount) || 0), 0),
      }))

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
      setRegistrationRevenueMonth(incomeMonth) // % of income now reflects real confirmed income

      setIncomeThisMonth(incomeMonth)
      setIncomeCount(incomeMonthCount)
      setTotalExpenses(expensesGrandTotal)
      setPendingFees(pending)
      setSalaryTotal(salary)
      setUtilityBillsTotal(utilBillsTotal)
      setMiscExpenses(misc)
      setRentTotal(rent)
      setAccomUtilities(accomUtil)
      setRentUnpaidCount(rentUnpaid)
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

  const changePercent = lastMonthCost > 0 ? ((monthCost - lastMonthCost) / lastMonthCost) * 100 : 0
  const netProfit = incomeThisMonth - totalExpenses
  const netColor =
    netProfit > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : netProfit < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-[#E8A020]'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Kitchen &amp; Canteen Finance</h1>
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

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <FinanceTile
            label="Total Income This Month"
            value={formatLKR(incomeThisMonth)}
            sub={`From ${incomeCount} student payment${incomeCount === 1 ? '' : 's'}`}
            loading={loading}
          />
          <FinanceTile
            label="Total Expenses This Month"
            value={formatLKR(totalExpenses)}
            sub="Salaries + utilities + misc"
            valueClass="text-[#0B3D6B] dark:text-white"
            loading={loading}
          />
          <FinanceTile
            label="Net Profit / Loss"
            value={formatLKR(netProfit)}
            sub="Income minus expenses"
            valueClass={netColor}
            loading={loading}
          />
          <FinanceTile
            label="Total Pending Fees"
            value={formatLKR(pendingFees)}
            sub="Outstanding on partial payments"
            valueClass="text-amber-600 dark:text-amber-400"
            loading={loading}
          />
          <FinanceTile
            label="Accommodation This Month"
            value={formatLKR(rentTotal + accomUtilities)}
            sub={`${formatLKR(rentTotal)} rent + ${formatLKR(accomUtilities)} utilities`}
            loading={loading}
            badge={
              !loading && rentUnpaidCount > 0
                ? { text: `${rentUnpaidCount} unpaid`, tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
                : null
            }
          />
          <FinanceTile
            label="Salary Expenses"
            value={formatLKR(salaryTotal)}
            sub="Staff salaries this month"
            valueClass="text-[#0B3D6B] dark:text-white"
            loading={loading}
          />
          <FinanceTile
            label="Utility Bills"
            value={formatLKR(utilityBillsTotal)}
            sub="CEB + water + internet + other"
            valueClass="text-[#0B3D6B] dark:text-white"
            loading={loading}
          />
          <FinanceTile
            label="Miscellaneous Expenses"
            value={formatLKR(miscExpenses)}
            sub="Other expenses this month"
            valueClass="text-[#0B3D6B] dark:text-white"
            loading={loading}
          />
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
            <Bar dataKey="utility" fill="#1A6BAD" name="Approved Orders" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
