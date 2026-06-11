'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
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

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const curMonth = thisMonthPrefix()
        const prevMonth = thisMonthPrefix(-1)

        const [mealSnap, utilSnap] = await Promise.all([
          getDocs(collection(db, 'mealLogs')),
          getDocs(query(collection(db, 'expenses'), where('category', '==', 'Kitchen & Canteen'))),
        ])

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
    </div>
  )
}
