'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import SinhalaToggle from '@/components/kitchen/SinhalaToggle'
import { daysUntilExpiry } from '@/lib/kitchen/expiryHelpers'
import { getFoodEmoji, MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { formatQty } from '@/lib/kitchen-utils'
import type { InventoryItem, MealLog, MealType } from '@/types/kitchen'

const MEAL_SESSIONS: { type: MealType; label: string }[] = [
  { type: 'morning-tea', label: 'Morning Tea' },
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'evening-tea', label: 'Evening Tea' },
  { type: 'tea', label: 'Tea' },
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function thisMonthPrefix(): string {
  return new Date().toISOString().slice(0, 7)
}

function monthLabel(): string {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function daysInCurrentMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

function dayOfMonth(): number {
  return new Date().getDate()
}

function weekAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

function normalizeDate(date: unknown): string {
  if (!date) return ''
  if (typeof date === 'string') return date.slice(0, 10)
  if (typeof date === 'object' && date !== null && 'toDate' in date) {
    const toDate = (date as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') return toDate.call(date).toISOString().slice(0, 10)
  }
  return String(date).slice(0, 10)
}

export default function KitchenDashboardPage() {
  const { user } = useKitchen()
  const { sinhala } = useKitchenSinhala()
  const [loading, setLoading] = useState(true)
  const [todayLogs, setTodayLogs] = useState<MealLog[]>([])
  const [monthCost, setMonthCost] = useState(0)
  const [weekWaste, setWeekWaste] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [lowStockModalOpen, setLowStockModalOpen] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const [studentCount, setStudentCount] = useState(0)
  const [totalStaffCount, setTotalStaffCount] = useState(0)
  const [lastDayCost, setLastDayCost] = useState(0)
  const [monthMealCount, setMonthMealCount] = useState(0)
  const [topIngredient, setTopIngredient] = useState<{ name: string; qty: number; unit: string } | null>(null)

  const isAdmin = user?.role === 'admin' || user?.role === 'owner'
  const monthKey = thisMonthPrefix()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const todayStr = today()
        const monthStr = thisMonthPrefix()
        const weekAgoStr = weekAgo()

        const [mealSnap, wasteSnap, invSnap, budgetSnap, studentsSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'mealLogs')),
          getDocs(query(collection(db, 'wasteLog'), where('date', '>=', weekAgoStr))),
          getDocs(query(collection(db, 'inventory'), where('isActive', '==', true))),
          getDoc(doc(db, 'kitchenBudget', monthStr)),
          // Head-count cards. Fetch full collections and count client-side (same
          // pattern as the management dashboard). Wrapped in .catch so a rules
          // denial degrades to 0 rather than breaking the whole dashboard load.
          getDocs(collection(db, 'students')).catch(() => null),
          getDocs(collection(db, 'users')).catch(() => null),
        ])

        // Active students = status === 'active' OR isActive === true.
        setStudentCount(
          studentsSnap
            ? studentsSnap.docs.filter((d) => {
                const x = d.data()
                return x.status === 'active' || x.isActive === true
              }).length
            : 0,
        )
        // Total staff = every user whose role is set and is not a student.
        setTotalStaffCount(
          usersSnap
            ? usersSnap.docs.filter((d) => {
                const r = String(d.data().role ?? '')
                return r !== '' && r !== 'student'
              }).length
            : 0,
        )

        const allMeals = mealSnap.docs.map((d) => {
          const data = d.data()
          return { id: d.id, ...data, date: normalizeDate(data.date) } as MealLog
        })
        setTodayLogs(allMeals.filter((m) => m.date === todayStr))

        const monthTotal = allMeals
          .filter((m) => m.date.startsWith(monthStr))
          .reduce((s, m) => s + (m.estimatedCost || 0), 0)
        setMonthCost(monthTotal)

        // Meals this month = count of meal-log docs in the current calendar month.
        setMonthMealCount(allMeals.filter((m) => m.date.startsWith(monthStr)).length)

        // Most-recent logged day's total cost — fallback for the per-student card
        // when nothing has been logged today yet.
        const loggedDates = Array.from(new Set(allMeals.map((m) => m.date).filter(Boolean))).sort()
        const lastDate = loggedDates[loggedDates.length - 1]
        setLastDayCost(
          lastDate ? allMeals.filter((m) => m.date === lastDate).reduce((s, m) => s + (m.estimatedCost || 0), 0) : 0,
        )

        // Top ingredient over the last 7 days (highest total qty used).
        const ingMap: Record<string, { qty: number; unit: string }> = {}
        for (const m of allMeals.filter((m) => m.date >= weekAgoStr)) {
          for (const ing of m.ingredientsUsed ?? []) {
            const name = String(ing.itemName ?? '')
            if (!name) continue
            if (!ingMap[name]) ingMap[name] = { qty: 0, unit: String(ing.unit ?? '') }
            ingMap[name].qty += Number(ing.qtyUsed || 0)
          }
        }
        let top: { name: string; qty: number; unit: string } | null = null
        for (const [name, v] of Object.entries(ingMap)) {
          if (v.qty > 0 && (!top || v.qty > top.qty)) top = { name, qty: v.qty, unit: v.unit }
        }
        setTopIngredient(top)

        const wasteTotal = wasteSnap.docs.reduce(
          (s, d) => s + (Number(d.data().estimatedLoss) || 0),
          0,
        )
        setWeekWaste(wasteTotal)

        const items = invSnap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
        setInventoryItems(items)
        const lowItems = items.filter((i) => i.currentStock <= i.minStockLevel)
        setLowStockItems(lowItems)
        setLowStockCount(lowItems.length)

        if (budgetSnap.exists()) {
          setMonthlyBudget(Number(budgetSnap.data().monthlyBudget) || 0)
        } else {
          setMonthlyBudget(0)
        }
      } catch (err) {
        console.error('[KitchenDashboard]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [monthKey])

  const expiringItems = inventoryItems
    .filter((i) => i.expiryDate && daysUntilExpiry(i.expiryDate) <= 7)
    .sort((a, b) => daysUntilExpiry(a.expiryDate!) - daysUntilExpiry(b.expiryDate!))

  const todayServings = todayLogs.reduce(
    (s, m) => s + (m.studentCount || 0) + (m.staffCount || 0),
    0,
  )

  const budgetPct = monthlyBudget > 0 ? (monthCost / monthlyBudget) * 100 : 0
  const remaining = monthlyBudget - monthCost
  const dailyAvg = dayOfMonth() > 0 ? monthCost / dayOfMonth() : 0
  const projectedMonthEnd = dailyAvg * daysInCurrentMonth()
  // Rough per-student daily food cost — helps kitchen judge cost efficiency.
  const perStudentDaily = studentCount > 0 && monthCost > 0 ? monthCost / studentCount / 30 : 0

  let barColor = 'bg-emerald-500'
  if (budgetPct >= 100) barColor = 'bg-red-600'
  else if (budgetPct >= 90) barColor = 'bg-red-500'
  else if (budgetPct >= 70) barColor = 'bg-amber-500'

  async function saveBudget() {
    const amount = Number(budgetInput)
    if (!amount || amount <= 0) return
    setBudgetSaving(true)
    try {
      await setDoc(
        doc(db, 'kitchenBudget', monthKey),
        {
          monthlyBudget: amount,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid ?? '',
        },
        { merge: true },
      )
      setMonthlyBudget(amount)
      setToast({ msg: 'Budget saved', kind: 'success' })
      setBudgetModalOpen(false)
    } catch (err) {
      console.error('Failed to save budget:', err)
      setToast({ msg: 'Failed to save budget. Please try again.', kind: 'error' })
      // keep the modal open so they can retry
    } finally {
      setBudgetSaving(false)
    }
  }

  // Cost per active student for today (falls back to the most recent logged day).
  const todayCost = todayLogs.reduce((s, m) => s + (m.estimatedCost || 0), 0)
  const costBasis = todayLogs.length > 0 ? todayCost : lastDayCost
  const costPerStudentDay = studentCount > 0 ? costBasis / studentCount : 0

  const statCards: {
    label: string
    value: string
    icon: string
    color: string
    subtext?: string
    small?: boolean
    valueCls?: string
  }[] = [
    { label: 'Active Students', value: loading ? '…' : String(studentCount), icon: 'ti-school', color: 'text-[#0B3D6B] dark:text-[#1A6BAD]' },
    { label: 'Total Staff', value: loading ? '…' : String(totalStaffCount), icon: 'ti-users-group', color: 'text-[#E8A020]', subtext: 'Across all departments' },
    !loading && todayLogs.length === 0
      ? { label: 'Meals Today', value: 'No meals logged yet today', icon: 'ti-soup', color: 'text-amber-600 dark:text-amber-400', small: true }
      : { label: 'Meals Today', value: loading ? '…' : String(todayServings), icon: 'ti-soup', color: 'text-[#0B3D6B] dark:text-[#E8A020]', subtext: 'People served today' },
    { label: 'Cost Per Student / Day', value: loading ? '…' : formatLKR(costPerStudentDay), icon: 'ti-coin', color: 'text-[#0B3D6B] dark:text-[#E8A020]', subtext: "Based on today's meals" },
    { label: 'Waste This Week', value: loading ? '…' : formatLKR(weekWaste), icon: 'ti-trash', color: 'text-red-600 dark:text-red-400' },
    { label: 'Low Stock', value: loading ? '…' : String(lowStockCount), icon: 'ti-alert-triangle', color: lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#0B3D6B] dark:text-[#E8A020]' },
    { label: 'Meals This Month', value: loading ? '…' : String(monthMealCount), icon: 'ti-calendar-stats', color: 'text-[#0B3D6B] dark:text-[#E8A020]', subtext: 'Breakfast + Lunch + Dinner + Tea' },
    {
      label: 'Top Ingredient',
      value: loading ? '…' : (topIngredient?.name ?? '—'),
      icon: 'ti-carrot',
      color: 'text-emerald-600 dark:text-emerald-400',
      subtext: loading ? undefined : topIngredient ? `${formatQty(topIngredient.qty, topIngredient.unit)} this week` : 'No usage this week',
      valueCls: 'text-lg',
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
      {toast && (
        <div className={`fixed bottom-6 right-4 z-[70] rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${toast.kind === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}
      {!loading && lowStockCount > 0 && (
        <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <span className="ti ti-alert-triangle text-xl text-amber-600 dark:text-amber-400" />
            <p className="text-base font-semibold text-amber-800 dark:text-amber-300">
              {lowStockCount} item{lowStockCount !== 1 ? 's are' : ' is'} running low
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={() => setLowStockModalOpen(true)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-[#E8A020] bg-transparent text-sm font-bold text-[#E8A020] hover:bg-[#E8A020]/10 sm:w-auto sm:px-4"
            >
              View Low Stock Items
            </button>
            <Link
              href="/kitchen/orders"
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#E8A020] text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c] sm:w-auto sm:px-4"
            >
              Generate Order List
            </Link>
          </div>
        </div>
      )}

      {!loading && expiringItems.length > 0 && (
        <div className="rounded-xl border border-white/90 bg-white/65 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <h2 className="mb-3 text-base font-bold text-[#0D1B2A] dark:text-white">Expiring Soon</h2>
          <ul className="space-y-2">
            {expiringItems.map((item) => {
              const days = daysUntilExpiry(item.expiryDate!)
              const colorClass =
                days < 0
                  ? 'text-red-600 dark:text-red-400'
                  : days <= 3
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-yellow-600 dark:text-yellow-400'
              const daysLabel =
                days < 0
                  ? 'Expired'
                  : days === 0
                    ? 'Expires today'
                    : days === 1
                      ? '1 day left'
                      : `${days} days left`
              return (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium text-[#0D1B2A] dark:text-white">
                    <span className="text-xl">{getFoodEmoji(item.itemName)}</span>
                    {item.itemName}
                  </span>
                  <span className={`shrink-0 font-semibold ${colorClass}`}>{daysLabel}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {statCards.map((c) => (
          <div
            key={c.label}
            className="relative flex min-h-[100px] flex-col justify-center rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05]"
          >
            <span className={`ti ${c.icon} absolute right-3 top-3 text-xl ${c.color}`} aria-hidden="true" />
            <p className="pr-6 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">
              {c.label}
            </p>
            <p className={`mt-1 truncate font-bold leading-tight ${c.small ? 'text-sm' : c.valueCls ?? 'text-2xl'} ${c.color}`}>
              {c.value}
            </p>
            {c.subtext && <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/40">{c.subtext}</p>}
          </div>
        ))}

        {/* CARD 9 — Monthly Budget status */}
        <div className="relative flex min-h-[100px] flex-col justify-center rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <span className={`ti ti-wallet absolute right-3 top-3 text-xl ${
            monthlyBudget > 0
              ? budgetPct >= 90 ? 'text-red-500' : budgetPct >= 70 ? 'text-amber-500' : 'text-emerald-500'
              : 'text-gray-400'
          }`} aria-hidden="true" />
          <p className="pr-6 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Monthly Budget</p>
          {loading ? (
            <p className="mt-1 text-2xl font-bold text-gray-400">…</p>
          ) : monthlyBudget > 0 ? (
            <>
              <p className={`mt-1 text-2xl font-bold leading-tight ${
                budgetPct >= 90 ? 'text-red-600 dark:text-red-400' : budgetPct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {Math.round(budgetPct)}%
              </p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, budgetPct)}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/40">{formatLKR(monthCost)} / {formatLKR(monthlyBudget)}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-bold text-gray-500 dark:text-white/50">No budget set</p>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => { setBudgetInput(''); setBudgetModalOpen(true) }}
                  className="mt-1 self-start text-[11px] font-semibold text-[#0B3D6B] underline dark:text-[#E8A020]"
                >
                  Set Budget
                </button>
              ) : (
                <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/40">Ask an admin to set one</p>
              )}
            </>
          )}
        </div>
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
              className="inline-flex items-center gap-1 rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-sm font-medium text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-white/10 dark:text-white"
            >
              <span className="ti ti-pencil" aria-hidden="true" />
              Edit Budget
            </button>
          )}
        </div>

        {monthlyBudget > 0 ? (
          <>
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            {budgetPct > 100 && (
              <span className="mt-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                OVER BUDGET
              </span>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-bold text-[#0B3D6B] dark:text-white">
                Spent: {formatLKR(monthCost)}
              </span>
              <span className="text-gray-500 dark:text-white/50">/ {formatLKR(monthlyBudget)} budget</span>
              <span
                className={`font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {formatLKR(Math.abs(remaining))} {remaining >= 0 ? 'remaining' : 'over'}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-white/40">
              Daily average: {formatLKR(dailyAvg)} | Projected month end: {formatLKR(projectedMonthEnd)}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-white/50">
            No budget set for this month.
            {isAdmin && ' Click Edit Budget to set one.'}
          </p>
        )}

        {perStudentDaily > 0 && (
          <p className="mt-3 border-t border-[#DDE3EC] pt-2 text-xs font-medium text-[#0B3D6B] dark:border-white/[0.06] dark:text-white/60">
            ~{formatLKR(perStudentDaily)} per student per day
          </p>
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
              className="w-full max-w-sm rounded-xl border border-[#DDE3EC] bg-white p-6 shadow-xl dark:border-white/10 dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-[#0D1B2A] dark:text-white">Set Monthly Budget</h3>
              <label className="mt-4 block text-sm font-medium text-gray-600 dark:text-white/70">
                Monthly budget (LKR)
              </label>
              <input
                type="number"
                min="0"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="mt-2 w-full min-h-[48px] rounded-xl border border-[#DDE3EC] px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setBudgetModalOpen(false)}
                  className="flex-1 min-h-[44px] rounded-xl border border-[#DDE3EC] text-sm font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveBudget}
                  disabled={budgetSaving}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#E8A020] text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
                >
                  {budgetSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {lowStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLowStockModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#0d1a2e] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
                ⚠️ Low Stock Items ({lowStockItems.length})
              </h2>
              <button type="button" onClick={() => setLowStockModalOpen(false)} className="text-[#5A6A7A] hover:text-[#0B3D6B]">
                <span className="ti ti-x text-xl" />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm text-[#0D1B2A] dark:text-white">{item.itemName}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Stock: {formatQty(item.currentStock, item.unit)} — Min: {formatQty(item.minStockLevel, item.unit)}
                    </p>
                  </div>
                  <span className="text-xl">{item.emoji ?? '📦'}</span>
                </div>
              ))}
            </div>
            <a href="/kitchen/inventory" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B]">
              <span className="ti ti-arrow-right" /> Go to Inventory
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
