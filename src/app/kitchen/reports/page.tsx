'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { MealLog, WasteEntry } from '@/types/kitchen'

function monthStart(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 10)
}

function monthEnd(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1 + offset)
  d.setDate(0)
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function ReportsPage() {
  const [meals, setMeals] = useState<MealLog[]>([])
  const [waste, setWaste] = useState<WasteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(monthEnd())

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [mealSnap, wasteSnap] = await Promise.all([
          getDocs(query(collection(db, 'mealLogs'), orderBy('date', 'asc'))),
          getDocs(query(collection(db, 'wasteLog'), orderBy('date', 'asc'))),
        ])
        setMeals(mealSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MealLog)))
        setWaste(wasteSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WasteEntry)))
      } catch (err) {
        console.error('[Reports]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredMeals = meals.filter((m) => m.date >= startDate && m.date <= endDate)
  const filteredWaste = waste.filter((w) => w.date >= startDate && w.date <= endDate)

  const totalSpent = filteredMeals.reduce((s, m) => s + m.estimatedCost, 0)
  const totalServings = filteredMeals.reduce((s, m) => s + m.totalServings, 0)
  const totalWasteCost = filteredWaste.reduce((s, w) => s + w.estimatedLoss, 0)

  const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
  const uniqueDays = new Set(filteredMeals.map((m) => m.date)).size || 1
  const avgCostPerPersonPerDay = totalServings > 0 ? totalSpent / totalServings : 0
  const wastePercent = totalSpent > 0 ? (totalWasteCost / totalSpent) * 100 : 0

  // Daily cost trend: last 30 days
  const dailyCostData = Array.from({ length: 30 }, (_, i) => {
    const date = daysAgo(29 - i)
    const cost = meals.filter((m) => m.date === date).reduce((s, m) => s + m.estimatedCost, 0)
    return { date: date.slice(5), cost }
  })

  // Top 8 wasted items
  const itemWaste: Record<string, number> = {}
  waste.forEach((w) => {
    itemWaste[w.itemName] = (itemWaste[w.itemName] || 0) + w.estimatedLoss
  })
  const topWasted = Object.entries(itemWaste)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }))

  // Meals served: last 14 days
  const mealsServedData = Array.from({ length: 14 }, (_, i) => {
    const date = daysAgo(13 - i)
    const dayMeals = meals.filter((m) => m.date === date)
    return {
      date: date.slice(5),
      students: dayMeals.reduce((s, m) => s + m.studentCount, 0),
      staff: dayMeals.reduce((s, m) => s + m.staffCount, 0),
    }
  })

  // Waste trend: this month vs last month
  const thisMonthStr = monthStart()
  const lastMonthStr = monthStart(-1)
  const wasteTrendData = Array.from({ length: 30 }, (_, i) => {
    const thisDate = new Date(thisMonthStr)
    thisDate.setDate(thisDate.getDate() + i)
    const lastDate = new Date(lastMonthStr)
    lastDate.setDate(lastDate.getDate() + i)
    if (thisDate > new Date()) return null
    const thisStr = thisDate.toISOString().slice(0, 10)
    const lastStr = lastDate.toISOString().slice(0, 10)
    return {
      day: `D${i + 1}`,
      thisMonth: waste.filter((w) => w.date === thisStr).reduce((s, w) => s + w.estimatedLoss, 0),
      lastMonth: waste.filter((w) => w.date === lastStr).reduce((s, w) => s + w.estimatedLoss, 0),
    }
  }).filter(Boolean) as { day: string; thisMonth: number; lastMonth: number }[]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <style>{`@media print { .no-print { display:none!important; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Kitchen Reports</h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print hidden items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-4 py-2 text-sm font-medium text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white md:flex"
        >
          <span className="ti ti-printer" /> Print Report
        </button>
      </div>

      <div className="no-print flex flex-col gap-3 md:flex-row md:items-center">
        <div className="w-full">
          <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="w-full">
          <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Spent', value: formatLKR(totalSpent), color: 'text-[#0B3D6B] dark:text-[#E8A020]' },
          { label: 'Avg Cost / Person / Day', value: formatLKR(avgCostPerPersonPerDay), color: 'text-[#0B3D6B] dark:text-[#E8A020]' },
          { label: 'Total Meals Served', value: String(totalServings), color: 'text-[#0B3D6B] dark:text-[#E8A020]' },
          { label: 'Waste % of Food Cost', value: `${wastePercent.toFixed(1)}%`, color: wastePercent > 10 ? 'text-red-600' : 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="min-h-[72px] rounded-[12px] border border-white/90 bg-white/65 p-3 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05] md:p-4">
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-white/40">{s.label}</p>
            <p className={`mt-2 text-base font-bold md:text-lg ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1 - Daily cost trend */}
        <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">Daily Cost Trend (LKR)</h2>
          <ResponsiveContainer width="100%" height={220} minHeight={220}>
            <LineChart data={dailyCostData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EC" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
              <YAxis tick={{ fontSize: 9 }} width={40} />
              <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
              <Line type="monotone" dataKey="cost" stroke="#0B3D6B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 2 - Top wasted items */}
        <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">Top Wasted Items (LKR)</h2>
          {topWasted.length === 0 ? (
            <p className="text-sm text-[#5A6A7A] dark:text-white/40">No waste data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220} minHeight={220}>
              <BarChart data={topWasted} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={64} />
                <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
                <Bar dataKey="value" fill="#E8A020" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 3 - Meals served */}
        <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">Meals Served — Last 14 Days</h2>
          <ResponsiveContainer width="100%" height={220} minHeight={220}>
            <BarChart data={mealsServedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EC" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={2} />
              <YAxis tick={{ fontSize: 9 }} width={32} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="students" stackId="a" fill="#1A6BAD" name="Students" />
              <Bar dataKey="staff" stackId="a" fill="#0B3D6B" name="Staff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 4 - Waste trend comparison */}
        <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">Waste Trend: This Month vs Last Month</h2>
          {wasteTrendData.length === 0 ? (
            <p className="text-sm text-[#5A6A7A] dark:text-white/40">Insufficient data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220} minHeight={220}>
              <LineChart data={wasteTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EC" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={5} />
                <YAxis tick={{ fontSize: 9 }} width={40} />
            <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="thisMonth" stroke="#E8A020" strokeWidth={2} dot={false} name="This Month" />
                <Line type="monotone" dataKey="lastMonth" stroke="#DDE3EC" strokeWidth={1.5} dot={false} name="Last Month" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
