'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
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
import { useManagement } from '@/components/layout/ManagementContext'
import { formatLKR } from '@/lib/utils/formatCurrency'

function monthStart(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 10)
}

function thisMonthPrefix(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 7)
}

export default function AccountantKitchenDashboard() {
  const { user } = useManagement()
  const [loading, setLoading] = useState(true)
  const [monthCost, setMonthCost] = useState(0)
  const [lastMonthCost, setLastMonthCost] = useState(0)
  const [avgCostPerPersonPerDay, setAvgCostPerPersonPerDay] = useState(0)
  const [chartData, setChartData] = useState<{ month: string; kitchen: number; utility: number }[]>([])
  const [agentCommPaidMonth, setAgentCommPaidMonth] = useState(0)
  const [staffReferralMonth, setStaffReferralMonth] = useState(0)
  const [registrationRevenueMonth, setRegistrationRevenueMonth] = useState(0)
  const [accommodationMonthTotal, setAccommodationMonthTotal] = useState(0)
  const [accommodationHouseCount, setAccommodationHouseCount] = useState(0)
  const [accommodationUnpaidCount, setAccommodationUnpaidCount] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const prevMonth = thisMonthPrefix(-1)

        const curMonth = thisMonthPrefix()

        const [mealSnap, utilSnap, agentCommSnap, staffRefSnap, paymentsSnap] = await Promise.all([
          getDocs(collection(db, 'mealLogs')),
          getDocs(query(collection(db, 'expenses'), where('category', '==', 'Kitchen & Canteen'))),
          getDocs(query(collection(db, 'agentCommissions'), where('status', '==', 'paid'))),
          getDocs(query(collection(db, 'staffReferrals'), where('includedInPayroll', '==', true))),
          getDocs(query(collection(db, 'payments'), where('type', '==', 'registration'))),
        ])

        // Accommodation - monthly rent total
        const housesSnap = await getDocs(
          collection(db, 'accommodation'),
        ).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }))

        setAccommodationHouseCount(housesSnap.docs.length)

        let accomTotal = 0
        let unpaidCount = 0
        for (const houseDoc of housesSnap.docs) {
          const billsSnap = await getDocs(
            query(
              collection(db, 'accommodation', houseDoc.id, 'bills'),
              where('month', '==', curMonth),
            ),
          ).catch(() => ({ docs: [] as Array<{ data: () => Record<string, unknown> }> }))

          for (const b of billsSnap.docs) {
            const d = b.data()
            accomTotal += Number(d.amount ?? 0)
            if (d.status !== 'paid') unpaidCount += 1
          }
        }
        setAccommodationMonthTotal(accomTotal)
        setAccommodationUnpaidCount(unpaidCount)

        const allMeals = mealSnap.docs.map((d) => d.data())

        const curMeals = allMeals.filter((m) => String(m.date ?? '').startsWith(curMonth))
        const prevMeals = allMeals.filter((m) => String(m.date ?? '').startsWith(prevMonth))

        const curCost = curMeals.reduce((s, m) => s + (Number(m.estimatedCost) || 0), 0)
        const prevCost = prevMeals.reduce((s, m) => s + (Number(m.estimatedCost) || 0), 0)
        const curServings = curMeals.reduce((s, m) => s + (Number(m.totalServings) || 0), 0)
        const curDays = new Set(curMeals.map((m) => m.date)).size || 1

        setMonthCost(curCost)
        setLastMonthCost(prevCost)
        setAvgCostPerPersonPerDay(curServings > 0 ? curCost / curServings : 0)

        // Monthly chart: last 6 months kitchen cost from mealLogs
        const months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date()
          d.setDate(1)
          d.setMonth(d.getMonth() - (5 - i))
          return d.toISOString().slice(0, 7)
        })
        const kitchenCostByMonth = months.map((m) => ({
          month: m.slice(5),
          kitchen: allMeals.filter((x) => String(x.date ?? '').startsWith(m)).reduce((s, x) => s + (Number(x.estimatedCost) || 0), 0),
          utility: utilSnap.docs.filter((d) => String(d.data().date ?? '').startsWith(m)).reduce((s, d) => s + (Number(d.data().amount) || 0), 0),
        }))
        setChartData(kitchenCostByMonth)

        const agentPaid = agentCommSnap.docs.reduce((sum, d) => {
          const data = d.data()
          const paidAt = data.paidAt
          const dateStr =
            paidAt instanceof Timestamp
              ? paidAt.toDate().toISOString().slice(0, 7)
              : String(data.paidAt ?? '').slice(0, 7)
          if (dateStr !== curMonth) return sum
          return sum + (Number(data.commissionAmount) || 0)
        }, 0)
        setAgentCommPaidMonth(agentPaid)

        const staffRef = staffRefSnap.docs.reduce((sum, d) => {
          const data = d.data()
          const created = data.createdAt
          const dateStr =
            created instanceof Timestamp
              ? created.toDate().toISOString().slice(0, 7)
              : String(data.period ?? '').slice(0, 7)
          if (dateStr !== curMonth) return sum
          return sum + (Number(data.commissionAmount) || 0)
        }, 0)
        setStaffReferralMonth(staffRef)

        const regRevenue = paymentsSnap.docs.reduce((sum, d) => {
          const data = d.data()
          const dateStr = String(data.paymentDate ?? '').slice(0, 7)
          if (dateStr !== curMonth || data.status !== 'paid') return sum
          return sum + (Number(data.amount) || 0)
        }, 0)
        setRegistrationRevenueMonth(regRevenue)
      } catch (err) {
        console.error('[AccountantKitchenDashboard]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const changePercent = lastMonthCost > 0
    ? ((monthCost - lastMonthCost) / lastMonthCost) * 100
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Kitchen & Canteen Finance</h1>
        <Link
          href="/accountant/expenses"
          className="rounded-lg bg-[#0B3D6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3460]"
        >
          View Expense Entries
        </Link>
      </div>

      {/* KPI row */}
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
              label: '% of registration revenue',
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

      {/* Monthly breakdown chart */}
      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">
          Monthly Expense Breakdown — Last 6 Months
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="kitchen" fill="#E8A020" name="Kitchen & Canteen" radius={[3, 3, 0, 0]} />
            <Bar dataKey="utility" fill="#0B3D6B" name="Approved Orders" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">
          Accommodation
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-800/50">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Houses Managed</p>
            <p className="mt-2 text-lg font-bold text-[#0B3D6B] dark:text-[#E8A020]">{String(accommodationHouseCount)}</p>
          </div>
          <div className="rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-800/50">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">This Month Total</p>
            <p className="mt-2 text-lg font-bold text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(accommodationMonthTotal)}</p>
          </div>
          <div className="rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-800/50">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Unpaid Bills</p>
            <p className={`mt-2 text-lg font-bold ${accommodationUnpaidCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-[#0B3D6B] dark:text-[#E8A020]'}`}>
              {String(accommodationUnpaidCount)}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Link
            href="/accommodation"
            className="text-sm font-medium text-[#0B3D6B] dark:text-[#E8A020] hover:underline"
          >
            View all houses -&gt;
          </Link>
        </div>
      </div>
    </div>
  )
}
