'use client'

import { useEffect, useRef, useState } from 'react'
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import { getFoodEmoji } from '@/lib/kitchen/foodImages'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { formatQty } from '@/lib/kitchen-utils'
import { downloadOrderChecklistPdf } from '@/lib/kitchen/orderChecklistPdf'
import { downloadKitchenBudgetPdf, type KitchenAiBudget } from '@/lib/kitchen/budgetAnalysisPdf'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { InventoryItem, KitchenOrder, OrderItem, OrderStatus } from '@/types/kitchen'

// Category grouping for the order list (Step 3). `matches` holds every stored
// category value (lowercased) that maps into the group; 'other' is the catch-all.
interface CategoryGroupDef {
  key: string
  label: string
  emoji: string
  headerCls: string
  matches: string[]
}
const CATEGORY_GROUPS: CategoryGroupDef[] = [
  { key: 'vegetables', label: 'Vegetables', emoji: '🥦', headerCls: 'bg-green-700 dark:bg-green-800', matches: ['vegetables', 'vegetable'] },
  { key: 'protein', label: 'Meat & Protein', emoji: '🍖', headerCls: 'bg-red-700 dark:bg-red-800', matches: ['protein', 'meat', 'meat & fish', 'fish'] },
  { key: 'grains', label: 'Grains & Rice', emoji: '🌾', headerCls: 'bg-amber-700 dark:bg-amber-800', matches: ['grains', 'grain', 'rice', 'grains & rice'] },
  { key: 'dairy', label: 'Dairy', emoji: '🥛', headerCls: 'bg-blue-700 dark:bg-blue-800', matches: ['dairy', 'dairy & eggs'] },
  { key: 'condiments', label: 'Condiments & Spices', emoji: '🧂', headerCls: 'bg-orange-700 dark:bg-orange-800', matches: ['condiments', 'condiment', 'spices', 'spice', 'condiments & spices'] },
  { key: 'beverages', label: 'Beverages', emoji: '🧃', headerCls: 'bg-purple-700 dark:bg-purple-800', matches: ['beverages', 'beverage'] },
  { key: 'other', label: 'Other', emoji: '📦', headerCls: 'bg-gray-700 dark:bg-gray-800', matches: [] },
]

const NON_OTHER_MATCHES = new Set(
  CATEGORY_GROUPS.filter((g) => g.key !== 'other').flatMap((g) => g.matches),
)

/** Buckets order items into the display groups above, preserving group order and
 *  dropping empty groups. Anything whose category doesn't match a named group
 *  (including missing categories) falls into 'Other'. */
