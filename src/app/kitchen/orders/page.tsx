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
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import CountStepper from '@/components/kitchen/CountStepper'
import { getFoodEmoji } from '@/lib/kitchen/foodImages'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { formatQty } from '@/lib/kitchen-utils'
import { downloadOrderChecklistPdf } from '@/lib/kitchen/orderChecklistPdf'
import type { InventoryItem, KitchenOrder, OrderItem, OrderStatus } from '@/types/kitchen'

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

// Round order quantities to sensible increments the storekeeper can actually buy.
function roundOrderQty(qty: number): number {
  if (qty < 10) return Number(qty.toFixed(1))
  if (qty <= 100) return Math.round(qty)
  return Math.round(qty / 5) * 5
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
  const [generated, setGenerated] = useState(false)
  const [studentTarget, setStudentTarget] = useState('130')
  const [smartLoading, setSmartLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Date-range filter for usage-based (smart) ordering.
  const [fromDate, setFromDate] = useState(daysAgoIso(30))
  const [toDate, setToDate] = useState(todayIso())
  const [activeRange, setActiveRange] = useState<number | 'custom'>(30)
  const [rangeInfo, setRangeInfo] = useState<{ from: string; to: string; days: number } | null>(null)
  // Per-item usage stats keyed by itemId, populated when a smart order is generated.
  const [usageStats, setUsageStats] = useState<Record<string, { dailyAvg: number; daysLeft: number | null }>>({})

  function applyPreset(days: number) {
    setActiveRange(days)
    setFromDate(daysAgoIso(days))
    setToDate(todayIso())
  }

  function scrollToList() {
    // Defer to next tick so the generated list has rendered before we scroll to it.
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function loadData() {
    setLoading(true)
    try {
      const [orderSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, 'kitchenOrders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'inventory'), orderBy('itemName'))).catch(() =>
          getDocs(collection(db, 'inventory'))
        ),
      ])
      setOrders(orderSnap.docs.map((d) => ({ id: d.id, ...d.data() } as KitchenOrder)))
      setInventoryItems(invSnap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)))
    } catch (err) {
      console.error('[Orders]', err)
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
    // Low-stock quick list has no usage history — clear any smart-order stats/range.
    setUsageStats({})
    setRangeInfo(null)
    const lowItems = inventoryItems.filter(
      (i) => i.currentStock <= i.minStockLevel
    )
    if (lowItems.length === 0) {
      showToast('All items are sufficiently stocked!')
      setOrderItems([])
      setGenerated(true)
      scrollToList()
      return
    }
    const rows: OrderItem[] = lowItems.map((i) => {
      // Restock up to 3× the minimum level, then round to a buyable increment.
      const orderQty = roundOrderQty(capOrderQty(Math.max(0, (i.minStockLevel * 3) - i.currentStock), i.unit))
      const unitCost = i.unitCost ?? 0
      return {
        itemId: i.id,
        itemName: i.itemName,
        unit: i.unit,
        currentStock: i.currentStock,
        minStockLevel: i.minStockLevel,
        orderQty,
        unitCost,
        totalCost: parseFloat((orderQty * unitCost).toFixed(2)),
      }
    })
    setOrderItems(rows)
    setGenerated(true)
    scrollToList()
  }

  async function generateSmartOrder() {
    setSmartLoading(true)
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

      for (const logDoc of logsSnap.docs) {
        const log = logDoc.data()
        // The fallback query returns ALL logs — keep only those in the chosen range.
        const logDate = String(log.date ?? '')
        if (logDate < fromDate || logDate > toDate) continue
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
      const stats: Record<string, { dailyAvg: number; daysLeft: number | null }> = {}
      const rows: OrderItem[] = inventoryItems
        .map((item): OrderItem | null => {
          // Already well stocked (over 3× the minimum) — no need to order.
          if (item.currentStock > item.minStockLevel * 3) return null

          const usage = usageMap[item.id]
          // Real average daily usage across the WHOLE selected range (FIX 3).
          const realDailyAvg = usage ? usage.totalUsed / rangeDays : 0
          // For the order projection fall back to a conservative 50g/student/day
          // when there's no usage history, so brand-new items still get ordered.
          const dailyUsageForOrder = realDailyAvg > 0 ? realDailyAvg : target * 0.05
          // Project ~30 days of need, net of what's already in stock, then cap + round.
          const raw = Math.max(0, (dailyUsageForOrder * 30) - item.currentStock)
          const recommended = roundOrderQty(capOrderQty(raw, item.unit))
          const unitCost = item.unitCost ?? 0
          stats[item.id] = {
            dailyAvg: realDailyAvg,
            // Guard against divide-by-zero: no usage → unknown runway.
            daysLeft: realDailyAvg > 0 ? item.currentStock / realDailyAvg : null,
          }
          return {
            itemId: item.id,
            itemName: item.itemName,
            unit: item.unit,
            currentStock: item.currentStock,
            minStockLevel: item.minStockLevel,
            orderQty: recommended,
            unitCost,
            totalCost: parseFloat((recommended * unitCost).toFixed(2)),
          }
        })
        .filter((r): r is OrderItem => r != null && r.orderQty > 0)

      setUsageStats(stats)
      setRangeInfo({ from: fromDate, to: toDate, days: rangeDays })
      setOrderItems(rows)
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

  const totalEstimate = orderItems.reduce((s, i) => s + i.totalCost, 0)

  function handleDownloadPdf() {
    if (orderItems.length === 0) return
    void downloadOrderChecklistPdf(
      orderItems,
      rangeInfo
        ? { dateRange: `${rangeInfo.from} to ${rangeInfo.to} (${rangeInfo.days} days)` }
        : undefined,
    )
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

  const orderItemCards = (items: OrderItem[], editable: boolean) =>
    items.map((item, idx) => {
      const isLow = item.currentStock < item.minStockLevel
      return (
        <div
          key={item.itemId}
          className="rounded-xl border border-white/90 bg-white/65 p-4 dark:border-white/[0.08] dark:bg-white/[0.05]"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">{getFoodEmoji(item.itemName)}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#0D1B2A] dark:text-white">{item.itemName}</p>
              <p className={`text-sm ${isLow ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                Stock: {formatQty(item.currentStock)} {item.unit} (min {formatQty(item.minStockLevel)})
              </p>
              {usageStats[item.itemId] && (
                <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/50">
                  Daily avg {formatQty(usageStats[item.itemId].dailyAvg)} {item.unit} ·{' '}
                  <span className={`font-semibold ${daysLeftColor(usageStats[item.itemId].daysLeft)}`}>
                    {usageStats[item.itemId].daysLeft != null
                      ? `${usageStats[item.itemId].daysLeft!.toFixed(1)} days left`
                      : 'usage n/a'}
                  </span>
                </p>
              )}
            </div>
          </div>
          {editable ? (
            <div className="mt-3">
              <label className="mb-2 block text-sm font-bold text-[#0D1B2A] dark:text-white">
                Order qty ({item.unit})
              </label>
              <CountStepper
                value={String(item.orderQty)}
                onChange={(v) => updateQty(idx, v)}
                step={1}
              />
              <p className="mt-2 text-right text-sm font-bold text-[#E8A020]">
                {formatLKR(item.totalCost)}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              Qty: {item.orderQty} {item.unit} · {formatLKR(item.totalCost)}
            </p>
          )}
        </div>
      )
    })

  return (
    <div className="space-y-4 pb-4 md:space-y-6">
      {toast && (
        <div className="fixed bottom-24 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-6">
          {toast}
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
            <p className="text-sm text-emerald-600">All items are sufficiently stocked!</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">{orderItemCards(orderItems, true)}</div>

              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE3EC] dark:border-white/[0.08] text-xs font-semibold uppercase text-[#5A6A7A] dark:text-white/40">
                      <th className="pb-3 text-left">Item</th>
                      <th className="pb-3 text-right">Current</th>
                      <th className="pb-3 text-right">Min</th>
                      <th className="pb-3 text-right">Daily Avg</th>
                      <th className="pb-3 text-right">Days Left</th>
                      <th className="pb-3 text-right">Order Qty</th>
                      <th className="pb-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, idx) => (
                      <tr key={item.itemId} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                        <td className="py-2 font-medium text-[#0D1B2A] dark:text-white">
                          {item.itemName} ({item.unit})
                        </td>
                        <td className="py-2 text-right text-[#5A6A7A]">{formatQty(item.currentStock)}</td>
                        <td className="py-2 text-right text-[#5A6A7A]">{formatQty(item.minStockLevel)}</td>
                        <td className="py-2 text-right text-[#5A6A7A] dark:text-white/50">
                          {usageStats[item.itemId]
                            ? `${formatQty(usageStats[item.itemId].dailyAvg)} ${item.unit}`
                            : '—'}
                        </td>
                        <td className={`py-2 text-right font-semibold ${daysLeftColor(usageStats[item.itemId]?.daysLeft ?? null)}`}>
                          {usageStats[item.itemId]?.daysLeft != null
                            ? `${usageStats[item.itemId].daysLeft!.toFixed(1)}d`
                            : '—'}
                        </td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.orderQty}
                            onChange={(e) => updateQty(idx, e.target.value)}
                            className="w-20 rounded-lg border border-[#DDE3EC] bg-white px-2 py-1 text-right dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2 text-right font-medium text-[#E8A020]">
                          {formatLKR(item.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-right text-lg font-bold text-[#E8A020]">
                Total: {formatLKR(totalEstimate)}
              </p>

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
