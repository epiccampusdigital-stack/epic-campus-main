'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import SinhalaToggle from '@/components/kitchen/SinhalaToggle'
import { MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { MealLog, InventoryItem, MealType } from '@/types/kitchen'

const MEAL_SESSIONS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'tea', label: 'Tea' },
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
  const { sinhala } = useKitchenSinhala()
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
          (s, d) => s + (Number(d.data().estimatedLoss) || 0),
          0,
        )
        setWeekWaste(wasteTotal)

        const items = invSnap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
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
    (s, m) => s + (m.studentCount || 0) + (m.staffCount || 0),
    0,
  )

  const statCards = [
    {
      label: 'Meals Today',
      value: loading ? '…' : String(todayServings),
      icon: 'ti-users',
      color: 'text-[#0B3D6B] dark:text-[#E8A020]',
    },
    {
      label: 'Cost This Month',
      value: loading ? '…' : formatLKR(monthCost),
      icon: 'ti-coin',
      color: 'text-[#0B3D6B] dark:text-[#E8A020]',
    },
    {
      label: 'Waste This Week',
      value: loading ? '…' : formatLKR(weekWaste),
      icon: 'ti-trash',
      color: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Low Stock',
      value: loading ? '…' : String(lowStockCount),
      icon: 'ti-alert-triangle',
      color:
        lowStockCount > 0
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-[#0B3D6B] dark:text-[#E8A020]',
    },
  ]

  const quickActions = [
    { label: 'Log Meal', href: '/kitchen/meal-log', icon: 'ti-soup', color: 'bg-[#0B3D6B]' },
    { label: 'Log Waste', href: '/kitchen/waste', icon: 'ti-trash', color: 'bg-red-500' },
    { label: 'Inventory', href: '/kitchen/inventory', icon: 'ti-package', color: 'bg-amber-500' },
    { label: 'Reports', href: '/kitchen/reports', icon: 'ti-chart-bar', color: 'bg-emerald-600' },
  ]

  return (
    <div className="space-y-5 md:space-y-6">
      {!loading && lowStockCount > 0 && (
        <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <span className="ti ti-alert-triangle text-xl text-amber-600 dark:text-amber-400" />
            <p className="text-base font-semibold text-amber-800 dark:text-amber-300">
              {lowStockCount} item{lowStockCount !== 1 ? 's are' : ' is'} running low
            </p>
          </div>
          <Link
            href="/kitchen/orders"
            className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-amber-600 text-sm font-bold text-white hover:bg-amber-700 md:mt-0 md:ml-auto md:w-auto md:px-4"
          >
            Generate Order List
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {statCards.map((c) => (
          <div
            key={c.label}
            className="flex min-h-[80px] flex-col justify-center rounded-[12px] border border-white/90 bg-white/65 p-3 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05] sm:p-4"
          >
            <div className="flex items-center gap-2">
              <span className={`ti ${c.icon} text-lg ${c.color}`} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40 sm:text-xs">
                {c.label}
              </p>
            </div>
            <p className={`mt-2 text-xl font-bold leading-tight sm:text-2xl ${c.color}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <SinhalaToggle />

      <div>
        <h2 className="mb-3 text-base font-bold text-[#0D1B2A] md:text-[15px] dark:text-white">
          Today&apos;s Meal Sessions
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {MEAL_SESSIONS.map((session) => {
            const log = todayLogs.find((m) => m.mealType === session.type)
            const visual = MEAL_SESSION_VISUAL[session.type]
            const servings = log ? (log.studentCount || 0) + (log.staffCount || 0) : 0
            return (
              <div
                key={session.type}
                className="flex min-h-[140px] flex-col rounded-2xl border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05]"
              >
                <div className="text-center">
                  <span
                    className="text-[48px] leading-none lg:text-5xl"
                    role="img"
                    aria-hidden="true"
                  >
                    {visual?.emoji}
                  </span>
                  <p className="mt-1 text-sm font-bold text-[#0D1B2A] md:text-base dark:text-white">
                    {session.label}
                  </p>
                  {sinhala && visual?.sinhala && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{visual.sinhala}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/40">{visual?.time}</p>
                </div>

                {log ? (
                  <div className="mt-2 flex flex-1 flex-col items-center justify-end">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      ✓ Logged
                    </span>
                    <p className="mt-1 text-sm font-semibold text-[#0D1B2A] dark:text-white">
                      {servings} served
                    </p>
                    <p className="text-sm font-bold text-[#E8A020]">
                      {formatLKR(log.estimatedCost || 0)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-1 flex-col justify-end">
                    <Link
                      href={`/kitchen/meal-log?type=${session.type}`}
                      className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-white hover:bg-[#d4911c]"
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

      <div>
        <h2 className="mb-3 text-base font-bold text-[#0D1B2A] md:text-[15px] dark:text-white">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex min-h-[64px] items-center gap-3 rounded-xl border border-white/90 bg-white/65 p-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.05]"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${a.color} text-white`}
              >
                <span className={`ti ${a.icon} text-base`} />
              </div>
              <span className="text-sm font-semibold text-[#0D1B2A] dark:text-white">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
