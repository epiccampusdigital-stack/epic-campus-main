'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { MealLog, InventoryItem, MealType } from '@/types/kitchen'

const MEAL_SESSIONS: { type: MealType; label: string; icon: string; time: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: 'ti-coffee', time: '7:00 – 9:00 AM' },
  { type: 'lunch', label: 'Lunch', icon: 'ti-soup', time: '12:00 – 1:30 PM' },
  { type: 'dinner', label: 'Dinner', icon: 'ti-moon', time: '6:30 – 8:00 PM' },
  { type: 'tea', label: 'Afternoon Tea', icon: 'ti-cup', time: '3:30 – 4:30 PM' },
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function thisMonthPrefix(): string {
  return new Date().toISOString().slice(0, 7)
}

function weekAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export default function KitchenDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [todayLogs, setTodayLogs] = useState<MealLog[]>([])
  const [monthCost, setMonthCost] = useState(0)
  const [weekWaste, setWeekWaste] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const todayStr = today()
        const monthStr = thisMonthPrefix()
        const weekAgoStr = weekAgo()

        const [mealSnap, wasteSnap, invSnap] = await Promise.all([
          getDocs(collection(db, 'mealLogs')),
          getDocs(query(collection(db, 'wasteLog'), where('date', '>=', weekAgoStr))),
          getDocs(query(collection(db, 'inventory'), where('isActive', '==', true))),
        ])

        const allMeals = mealSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MealLog))
        setTodayLogs(allMeals.filter((m) => m.date === todayStr))

        const monthTotal = allMeals
          .filter((m) => m.date.startsWith(monthStr))
          .reduce((s, m) => s + (m.estimatedCost || 0), 0)
        setMonthCost(monthTotal)

        const wasteTotal = wasteSnap.docs.reduce(
          (s, d) => s + (Number(d.data().estimatedLoss) || 0), 0,
        )
        setWeekWaste(wasteTotal)

        const items = invSnap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)
        )
        setLowStockCount(items.filter((i) => i.currentStock <= i.minStockLevel).length)
      } catch (err) {
        console.error('[KitchenDashboard]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const todayServings = todayLogs.reduce(
    (s, m) => s + (m.studentCount || 0) + (m.staffCount || 0), 0,
  )

  const statCards = [
    { label: 'Meals Served Today', value: loading ? '…' : String(todayServings), icon: 'ti-users', color: 'text-[#0B3D6B] dark:text-[#E8A020]' },
    { label: 'Kitchen Cost This Month', value: loading ? '…' : formatLKR(monthCost), icon: 'ti-coin', color: 'text-[#0B3D6B] dark:text-[#E8A020]' },
    { label: 'Waste Value This Week', value: loading ? '…' : formatLKR(weekWaste), icon: 'ti-trash', color: 'text-red-600 dark:text-red-400' },
    { label: 'Low Stock Items', value: loading ? '…' : String(lowStockCount), icon: 'ti-alert-triangle', color: lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#0B3D6B] dark:text-[#E8A020]' },
  ]

  const quickActions = [
    { label: 'Log Meal', href: '/kitchen/meal-log', icon: 'ti-soup', color: 'bg-[#0B3D6B]' },
    { label: 'Log Waste', href: '/kitchen/waste', icon: 'ti-trash', color: 'bg-red-500' },
    { label: 'View Inventory', href: '/kitchen/inventory', icon: 'ti-package', color: 'bg-amber-500' },
    { label: 'View Reports', href: '/kitchen/reports', icon: 'ti-chart-bar', color: 'bg-emerald-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Low stock banner */}
      {!loading && lowStockCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-700/40 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <span className="ti ti-alert-triangle text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              ⚠ {lowStockCount} item{lowStockCount !== 1 ? 's are' : ' is'} running low
            </p>
          </div>
          <Link
            href="/kitchen/orders"
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Generate Order List
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((c) => (
          <div
            key={c.label}
            className="rounded-[12px] border border-white/90 bg-white/65 p-3 backdrop-blur-2xl transition-all duration-300 dark:border-white/[0.08] dark:bg-white/[0.05] sm:p-4"
          >
            <div className="flex items-center gap-2">
              <span className={`ti ${c.icon} text-lg ${c.color}`} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">
                {c.label}
              </p>
            </div>
            <p className={`mt-2 text-[18px] font-semibold leading-tight sm:text-[22px] ${c.color}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Today's meal sessions */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold text-[#0D1B2A] dark:text-white">
          Today&apos;s Meal Sessions
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {MEAL_SESSIONS.map((session) => {
            const log = todayLogs.find((m) => m.mealType === session.type)
            return (
              <div
                key={session.type}
                className="flex flex-col rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl transition-all duration-300 dark:border-white/[0.08] dark:bg-white/[0.05]"
              >
                <div className="flex items-center gap-2">
                  <span className={`ti ${session.icon} text-[#0B3D6B] dark:text-[#E8A020]`} />
                  <p className="font-semibold text-[#0D1B2A] text-sm dark:text-white">{session.label}</p>
                </div>
                <p className="mt-1 text-[11px] text-gray-400 dark:text-white/40">{session.time}</p>
                {log ? (
                  <div className="mt-3 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="ti ti-circle-check text-emerald-500 text-sm" />
                      <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">Logged</span>
                    </div>
                    <p className="mt-1 text-[12px] text-gray-600 dark:text-white/60">
                      {(log.studentCount || 0) + (log.staffCount || 0)} servings
                    </p>
                    <p className="text-[12px] text-[#0B3D6B] dark:text-[#E8A020]">
                      {formatLKR(log.estimatedCost || 0)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 flex-1 flex flex-col justify-between">
                    <p className="text-[12px] text-gray-400 dark:text-white/40">Not logged yet</p>
                    <Link
                      href={`/kitchen/meal-log?type=${session.type}`}
                      className="mt-3 inline-block rounded-lg bg-[#E8A020] px-3 py-1.5 text-center text-[11px] font-semibold text-white hover:bg-[#d4911c]"
                    >
                      Log Now
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold text-[#0D1B2A] dark:text-white">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-3 rounded-xl border border-white/90 bg-white/65 p-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.05]"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${a.color} text-white`}>
                <span className={`ti ${a.icon} text-base`} />
              </div>
              <span className="text-[13px] font-medium text-[#0D1B2A] dark:text-white">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
