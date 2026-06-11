'use client'

import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
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
import {
  getWeekRange,
  getMonthRange,
  normalizeKitchenDate,
} from '@/lib/kitchen/dateHelpers'
import {
  buildKitchenReportSummary,
  downloadKitchenReportPDF,
  generateKitchenReportPDF,
} from '@/lib/kitchen/generateKitchenReport'
import { fetchActiveInventory } from '@/lib/kitchen/fetchActiveInventory'
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

function parseMealLog(id: string, data: Record<string, unknown>): MealLog {
  return {
    id,
    date: normalizeKitchenDate(data.date),
    mealType: data.mealType as MealLog['mealType'],
    studentCount: Number(data.studentCount ?? 0),
    staffCount: Number(data.staffCount ?? 0),
    totalServings: Number(data.totalServings ?? 0),
    ingredientsUsed: Array.isArray(data.ingredientsUsed)
      ? (data.ingredientsUsed as MealLog['ingredientsUsed'])
      : [],
    estimatedCost: Number(data.estimatedCost ?? 0),
    costPerPerson: Number(data.costPerPerson ?? 0),
    notes: String(data.notes ?? ''),
    loggedBy: String(data.loggedBy ?? ''),
    loggedByName: String(data.loggedByName ?? ''),
    createdAt: data.createdAt as MealLog['createdAt'],
  }
}

function parseWasteEntry(id: string, data: Record<string, unknown>): WasteEntry {
  return {
    id,
    date: normalizeKitchenDate(data.date),
    itemId: String(data.itemId ?? ''),
    itemName: String(data.itemName ?? ''),
    quantity: Number(data.quantity ?? 0),
    unit: data.unit as WasteEntry['unit'],
    reason: data.reason as WasteEntry['reason'],
    estimatedLoss: Number(data.estimatedLoss ?? 0),
    mealLogId: data.mealLogId ? String(data.mealLogId) : undefined,
    notes: String(data.notes ?? ''),
    loggedBy: String(data.loggedBy ?? ''),
    loggedByName: String(data.loggedByName ?? ''),
    createdAt: data.createdAt as WasteEntry['createdAt'],
  }
}

