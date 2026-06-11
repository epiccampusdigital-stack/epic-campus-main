'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import SinhalaToggle from '@/components/kitchen/SinhalaToggle'
import { MEAL_SESSION_VISUAL, getFoodEmoji } from '@/lib/kitchen/foodImages'
import { daysInMonth } from '@/lib/kitchen/dateHelpers'
import { daysUntilExpiry, getExpiryStatus } from '@/lib/kitchen/expiryHelpers'
import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { MealLog, InventoryItem } from '@/types/kitchen'

const MEAL_SESSIONS: { type: MealLog['mealType']; label: string }[] = [
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

function monthLabel(): string {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function KitchenDashboardPage() {
  const { user } = useKitchen()
  const { sinhala } = useKitchenSinhala()
  const [loading, setLoading] = useState(true)
  const [todayLogs, setTodayLogs] = useState<MealLog[]>([])
  const [monthCost, setMonthCost] = useState(0)
  const [weekWaste, setWeekWaste] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetSaving, setBudgetSaving] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'owner'
  const monthKey = thisMonthPrefix()
  const now = new Date()
  const daysInMo = daysInMonth(now.getFullYear(), now.getMonth())
  const dayOfMonth = now.getDate()
  const dailyAverage = dayOfMonth > 0 ? monthCost / dayOfMonth : 0
  const projectedMonthEnd = dailyAverage * daysInMo
  const budgetPct = monthlyBudget > 0 ? (monthCost / monthlyBudget) * 100 : 0
  const remaining = monthlyBudget - monthCost

  const expiringItems = inventoryItems
    .filter((i) => i.expiryDate && daysUntilExpiry(i.expiryDate) <= 7)
    .sort((a, b) => daysUntilExpiry(a.expiryDate!) - daysUntilExpiry(b.expiryDate!))

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const todayStr = today()
        const monthStr = thisMonthPrefix()
        const weekAgoStr = weekAgo()

        const [mealSnap, wasteSnap, invSnap, budgetSnap] = await Promise.all([
          getDocs(collection(db, 'mealLogs')),
          getDocs(query(collection(db, 'wasteLog'), where('date', '>=', weekAgoStr))),
          getDocs(query(collection(db, 'inventory'), where('isActive', '==', true))),
          getDoc(doc(db, 'kitchenBudget', monthStr)),
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
        setInventoryItems(items)
        setLowStockCount(items.filter((i) => i.currentStock <= i.minStockLevel).length)

        if (budgetSnap.exists()) {
          setMonthlyBudget(Number(budgetSnap.data().monthlyBudget) || 0)
        }
      } catch (err) {
        console.error('[KitchenDashboard]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function saveBudget() {
    const amount = Number(budgetInput)
    if (!amount || amount <= 0 || !user) return
    setBudgetSaving(true)
    try {
      await setDoc(
        doc(db, 'kitchenBudget', monthKey),
        {
          monthlyBudget: amount,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true },
      )
      setMonthlyBudget(amount)
      setBudgetModalOpen(false)
    } catch (err) {
      console.error('[KitchenBudget]', err)
    } finally {
      setBudgetSaving(false)
    }
  }

  function progressColor(): string {
    if (budgetPct >= 100) return 'bg-red-500'
    if (budgetPct >= 90) return 'bg-red-500'
    if (budgetPct >= 70) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

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

      {!loading && expiringItems.length > 0 && (
        <div className="rounded-xl border border-white/90 bg-white/65 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <h2 className="mb-3 text-base font-bold text-[#0D1B2A] dark:text-white">Expiring Soon</h2>
          <ul className="space-y-2">
            {expiringItems.map((item) => {
              const days = daysUntilExpiry(item.expiryDate!)
              const status = getExpiryStatus(item)
              const colorClass =
                status === 'expired'
                  ? 'text-red-600 dark:text-red-400'
                  : status === 'alert'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-yellow-600 dark:text-yellow-400'
              return (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-xl">{getFoodEmoji(item.itemName)}</span>
                    <span className="truncate font-medium text-[#0D1B2A] dark:text-white">
                      {item.itemName}
                    </span>
                  </span>
                  <span className={`shrink-0 font-semibold ${colorClass}`}>
                    {days < 0
                      ? `Expired ${Math.abs(days)}d ago`
                      : days === 0
                        ? 'Expires today'
                        : `${days}d left`}
                  </span>
                </li>
              )
            })}
          </ul>
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

      <div className="rounded-xl border border-white/90 bg-white/65 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] md:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#0D1B2A] dark:text-white">
            {monthLabel()} Budget
          </h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setBudgetInput(monthlyBudget > 0 ? String(monthlyBudget) : '')
                setBudgetModalOpen(true)
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/5 dark:text-[#E8A020]"
            >
              <span className="ti ti-pencil" aria-hidden="true" />
              Edit Budget
            </button>
          )}
        </div>

        {monthlyBudget <= 0 ? (
          <p className="text-sm text-gray-500 dark:text-white/50">
            No budget set for this month.{isAdmin ? ' Tap Edit Budget to set one.' : ''}
          </p>
        ) : (
          <>
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-full rounded-full transition-all ${progressColor()}`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            {budgetPct >= 100 && (
              <span className="mt-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                OVER BUDGET
              </span>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-bold text-[#0B3D6B] dark:text-white">
                Spent: {formatLKR(monthCost)}
              </span>
              <span className="text-gray-500 dark:text-white/50">
                / {formatLKR(monthlyBudget)} budget
              </span>
              <span
                className={`font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {formatLKR(Math.abs(remaining))} {remaining >= 0 ? 'remaining' : 'over'}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-white/40">
              Daily average: {formatLKR(dailyAverage)} | Projected month end:{' '}
              {formatLKR(projectedMonthEnd)}
            </p>
          </>
        )}
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

      {budgetModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setBudgetModalOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-sm rounded-xl border border-[#DDE3EC] bg-white p-6 shadow-xl dark:border-gray-600 dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-[#0D1B2A] dark:text-white">
                Set Monthly Budget
              </h3>
              <label className="mb-2 mt-4 block text-sm font-medium text-gray-600 dark:text-white/60">
                Monthly budget (LKR)
              </label>
              <input
                type="number"
                min="0"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setBudgetModalOpen(false)}
                  className="flex-1 rounded-xl border border-[#DDE3EC] py-3 text-sm font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveBudget}
                  disabled={budgetSaving || !budgetInput}
                  className="flex-1 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
                >
                  {budgetSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
