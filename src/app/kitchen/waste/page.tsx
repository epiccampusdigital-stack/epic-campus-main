'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import CountStepper from '@/components/kitchen/CountStepper'
import IngredientPicker from '@/components/kitchen/IngredientPicker'
import KitchenBottomSheet from '@/components/kitchen/KitchenBottomSheet'
import { fetchActiveInventory } from '@/lib/kitchen/fetchActiveInventory'
import { getFoodEmoji, WASTE_REASON_VISUAL } from '@/lib/kitchen/foodImages'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type {
  WasteEntry,
  WasteReason,
  InventoryItem,
  MealLog,
  KitchenAISuggestion,
} from '@/types/kitchen'

const WASTE_REASONS: WasteReason[] = [
  'overcooked', 'expired', 'leftover', 'spoiled', 'dropped', 'other',
]

const REASON_LABELS: Record<WasteReason, string> = {
  overcooked: 'Overcooked',
  expired: 'Expired',
  leftover: 'Leftover',
  spoiled: 'Spoiled',
  dropped: 'Dropped',
  other: 'Other',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function thisMonthPrefix(): string {
  return new Date().toISOString().slice(0, 7)
}

function lastMonthPrefix(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}

export default function WastePage() {
  const { user } = useKitchen()
  const [entries, setEntries] = useState<WasteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showSlide, setShowSlide] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [todayLogs, setTodayLogs] = useState<MealLog[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<KitchenAISuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  // Form
  const [fDate, setFDate] = useState(today())
  const [fItemId, setFItemId] = useState('')
  const [fQty, setFQty] = useState('')
  const [fReason, setFReason] = useState<WasteReason>('leftover')
  const [fMealLogId, setFMealLogId] = useState('')
  const [fNotes, setFNotes] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const [wasteSnap, invItems, mealSnap] = await Promise.all([
        getDocs(query(collection(db, 'wasteLog'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'))),
        fetchActiveInventory(),
        getDocs(query(collection(db, 'mealLogs'), where('date', '==', today()))),
      ])
      setEntries(wasteSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WasteEntry)))
      setInventoryItems(invItems)
      setTodayLogs(mealSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MealLog)))
    } catch (err) {
      console.error('[Waste]', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const selectedItem = inventoryItems.find((i) => i.id === fItemId)
  const estimatedLoss = Number(fQty) * (selectedItem?.unitCost ?? 0)

  async function handleSave() {
    if (!fItemId || !fQty) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'wasteLog'), {
        date: fDate,
        itemId: fItemId,
        itemName: selectedItem?.itemName ?? '',
        quantity: Number(fQty),
        unit: selectedItem?.unit ?? '',
        reason: fReason,
        estimatedLoss,
        mealLogId: fMealLogId || null,
        notes: fNotes,
        loggedBy: user?.uid ?? '',
        loggedByName: user?.displayName ?? '',
        createdAt: serverTimestamp(),
      })
      setShowSlide(false)
      setFDate(today()); setFItemId(''); setFQty(''); setFReason('leftover'); setFMealLogId(''); setFNotes('')
      showToast('Waste entry logged')
      await loadData()
    } catch (err) {
      console.error('[Waste save]', err)
    } finally {
      setSaving(false)
    }
  }

  const fetchAiSuggestions = useCallback(async () => {
    if (entries.length === 0) return
    setAiLoading(true)
    try {
      const last30 = entries.filter((e) => e.date >= daysAgo(30))
      const res = await fetch('/api/kitchen-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wasteData: last30.map((e) => ({
            item: e.itemName,
            qty: e.quantity,
            unit: e.unit,
            reason: e.reason,
            loss: e.estimatedLoss,
            date: e.date,
          })),
          inventoryData: inventoryItems.map((i) => ({
            item: i.itemName,
            category: i.category,
            currentStock: i.currentStock,
            minLevel: i.minStockLevel,
          })),
        }),
      })
      const data = await res.json() as { suggestions: KitchenAISuggestion[] }
      setAiSuggestions(data.suggestions ?? [])
    } catch {
      setAiSuggestions([])
    } finally {
      setAiLoading(false)
    }
  }, [entries, inventoryItems])

  useEffect(() => {
    if (!loading && entries.length > 0) fetchAiSuggestions()
  }, [loading])

  // Stats
  const weekAgoStr = daysAgo(7)
  const weekWaste = entries.filter((e) => e.date >= weekAgoStr).reduce((s, e) => s + e.estimatedLoss, 0)
  const monthStr = thisMonthPrefix()
  const monthWaste = entries.filter((e) => e.date.startsWith(monthStr)).reduce((s, e) => s + e.estimatedLoss, 0)

  // Most wasted
  const itemWaste: Record<string, { name: string; loss: number }> = {}
  entries.filter((e) => e.date.startsWith(monthStr)).forEach((e) => {
    if (!itemWaste[e.itemId]) itemWaste[e.itemId] = { name: e.itemName, loss: 0 }
    itemWaste[e.itemId].loss += e.estimatedLoss
  })
  const mostWasted = Object.values(itemWaste).sort((a, b) => b.loss - a.loss)[0]

  // Chart data: last 14 days
  const chartData = Array.from({ length: 14 }, (_, i) => {
    const date = daysAgo(13 - i)
    const val = entries.filter((e) => e.date === date).reduce((s, e) => s + e.estimatedLoss, 0)
    return { date: date.slice(5), value: val }
  })

  const PRIORITY_STYLES: Record<'high' | 'medium' | 'low', string> = {
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-24 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-6">
          {toast}
        </div>
      )}

      <div className="space-y-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Waste Tracker</h1>
        <button
          type="button"
          onClick={() => setShowSlide(true)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] text-base font-bold text-white hover:bg-[#d4911c] md:w-auto md:px-6"
        >
          <span className="ti ti-plus" /> Log Waste
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
        {[
          { label: 'Week', value: formatLKR(weekWaste), color: 'text-red-600' },
          { label: 'Month', value: formatLKR(monthWaste), color: 'text-amber-600' },
          {
            label: 'Top Item',
            value: mostWasted ? mostWasted.name : 'None',
            sub: mostWasted ? formatLKR(mostWasted.loss) : '',
            color: 'text-[#0B3D6B] dark:text-[#E8A020]',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[12px] border border-white/90 bg-white/65 p-3 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05] md:p-4"
          >
            <p className="text-[10px] font-semibold uppercase text-gray-400 dark:text-white/40 md:text-xs">
              {s.label}
            </p>
            <p className={`mt-1 truncate text-sm font-bold md:mt-2 md:text-base ${s.color}`}>
              {s.value}
            </p>
            {'sub' in s && s.sub && (
              <p className="text-xs font-medium text-red-600">{s.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">Daily Waste Value — Last 14 Days (LKR)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [formatLKR(Number(v) || 0), 'Waste']} />
            <Bar dataKey="value" fill="#0B3D6B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
          ))
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/40">
            No waste entries yet
          </p>
        ) : (
          entries.slice(0, 50).map((e) => {
            const reasonVisual = WASTE_REASON_VISUAL.find((r) => r.id === e.reason)
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-white/90 bg-white/65 p-4 dark:border-white/[0.08] dark:bg-white/[0.05]"
              >
                <span className="text-3xl">{getFoodEmoji(e.itemName)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#0D1B2A] dark:text-white">{e.itemName}</p>
                  <p className="text-sm text-gray-500">
                    {e.quantity} {e.unit} · {e.date}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium dark:bg-white/10">
                    {reasonVisual?.emoji} {REASON_LABELS[e.reason]}
                  </span>
                  <p className="mt-1 text-sm font-bold text-red-600">{formatLKR(e.estimatedLoss)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] md:block">
        <div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] text-xs font-medium uppercase text-[#5A6A7A] dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">LKR Loss</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" /></td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                    No waste entries yet
                  </td>
                </tr>
              ) : (
                entries.slice(0, 50).map((e) => (
                  <tr key={e.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]">
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{e.date}</td>
                    <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">{e.itemName}</td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{e.quantity} {e.unit}</td>
                    <td className="px-4 py-3 capitalize text-[#5A6A7A] dark:text-white/60">{REASON_LABELS[e.reason]}</td>
                    <td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{formatLKR(e.estimatedLoss)}</td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{e.notes || '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#5A6A7A] dark:text-white/40">{e.loggedByName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="ti ti-robot text-[#0B3D6B] dark:text-[#E8A020]" />
            <h2 className="text-sm font-bold text-[#0D1B2A] dark:text-white">AI Reduction Suggestions</h2>
          </div>
          <button
            type="button"
            onClick={fetchAiSuggestions}
            disabled={aiLoading}
            className="rounded-lg bg-[#0B3D6B]/10 px-3 py-1.5 text-xs font-medium text-[#0B3D6B] hover:bg-[#0B3D6B]/20 disabled:opacity-50 dark:bg-white/[0.06] dark:text-white/70"
          >
            {aiLoading ? 'Loading…' : 'Refresh Suggestions'}
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-[#5A6A7A] dark:text-white/40">Log waste entries to get AI-powered reduction suggestions</p>
        ) : aiLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
            ))}
          </div>
        ) : aiSuggestions.length === 0 ? (
          <p className="text-sm text-[#5A6A7A] dark:text-white/40">No suggestions available. Click &quot;Refresh Suggestions&quot;.</p>
        ) : (
          <div className="space-y-3">
            {aiSuggestions.map((s, i) => (
              <div key={i} className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.07] dark:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-[#0D1B2A] dark:text-white">{s.suggestion}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLES[s.priority]}`}>
                    {s.priority}
                  </span>
                </div>
                {s.potentialSaving && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    💡 {s.potentialSaving}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <KitchenBottomSheet
        open={showSlide}
        onClose={() => setShowSlide(false)}
        title="Log Waste"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowSlide(false)}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[#DDE3EC] text-sm font-medium text-[#5A6A7A]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !fItemId || !fQty}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Log Waste'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">Date</label>
            <input
              type="date"
              value={fDate}
              onChange={(e) => setFDate(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">Item *</label>
            <IngredientPicker
              inventoryItems={inventoryItems}
              selectedItemId={fItemId}
              onSelect={(item) => setFItemId(item.id)}
              placeholder="Search item…"
            />
          </div>
          {selectedItem && (
            <div className="flex items-center gap-2 rounded-xl bg-[#F5F7FB] p-3 dark:bg-white/[0.04]">
              <span className="text-3xl">{getFoodEmoji(selectedItem.itemName)}</span>
              <div>
                <p className="font-semibold text-[#0B3D6B] dark:text-white">{selectedItem.itemName}</p>
                <p className="text-sm text-gray-500">
                  Available: {selectedItem.currentStock} {selectedItem.unit}
                </p>
              </div>
            </div>
          )}
          <div>
            <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
              Quantity * {selectedItem && `(${selectedItem.unit})`}
            </label>
            <CountStepper value={fQty} onChange={setFQty} step={0.5} />
            {estimatedLoss > 0 && (
              <p className="mt-2 text-center text-lg font-bold text-[#E8A020]">
                Estimated Loss: {formatLKR(estimatedLoss)}
              </p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">Reason</label>
            <div className="grid grid-cols-3 gap-2">
              {WASTE_REASON_VISUAL.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setFReason(r.id)}
                  className={`flex min-h-[52px] min-w-[90px] flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-center text-xs font-semibold ${
                    fReason === r.id
                      ? 'border-[#E8A020] bg-[#E8A020] text-white'
                      : 'border-[#DDE3EC] bg-white text-[#0D1B2A] dark:border-gray-600 dark:bg-gray-900 dark:text-white'
                  }`}
                >
                  <span className="text-2xl leading-none">{r.emoji}</span>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {todayLogs.length > 0 && (
            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Link to Meal (optional)
              </label>
              <select
                value={fMealLogId}
                onChange={(e) => setFMealLogId(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="">None</option>
                {todayLogs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.mealType} — {l.totalServings} servings
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">Notes</label>
            <textarea
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              rows={3}
              className="w-full min-h-[80px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
      </KitchenBottomSheet>
    </div>
  )
}