function groupOrderItems(items: OrderItem[]): (CategoryGroupDef & { items: OrderItem[] })[] {
  return CATEGORY_GROUPS.map((g) => ({
    ...g,
    items: items.filter((it) => {
      const c = String(it.category ?? '').toLowerCase()
      if (g.key === 'other') return !NON_OTHER_MATCHES.has(c)
      return g.matches.includes(c)
    }),
  })).filter((g) => g.items.length > 0)
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ordered: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  received: 'bg-teal-50 text-teal-700 border-teal-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

// Cap an order quantity at a sane per-order maximum so a bad calc can't request
// hundreds of kg. Discrete "units" items get a higher ceiling than weighed goods.
function capOrderQty(qty: number, unit: string): number {
  const max = unit === 'units' ? 500 : 100
  return Math.min(qty, max)
}

// Round an order qty to a buyable increment for its unit, then floor it to the
// 0.5 minimum (never recommend trace amounts). Step 2 rounding rules.
function roundOrderQty(qty: number, unit: string): number {
  let q = qty
  if (unit === 'grams') q = Math.round(q / 50) * 50
  else if (unit === 'units') q = Math.round(q)
  else q = Number(q.toFixed(1)) // kg / litres → 1 decimal
  return Math.max(0.5, q)
}

/** Low-stock reorder logic (Step 2). Returns the recommended qty, or null when
 *  the item should NOT be in the order list. */
function lowStockOrderQty(item: InventoryItem): number | null {
  const { currentStock: cur, minStockLevel: min, unit } = item
  // No minimum configured but stock on hand → can't compute a need, exclude.
  if (min === 0 && cur > 0) return null
  const include = cur < min || cur === 0 || cur <= min * 0.25
  if (!include) return null
  let qty = 0
  if (cur === 0) qty = min * 2 // out of stock → ~2 weeks
  else if (cur < min) qty = (min - cur) * 1.2 // refill + 20% buffer
  return roundOrderQty(capOrderQty(qty, unit), unit)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// Colour "Days Left" by urgency: red < 7, amber 7–14, green > 14.
function daysLeftColor(d: number | null): string {
  if (d == null) return 'text-gray-400 dark:text-white/40'
  if (d < 7) return 'text-red-600 dark:text-red-400'
  if (d <= 14) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

const RANGE_PRESETS = [7, 14, 30, 60, 90] as const

// AI Budget Analysis (FIX 5B) display helpers.
const BUDGET_COLORS: Record<string, string> = {
  Proteins: '#dc2626',
  Vegetables: '#059669',
  Grains: '#E8A020',
  Dairy: '#1A6BAD',
  Condiments: '#9333EA',
  Other: '#6b7280',
}

function ratingTone(r: string): { label: string; cls: string } {
  switch (r) {
    case 'excellent':
      return { label: 'Excellent', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }
    case 'good':
      return { label: 'Good', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
    case 'high':
      return { label: 'High', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
    case 'critical':
      return { label: 'Critical', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
    default:
      return { label: r || '—', cls: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50' }
  }
}

function priorityTone(p: string): string {
  switch (p) {
    case 'urgent':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'optional':
      return 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50'
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
}

function formatOrderDate(ts: unknown): string {
  if (!ts) return ''
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000).toLocaleDateString('en-LK')
  }
  return ''
}

export default function OrdersPage() {
  const { user } = useKitchen()
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [errorToast, setErrorToast] = useState('')
  const [generated, setGenerated] = useState(false)
  const [studentTarget, setStudentTarget] = useState('130')
  const [smartLoading, setSmartLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const aiRef = useRef<HTMLDivElement>(null)

  // Date-range filter for usage-based (smart) ordering.
  const [fromDate, setFromDate] = useState(daysAgoIso(30))
  const [toDate, setToDate] = useState(todayIso())
  const [activeRange, setActiveRange] = useState<number | 'custom'>(30)
  const [rangeInfo, setRangeInfo] = useState<{ from: string; to: string; days: number } | null>(null)
  // Per-item usage stats keyed by itemId, populated when a smart order is generated.
  const [usageStats, setUsageStats] = useState<
    Record<string, { dailyAvg: number; daysLeft: number | null; daysOfData: number; dataQuality: 'ok' | 'limited' | 'no-history' }>
  >({})
  // Items below minimum but with NO usage history — need a human to set the qty (FIX 1).
  const [manualReviewItems, setManualReviewItems] = useState<OrderItem[]>([])
  const [showManualReview, setShowManualReview] = useState(true)
  // Active student count (for target scaling, FIX 4) + note shown on the list.
  const [actualStudentCount, setActualStudentCount] = useState(0)
  const [scaleNote, setScaleNote] = useState<{ target: number; actual: number } | null>(null)
  const [customDays, setCustomDays] = useState('') // FIX 5A
  // AI Budget Analysis (FIX 5B)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiData, setAiData] = useState<KitchenAiBudget | null>(null)
  const [aiError, setAiError] = useState('')

  function applyPreset(days: number) {
    setActiveRange(days)
    setCustomDays('')
    setFromDate(daysAgoIso(days))
    setToDate(todayIso())
  }

  // FIX 5A — "Or enter days" input under Custom: N days → from = today-N, to = today.
  function applyCustomDays(value: string) {
    setCustomDays(value)
    const n = parseInt(value, 10)
    if (Number.isFinite(n) && n > 0) {
      setFromDate(daysAgoIso(n))
      setToDate(todayIso())
    }
  }

  function scrollToList() {
    // Defer to next tick so the generated list has rendered before we scroll to it.
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function loadData() {
    setLoading(true)
    try {
      const [orderSnap, invSnap, studentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'kitchenOrders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'inventory'), orderBy('itemName'))).catch(() =>
          getDocs(collection(db, 'inventory'))
        ),
        // Active students for target scaling (FIX 4). Wrapped in .catch so a rules
        // denial for the kitchen role degrades to 0 (scaling then falls back to raw).
        getDocs(query(collection(db, 'students'), where('status', '==', 'active'))).catch(() => null),
      ])
      setOrders(orderSnap.docs.map((d) => ({ id: d.id, ...d.data() } as KitchenOrder)))
      setInventoryItems(invSnap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)))
      setActualStudentCount(studentsSnap ? studentsSnap.docs.length : 0)
    } catch (err) {
      console.error('[Orders]', err)
      setErrorToast('Could not load inventory. Check connection.')
      setTimeout(() => setErrorToast(''), 4000)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function generateOrderList() {
    // Low-stock quick list has no usage history — clear any smart-order artefacts.
    setUsageStats({})
    setRangeInfo(null)
    setManualReviewItems([])
    setScaleNote(null)
    setAiData(null)
    setAiError('')
    const rows: OrderItem[] = []
    for (const i of inventoryItems) {
      const orderQty = lowStockOrderQty(i)
      if (orderQty == null) continue // above minimum, or no minimum configured
      const unitCost = i.unitCost ?? 0
      rows.push({
        itemId: i.id,
        itemName: i.itemName,
        unit: i.unit,
        category: i.category,
        currentStock: i.currentStock,
        minStockLevel: i.minStockLevel,
        orderQty,
        unitCost,
        totalCost: parseFloat((orderQty * unitCost).toFixed(2)),
      })
    }
    setOrderItems(rows)
    setGenerated(true)
    if (rows.length === 0) showToast('All stock levels are healthy — nothing to order.')
    scrollToList()
  }

  async function generateSmartOrder() {
    setSmartLoading(true)
    setAiData(null)
    setAiError('')
    try {
      // Number of calendar days in the selected range (inclusive), min 1.
      const rangeDays = Math.max(
        1,
        Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1,
      )

      const logsSnap = await getDocs(
        query(collection(db, 'mealLogs'), where('date', '>=', fromDate), where('date', '<=', toDate))
      ).catch(() => getDocs(collection(db, 'mealLogs')))

      const usageMap: Record<string, { itemName: string; unit: string; totalUsed: number; days: Set<string> }> = {}
      let totalServings = 0
      const logDates = new Set<string>()

      for (const logDoc of logsSnap.docs) {
        const log = logDoc.data()
        // The fallback query returns ALL logs — keep only those in the chosen range.
        const logDate = String(log.date ?? '')
        if (logDate < fromDate || logDate > toDate) continue
        logDates.add(logDate)
        totalServings += Number(log.totalServings ?? log.studentCount ?? 0)
        const ings = log.ingredientsUsed as Array<{ itemId: string; itemName: string; unit: string; qtyUsed: number }> ?? []
        for (const ing of ings) {
          if (!usageMap[ing.itemId]) {
            usageMap[ing.itemId] = { itemName: ing.itemName, unit: ing.unit, totalUsed: 0, days: new Set() }
          }
          usageMap[ing.itemId].totalUsed += ing.qtyUsed
          usageMap[ing.itemId].days.add(logDate)
        }
      }

      const target = parseInt(studentTarget) || 130
      // FIX 4 — derive the real average head-count from the logs themselves and scale
      // usage to the target. With no logs at all, don't scale (factor = 1).
      const daysWithLogs = logDates.size
      const avgStudentsFromLogs = daysWithLogs > 0 ? totalServings / daysWithLogs : 0
      const scaleFactor = daysWithLogs > 0 ? target / Math.max(1, avgStudentsFromLogs) : 1

      type Stat = { dailyAvg: number; daysLeft: number | null; daysOfData: number; dataQuality: 'ok' | 'limited' | 'no-history' }
      const stats: Record<string, Stat> = {}
      const mainRows: OrderItem[] = []

      for (const item of inventoryItems) {
        // Already well stocked (over 3× the minimum) — no need to order.
        if (item.currentStock > item.minStockLevel * 3) continue

        const usage = usageMap[item.id]
        const daysOfData = usage ? usage.days.size : 0
        // Real average daily usage across the WHOLE selected range.
        const realDailyAvg = usage ? usage.totalUsed / rangeDays : 0
        const unitCost = item.unitCost ?? 0

        if (realDailyAvg === 0) {
          // No usage history (FIX 1): only reorder when below minimum. Instead of
          // recommending 0, project to 1.5× minimum and badge it "No History".
          if (item.currentStock < item.minStockLevel) {
            const qty = roundOrderQty(
              capOrderQty(Math.max(0.5, item.minStockLevel * 1.5 - item.currentStock), item.unit),
              item.unit,
            )
            stats[item.id] = { dailyAvg: 0, daysLeft: null, daysOfData: 0, dataQuality: 'no-history' }
            mainRows.push({
              itemId: item.id,
              itemName: item.itemName,
              unit: item.unit,
              category: item.category,
              currentStock: item.currentStock,
              minStockLevel: item.minStockLevel,
              orderQty: qty,
              unitCost,
              totalCost: parseFloat((qty * unitCost).toFixed(2)),
            })
          }
          continue
        }

        // Has usage → project 30 days at the scaled daily rate, net of current stock.
        const scaledDailyAvg = realDailyAvg * scaleFactor
        const raw = Math.max(0, (scaledDailyAvg * 30) - item.currentStock)
        if (raw <= 0) continue // enough on hand for the horizon — nothing to order
        const recommended = roundOrderQty(capOrderQty(raw, item.unit), item.unit)
        stats[item.id] = {
          dailyAvg: realDailyAvg,
          daysLeft: realDailyAvg > 0 ? item.currentStock / realDailyAvg : null,
          daysOfData,
          dataQuality: daysOfData < 7 ? 'limited' : 'ok',
        }
        mainRows.push({
          itemId: item.id,
          itemName: item.itemName,
          unit: item.unit,
          category: item.category,
          currentStock: item.currentStock,
          minStockLevel: item.minStockLevel,
          orderQty: recommended,
          unitCost,
          totalCost: parseFloat((recommended * unitCost).toFixed(2)),
        })
      }

      setUsageStats(stats)
      setRangeInfo({ from: fromDate, to: toDate, days: rangeDays })
      setScaleNote(daysWithLogs > 0 ? { target, actual: Math.round(avgStudentsFromLogs) } : null)
      setManualReviewItems([])
      setShowManualReview(true)
      setOrderItems(mainRows)
      setGenerated(true)
      scrollToList()
    } catch (err) {
      console.error('[SmartOrder]', err)
    } finally {
      setSmartLoading(false)
    }
  }

  function updateQty(idx: number, qty: string) {
    setOrderItems((prev) => {
      const next = [...prev]
      const qtyNum = Number(qty) || 0
      next[idx] = { ...next[idx], orderQty: qtyNum, totalCost: qtyNum * next[idx].unitCost }
      return next
    })
  }

  function updateManualQty(idx: number, qty: string) {
    setManualReviewItems((prev) => {
      const next = [...prev]
      const qtyNum = Number(qty) || 0
      next[idx] = { ...next[idx], orderQty: qtyNum, totalCost: qtyNum * next[idx].unitCost }
      return next
    })
  }

  // Grand total only sums items that have a real unit price (FIX 2); unpriced items
  // are surfaced separately so a missing price never silently reads as LKR 0.
  const totalEstimate = orderItems.reduce((s, i) => s + i.totalCost, 0)
  const noPriceCount = orderItems.filter((i) => !(i.unitCost > 0)).length

  const dateRangeLabel = rangeInfo
    ? `${rangeInfo.from} to ${rangeInfo.to} (${rangeInfo.days} days)`
    : undefined

  function handleDownloadPdf() {
    if (orderItems.length === 0 && manualReviewItems.length === 0) return
    void downloadOrderChecklistPdf(orderItems, {
      dateRange: dateRangeLabel,
      manualItems: manualReviewItems,
    })
  }

  // FIX 5B — send the generated order + data window to the kitchen AI budget route.
  async function runAiBudget() {
    if (orderItems.length === 0) {
      showToast('Generate an order list first.')
      return
    }
    setAiLoading(true)
    setAiError('')
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
      if (!token) {
        setAiError('Not authenticated')
        return
      }
      const res = await fetch('/api/kitchen/ai-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          from: fromDate,
          to: toDate,
          studentCount: actualStudentCount || (parseInt(studentTarget, 10) || 0),
          orderItems: orderItems.map((i) => ({
            itemName: i.itemName,
            currentStock: i.currentStock,
            unit: i.unit,
            orderQty: i.orderQty,
            unitCost: i.unitCost,
            totalCost: i.totalCost,
          })),
        }),
      })
      const data = (await res.json()) as KitchenAiBudget & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'AI analysis failed')
      setAiData(data)
      setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      console.error('[KitchenAI]', err)
      setAiError(err instanceof Error ? err.message : 'AI analysis failed')
    } finally {
      setAiLoading(false)
    }
  }

  function handleDownloadBudgetPdf() {
    if (!aiData) return
    void downloadKitchenBudgetPdf(aiData, {
      dateRange: dateRangeLabel,
      studentCount: actualStudentCount,
    })
  }

  async function handleSubmit() {
    if (orderItems.length === 0) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'kitchenOrders'), {
        items: orderItems,
        status: 'submitted',
        totalEstimate,
        submittedBy: user?.uid ?? '',
        submittedByName: user?.displayName ?? '',
        supplier: supplier || null,
        notes: notes || '',
        createdAt: serverTimestamp(),
      })
      setOrderItems([])
      setSupplier('')
      setNotes('')
      setGenerated(false)
      showToast('Order submitted for approval')
      await loadData()
    } catch (err) {
      console.error('[Orders submit]', err)
    } finally {
      setSaving(false)
    }
  }

  // Category-grouped view of the current order list + per-group subtotals (Step 3).
  const grouped = groupOrderItems(orderItems)
  const idxOf = new Map(orderItems.map((it, i) => [it.itemId, i]))
  const groupSubtotals = grouped.map((g) => ({
    key: g.key,
    label: g.label,
    subtotal: g.items.reduce((s, it) => s + (it.unitCost > 0 ? it.totalCost : 0), 0),
  }))
  const studentDivisor = parseInt(studentTarget, 10) || 130
  const costPerStudent = totalEstimate / Math.max(1, studentDivisor)
  // Healthy-stock snapshot for the empty state (top items by current stock).
  const topStocked = [...inventoryItems]
    .sort((a, b) => b.currentStock - a.currentStock)
    .slice(0, 5)

  return (
    <div className="space-y-4 pb-4 md:space-y-6">
      {toast && (
        <div className="fixed bottom-24 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-6">
          {toast}
        </div>
      )}
      {errorToast && (
        <div className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-6">
          <span className="ti ti-alert-triangle" /> {errorToast}
        </div>
      )}

      <div className="space-y-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Order Requests</h1>

        {/* Usage period filter — drives the smart order calculation (FIX 1) */}
        <div className="space-y-3 rounded-xl border border-white/90 bg-white/65 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <p className="text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Usage period</p>

          <div className="flex flex-wrap gap-2">
            {RANGE_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => applyPreset(n)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activeRange === n
                    ? 'bg-[#0B3D6B] text-white'
                    : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
                }`}
              >
                {n} days
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveRange('custom')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeRange === 'custom'
                  ? 'bg-[#0B3D6B] text-white'
                  : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
              }`}
            >
              Custom
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">From Date</label>
              <input
                type="date"
                value={fromDate}
                disabled={activeRange !== 'custom'}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">To Date</label>
              <input
                type="date"
                value={toDate}
                disabled={activeRange !== 'custom'}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none disabled:opacity-60"
              />
            </div>
            {activeRange === 'custom' && (
              <div>
                <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Or enter days</label>
                <input
                  type="number"
                  min="1"
                  value={customDays}
                  onChange={(e) => applyCustomDays(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-28 rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Student Target</label>
              <input
                type="number"
                value={studentTarget}
                onChange={(e) => setStudentTarget(e.target.value)}
                className="w-24 rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none"
                placeholder="130"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={smartLoading}
              onClick={() => void generateSmartOrder()}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-6 text-base font-bold text-white hover:bg-[#d4911c] disabled:opacity-60"
            >
              {smartLoading ? (
                <><span className="ti ti-loader animate-spin" /> Calculating…</>
              ) : (
                <><span className="ti ti-sparkles" /> Generate Order List</>
              )}
            </button>
            <button
              type="button"
              onClick={generateOrderList}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#0B3D6B] px-6 text-base font-bold text-[#0B3D6B] hover:bg-[#0B3D6B]/10 dark:border-white/20 dark:text-white"
            >
              <span className="ti ti-refresh" /> Low-Stock Only
            </button>
            <button
              type="button"
              disabled={aiLoading || !generated || orderItems.length === 0}
              onClick={() => void runAiBudget()}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-[#E8A020] px-6 text-base font-bold text-[#E8A020] hover:bg-[#E8A020]/10 disabled:opacity-50"
            >
              {aiLoading ? (
                <><span className="ti ti-loader animate-spin" /> Analyzing…</>
              ) : (
                <><span className="ti ti-sparkles" /> AI Budget Analysis</>
              )}
            </button>
          </div>
        </div>
      </div>

      {generated && (
        <div ref={listRef} className="rounded-xl border border-white/90 bg-white/65 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#0D1B2A] dark:text-white">Generated Order List</h2>
              {rangeInfo && (
                <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/50">
                  Based on usage from {rangeInfo.from} to {rangeInfo.to} ({rangeInfo.days} days)
                </p>
              )}
              {scaleNote && (
                <p className="text-xs text-[#5A6A7A] dark:text-white/50">
                  Scaled for {scaleNote.target} students (actual: {scaleNote.actual})
                </p>
              )}
            </div>
            {orderItems.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 rounded-xl border border-[#0B3D6B] bg-transparent px-4 py-2 text-sm font-bold text-[#0B3D6B] hover:bg-[#0B3D6B]/10 dark:border-[#E8A020] dark:text-[#E8A020] dark:hover:bg-[#E8A020]/10"
              >
                <span className="ti ti-download" /> Download PDF Checklist
              </button>
            )}
          </div>
          {orderItems.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800/50 dark:bg-emerald-900/15">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <span className="ti ti-circle-check text-xl" />
                <p className="font-bold">All stock levels are healthy. No items need ordering.</p>
              </div>
              {topStocked.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-emerald-200 text-xs font-semibold uppercase text-emerald-700/70 dark:border-emerald-800/50 dark:text-emerald-400/70">
                        <th className="py-1.5 text-left">Item (top stocked)</th>
                        <th className="py-1.5 text-right">Stock</th>
                        <th className="py-1.5 text-right">Min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topStocked.map((i) => (
                        <tr key={i.id} className="border-b border-emerald-100 last:border-0 dark:border-emerald-900/40">
                          <td className="py-1.5 text-[#0D1B2A] dark:text-white">{i.itemName}</td>
                          <td className="py-1.5 text-right text-[#5A6A7A] dark:text-white/60">{formatQty(i.currentStock)} {i.unit}</td>
                          <td className="py-1.5 text-right text-[#5A6A7A] dark:text-white/60">{formatQty(i.minStockLevel)} {i.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-5">
                {grouped.map((g) => {
                  const subtotal = groupSubtotals.find((s) => s.key === g.key)?.subtotal ?? 0
                  return (
                    <div key={g.key} className="overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-white/[0.08]">
                      {/* Category header */}
                      <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-white ${g.headerCls}`}>
                        <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                          <span className="text-lg">{g.emoji}</span>
                          {g.label}
                          <span className="font-medium normal-case opacity-80">
                            ({g.items.length} item{g.items.length === 1 ? '' : 's'})
                          </span>
                        </span>
                        <span className="text-sm font-bold">{formatLKR(subtotal)}</span>
                      </div>
                      {/* Items (horizontal scroll on narrow screens) */}
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                          <thead>
                            <tr className="border-b border-[#DDE3EC] text-xs font-semibold uppercase text-[#5A6A7A] dark:border-white/[0.08] dark:text-white/40">
                              <th className="px-3 py-2 text-left">Item</th>
                              <th className="px-3 py-2 text-right">Stock</th>
                              <th className="px-3 py-2 text-right">Min</th>
                              <th className="px-3 py-2 text-right">Days Data</th>
                              <th className="px-3 py-2 text-right">Order</th>
                              <th className="px-3 py-2 text-right">Unit Cost</th>
                              <th className="px-3 py-2 text-right">Line Total</th>
                              <th className="px-3 py-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.items.map((item) => {
                              const idx = idxOf.get(item.itemId) ?? 0
                              const stat = usageStats[item.itemId]
                              const isCritical = item.currentStock === 0
                              const isLow = item.currentStock < item.minStockLevel
                              const noPrice = !(item.unitCost > 0)
                              return (
                                <tr key={item.itemId} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]">
                                  <td className="px-3 py-2 font-medium text-[#0D1B2A] dark:text-white">
                                    <span className="mr-1">{getFoodEmoji(item.itemName)}</span>
                                    {item.itemName}
                                    {stat?.dataQuality === 'no-history' && (
                                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-white/10 dark:text-white/60">No History</span>
                                    )}
                                    {stat?.dataQuality === 'limited' && (
                                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Limited Data</span>
                                    )}
                                    {stat?.daysLeft != null && (
                                      <span className={`ml-2 text-[10px] font-semibold ${daysLeftColor(stat.daysLeft)}`}>
                                        {stat.daysLeft.toFixed(1)}d left
                                      </span>
                                    )}
                                    {noPrice && (
                                      <span className="mt-0.5 block text-[10px] font-semibold text-amber-600 dark:text-amber-400">⚠ Set unit cost in inventory</span>
                                    )}
                                  </td>
                                  <td className={`px-3 py-2 text-right ${isCritical ? 'font-bold text-red-600 dark:text-red-400' : 'text-[#5A6A7A] dark:text-white/60'}`}>
                                    {formatQty(item.currentStock)} {item.unit}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[#5A6A7A] dark:text-white/60">
                                    {formatQty(item.minStockLevel)} {item.unit}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[#5A6A7A] dark:text-white/50">
                                    {stat ? `${stat.daysOfData}d` : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={item.orderQty}
                                      onChange={(e) => updateQty(idx, e.target.value)}
                                      className="w-20 rounded-lg border border-[#DDE3EC] bg-white px-2 py-1 text-right dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right text-[#5A6A7A] dark:text-white/50">
                                    {noPrice ? '—' : `${formatLKR(item.unitCost)}/${item.unit}`}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium text-[#E8A020]">
                                    {noPrice ? '—' : formatLKR(item.totalCost)}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {isCritical ? (
                                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">CRITICAL</span>
                                    ) : isLow ? (
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">LOW</span>
                                    ) : null}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ORDER SUMMARY (grand total + per-category breakdown) */}
              <div className="mt-5 rounded-xl border border-[#0B3D6B]/20 bg-[#0B3D6B]/5 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0B3D6B] dark:text-[#E8A020]">Order Summary</p>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm text-[#5A6A7A] dark:text-white/60">
                      Total items: <span className="font-bold text-[#0D1B2A] dark:text-white">{orderItems.length}</span>
                    </p>
                    <p className="text-sm text-[#5A6A7A] dark:text-white/60">
                      Cost / student: <span className="font-bold text-[#0D1B2A] dark:text-white">{formatLKR(costPerStudent)}</span>{' '}
                      <span className="text-xs">(÷ {studentDivisor})</span>
                    </p>
                  </div>
                  <p className="text-2xl font-black text-[#E8A020]">{formatLKR(totalEstimate)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {groupSubtotals.map((s) => (
                    <span key={s.key} className="text-xs text-[#5A6A7A] dark:text-white/50">
                      {s.label}: <span className="font-semibold text-[#0D1B2A] dark:text-white/80">{formatLKR(s.subtotal)}</span>
                    </span>
                  ))}
                </div>
                {noPriceCount > 0 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    {noPriceCount} item{noPriceCount === 1 ? '' : 's'} with no unit cost — excluded from totals.
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                    Supplier (optional)
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-[#DDE3EC] bg-white/95 p-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 dark:border-white/[0.06] dark:bg-[#080d18]/95 md:dark:bg-transparent">
                <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setGenerated(false)
                      setOrderItems([])
                    }}
                    className="min-h-[48px] rounded-xl border border-[#DDE3EC] px-4 text-sm font-medium text-[#5A6A7A] md:min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="min-h-[56px] w-full rounded-xl bg-[#0B3D6B] text-base font-bold text-white hover:bg-[#0a3460] disabled:opacity-50 md:min-h-[44px] md:w-auto md:px-6"
                  >
                    {saving ? 'Submitting…' : 'Submit for Approval'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── FIX 1: No-usage items needing manual review (collapsible) ─────────── */}
      {generated && manualReviewItems.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/10">
          <button
            type="button"
            onClick={() => setShowManualReview((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
              <span className="ti ti-alert-triangle" /> Items Needing Manual Review ({manualReviewItems.length} items)
            </span>
            <span className={`ti ${showManualReview ? 'ti-chevron-up' : 'ti-chevron-down'} text-amber-600 dark:text-amber-400`} />
          </button>
          {showManualReview && (
            <div className="px-4 pb-4">
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-400/80">
                These items are below minimum stock but have no recorded usage. Please enter order quantities manually.
              </p>

              <div className="space-y-3 md:hidden">
                {manualReviewItems.map((item, idx) => (
                  <div key={item.itemId} className="rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getFoodEmoji(item.itemName)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#0D1B2A] dark:text-white">{item.itemName}</p>
                        <p className="text-xs text-[#5A6A7A] dark:text-white/50">
                          Stock {formatQty(item.currentStock)} {item.unit} · min {formatQty(item.minStockLevel)} · No usage recorded
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Order qty ({item.unit})</label>
                      <input
                        type="number"
                        min="0"
                        value={item.orderQty || ''}
                        onChange={(e) => updateManualQty(idx, e.target.value)}
                        placeholder="Enter qty"
                        className="w-full rounded-lg border border-[#DDE3EC] bg-white px-2 py-1.5 text-right dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-200 dark:border-amber-800 text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">
                      <th className="pb-2 text-left">Item</th>
                      <th className="pb-2 text-right">Current</th>
                      <th className="pb-2 text-right">Min</th>
                      <th className="pb-2 text-right">Suggested</th>
                      <th className="pb-2 pl-4 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualReviewItems.map((item, idx) => (
                      <tr key={item.itemId} className="border-b border-amber-100 dark:border-amber-900/40">
                        <td className="py-2 font-medium text-[#0D1B2A] dark:text-white">{item.itemName} ({item.unit})</td>
                        <td className="py-2 text-right text-[#5A6A7A] dark:text-white/60">{formatQty(item.currentStock)}</td>
                        <td className="py-2 text-right text-[#5A6A7A] dark:text-white/60">{formatQty(item.minStockLevel)}</td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.orderQty || ''}
                            onChange={(e) => updateManualQty(idx, e.target.value)}
                            placeholder="—"
                            className="w-20 rounded-lg border border-[#DDE3EC] bg-white px-2 py-1 text-right dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2 pl-4 text-xs italic text-amber-600 dark:text-amber-400">No usage recorded</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FIX 5B: AI Budget Analysis result ────────────────────────────────── */}
      {(aiLoading || aiError || aiData) && (
        <div ref={aiRef} className="space-y-4 rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#0D1B2A] dark:text-white">
              <span className="ti ti-sparkles text-[#E8A020]" /> AI Budget Analysis
            </h2>
            {aiData && (
              <button
                type="button"
                onClick={handleDownloadBudgetPdf}
                className="inline-flex items-center gap-2 rounded-xl border border-[#0B3D6B] px-4 py-2 text-sm font-bold text-[#0B3D6B] hover:bg-[#0B3D6B]/10 dark:border-[#E8A020] dark:text-[#E8A020] dark:hover:bg-[#E8A020]/10"
              >
                <span className="ti ti-download" /> Download AI Budget PDF
              </button>
            )}
          </div>

          {aiLoading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-[#5A6A7A] dark:text-white/50">
              <span className="ti ti-loader animate-spin text-[#E8A020]" /> AI is analyzing your kitchen data…
            </p>
          ) : aiError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              AI analysis unavailable: {aiError}
            </div>
          ) : aiData ? (
            <div className="space-y-5">
              {/* PANEL A — Budget summary */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'Total Order Cost', value: formatLKR(aiData.summary?.totalOrderCost ?? 0) },
                  { label: 'Cost / Student', value: formatLKR(aiData.summary?.costPerStudent ?? 0) },
                  { label: 'Cost / Student / Day', value: formatLKR(aiData.summary?.costPerStudentPerDay ?? 0) },
                  { label: 'Days of Stock', value: formatQty(aiData.summary?.daysOfStock ?? 0) },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">{c.label}</p>
                    <p className="mt-1 text-lg font-bold text-[#0B3D6B] dark:text-[#E8A020]">{c.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Budget rating</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${ratingTone(aiData.summary?.budgetRating ?? '').cls}`}>
                  {ratingTone(aiData.summary?.budgetRating ?? '').label}
                </span>
              </div>

              {/* PANEL B — AI optimized list */}
              {(aiData.optimizedList ?? []).length > 0 && (
                <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">AI Optimized Order</h3>
                  <div className="space-y-2">
                    {(aiData.optimizedList ?? []).map((it, i) => (
                      <div key={i} className="flex flex-wrap items-start justify-between gap-2 border-b border-[#DDE3EC] pb-2 last:border-0 dark:border-white/[0.06]">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${priorityTone(it.priority)}`}>{it.priority}</span>
                            <p className="font-semibold text-[#0D1B2A] dark:text-white">{it.itemName}</p>
                          </div>
                          {it.reasoning && <p className="mt-0.5 text-xs italic text-[#5A6A7A] dark:text-white/50">{it.reasoning}</p>}
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-semibold text-[#0D1B2A] dark:text-white">{formatQty(it.recommendedQty)} {it.unit}</p>
                          <p className="text-[#5A6A7A] dark:text-white/50">{formatLKR(it.unitPrice)} · {formatLKR(it.totalCost)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PANEL C — Savings */}
              {(aiData.savings ?? []).length > 0 && (
                <div className="rounded-xl border border-[#E8A020]/40 bg-[#E8A020]/5 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#E8A020]">
                    <span className="ti ti-bulb" /> Savings Suggestions
                  </h3>
                  <div className="space-y-2">
                    {(aiData.savings ?? []).map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#0D1B2A] dark:text-white/80">{s.suggestion}</span>
                        <span className="shrink-0 font-bold text-emerald-600 dark:text-emerald-400">{formatLKR(s.estimatedSaving)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PANEL D — Warnings */}
              {(aiData.warnings ?? []).length > 0 && (
                <div className="space-y-2">
                  {(aiData.warnings ?? []).map((w, i) => (
                    <div key={i} className="rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">{w.type} · {w.item}</p>
                      <p className="mt-0.5 text-sm text-[#0D1B2A] dark:text-white/80">{w.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* PANEL E — Budget breakdown donut */}
              {(() => {
                const b = aiData.budgetBreakdown
                if (!b) return null
                const data = [
                  { name: 'Proteins', value: Number(b.proteins ?? 0) },
                  { name: 'Vegetables', value: Number(b.vegetables ?? 0) },
                  { name: 'Grains', value: Number(b.grains ?? 0) },
                  { name: 'Dairy', value: Number(b.dairy ?? 0) },
                  { name: 'Condiments', value: Number(b.condiments ?? 0) },
                  { name: 'Other', value: Number(b.other ?? 0) },
                ].filter((d) => d.value > 0)
                if (data.length === 0) return null
                return (
                  <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Budget Breakdown by Category</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {data.map((entry) => (
                            <Cell key={entry.name} fill={BUDGET_COLORS[entry.name] ?? '#6b7280'} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatLKR(Number(v) || 0)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {data.map((entry) => (
                        <span key={entry.name} className="flex items-center gap-1.5 text-xs text-[#5A6A7A] dark:text-white/60">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BUDGET_COLORS[entry.name] ?? '#6b7280' }} />
                          {entry.name}: {formatLKR(entry.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* PANEL F — Recommendation */}
              {aiData.recommendation && (
                <div className="rounded-xl bg-[#0B3D6B] p-5 text-white dark:bg-[#0B3D6B]/80">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="ti ti-sparkles text-[#E8A020]" />
                    <h3 className="text-sm font-bold">AI Recommendation</h3>
                  </div>
                  <p className="text-sm italic text-white/80">{aiData.recommendation}</p>
                  <div className="mt-3 flex justify-end">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/70">
                      <span className="ti ti-sparkles text-[#E8A020]" /> Powered by Claude AI
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      <div className="rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <div className="border-b border-[#DDE3EC] px-4 py-4 dark:border-white/[0.06] md:px-5">
          <h2 className="text-base font-bold text-[#0D1B2A] dark:text-white">Order History</h2>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
            ))
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/40">No orders yet</p>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[#0D1B2A] dark:text-white">{formatOrderDate(o.createdAt)}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[o.status]}`}
                  >
                    {o.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{o.items.length} items</p>
                <p className="text-sm font-bold text-[#E8A020]">{formatLKR(o.totalEstimate)}</p>
                <p className="text-xs text-gray-400">{o.submittedByName}</p>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] text-xs font-medium uppercase text-[#5A6A7A] dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total (LKR)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                    No orders yet
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]">
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{formatOrderDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-[#0D1B2A] dark:text-white">{o.items.length} items</td>
                    <td className="px-4 py-3 font-medium text-[#0B3D6B] dark:text-[#E8A020]">
                      {formatLKR(o.totalEstimate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[o.status]}`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{o.submittedByName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