export default function ReportsPage() {
  const [meals, setMeals] = useState<MealLog[]>([])
  const [waste, setWaste] = useState<WasteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState<'weekly' | 'monthly' | null>(null)
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(monthEnd())
  const [monthlyBudget, setMonthlyBudget] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const monthKey = new Date().toISOString().slice(0, 7)
        const [mealSnap, wasteSnap, budgetSnap] = await Promise.all([
          getDocs(collection(db, 'mealLogs')),
          getDocs(collection(db, 'wasteLog')),
          getDoc(doc(db, 'kitchenBudget', monthKey)),
        ])
        setMeals(
          mealSnap.docs.map((d) => parseMealLog(d.id, d.data() as Record<string, unknown>)),
        )
        setWaste(
          wasteSnap.docs.map((d) => parseWasteEntry(d.id, d.data() as Record<string, unknown>)),
        )
        if (budgetSnap.exists()) {
          setMonthlyBudget(Number(budgetSnap.data().monthlyBudget) || 0)
        }
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

  const uniqueDays = new Set(filteredMeals.map((m) => m.date)).size || 1
  const avgCostPerPersonPerDay = totalServings > 0 ? totalSpent / totalServings : 0
  const wastePercent = totalSpent > 0 ? (totalWasteCost / totalSpent) * 100 : 0

  const weeklyBudget = monthlyBudget > 0 ? monthlyBudget / 4 : 0
  const monthRange = getMonthRange(startDate)
  const weeksInRange: { label: string; start: string; end: string; spend: number }[] = []
  {
    let cursor = new Date(`${monthRange.start}T12:00:00`)
    const rangeEnd = new Date(`${monthRange.end}T12:00:00`)
    let weekNum = 1
    while (cursor <= rangeEnd) {
      const wk = getWeekRange(cursor.toISOString().slice(0, 10))
      const spend = meals
        .filter((m) => m.date >= wk.start && m.date <= wk.end)
        .reduce((s, m) => s + m.estimatedCost, 0)
      if (wk.start <= monthRange.end && wk.end >= monthRange.start) {
        weeksInRange.push({
          label: `Week ${weekNum}`,
          start: wk.start,
          end: wk.end,
          spend,
        })
        weekNum += 1
      }
      cursor.setDate(cursor.getDate() + 7)
      if (weekNum > 6) break
    }
  }

  async function downloadReport(type: 'weekly' | 'monthly') {
    setPdfLoading(type)
    try {
      const refDate = type === 'weekly' ? startDate : startDate
      const range = type === 'weekly' ? getWeekRange(refDate) : getMonthRange(refDate)
      const periodMeals = meals.filter((m) => m.date >= range.start && m.date <= range.end)
      const periodWaste = waste.filter((w) => w.date >= range.start && w.date <= range.end)
      const inventory = await fetchActiveInventory()
      const summary = buildKitchenReportSummary(periodMeals, periodWaste)
      const bytes = await generateKitchenReportPDF({
        periodType: type,
        periodLabel: range.label,
        startDate: range.start,
        endDate: range.end,
        generatedAt: new Date(),
        meals: periodMeals,
        waste: periodWaste,
        inventory,
        summary,
      })
      const slug = type === 'weekly' ? range.start : range.label.replace(/\s+/g, '-')
      downloadKitchenReportPDF(bytes, `EpicCampus-Kitchen-${slug}.pdf`)
    } catch (err) {
      console.error('[Kitchen PDF]', err)
    } finally {
      setPdfLoading(null)
    }
  }

  const dailyCostData = Array.from({ length: 30 }, (_, i) => {
    const date = daysAgo(29 - i)
    const cost = meals.filter((m) => m.date === date).reduce((s, m) => s + m.estimatedCost, 0)
    return { date: date.slice(5), cost }
  })

  const itemWaste: Record<string, number> = {}
  waste.forEach((w) => {
    itemWaste[w.itemName] = (itemWaste[w.itemName] || 0) + w.estimatedLoss
  })
  const topWasted = Object.entries(itemWaste)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }))

  const mealsServedData = Array.from({ length: 14 }, (_, i) => {
    const date = daysAgo(13 - i)
    const dayMeals = meals.filter((m) => m.date === date)
    return {
      date: date.slice(5),
      students: dayMeals.reduce((s, m) => s + m.studentCount, 0),
      staff: dayMeals.reduce((s, m) => s + m.staffCount, 0),
    }
  })

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
        <div className="no-print flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadReport('weekly')}
            disabled={pdfLoading !== null}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-[#E8A020] bg-transparent px-4 py-2 text-sm font-bold text-[#E8A020] hover:bg-[#E8A020]/10 disabled:opacity-50"
          >
            <span className="ti ti-file-download" />
            {pdfLoading === 'weekly' ? 'Generating…' : 'Weekly Report PDF'}
          </button>
          <button
            type="button"
            onClick={() => downloadReport('monthly')}
            disabled={pdfLoading !== null}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-[#E8A020] bg-transparent px-4 py-2 text-sm font-bold text-[#E8A020] hover:bg-[#E8A020]/10 disabled:opacity-50"
          >
            <span className="ti ti-file-download" />
            {pdfLoading === 'monthly' ? 'Generating…' : 'Monthly Report PDF'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden min-h-[44px] items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-4 py-2 text-sm font-medium text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white md:flex"
          >
            <span className="ti ti-printer" /> Print Report
          </button>
        </div>
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

      {monthlyBudget > 0 && weeksInRange.length > 0 && (
        <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">
            Budget vs Actual (weekly budget: {formatLKR(weeklyBudget)})
          </h2>
          <div className="space-y-3">
            {weeksInRange.map((wk) => {
              const diff = wk.spend - weeklyBudget
              const over = diff > 0
              return (
                <div
                  key={wk.label}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F5F7FB] px-4 py-3 dark:bg-white/[0.04]"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">{wk.label}</p>
                    <p className="text-xs text-gray-500">
                      {wk.start.slice(5)} – {wk.end.slice(5)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#0B3D6B] dark:text-[#E8A020]">
                      {formatLKR(wk.spend)}
                    </p>
                    <p
                      className={`text-xs font-semibold ${over ? 'text-red-600' : 'text-emerald-600'}`}
                    >
                      {over ? `${formatLKR(diff)} over` : `${formatLKR(Math.abs(diff))} under`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
