'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  collection,
  addDoc,
  getDocs,
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
import KitchenBottomSheet from '@/components/kitchen/KitchenBottomSheet'
import type {
  WasteEntry,
  WasteType,
  WasteReason,
  KitchenAISuggestion,
} from '@/types/kitchen'

// New reason-based waste log (Leftover / Expired / Overcooked / Dropped / Other).
const REASON_OPTIONS: { id: WasteReason; label: string }[] = [
  { id: 'leftover', label: 'Leftover' },
  { id: 'expired', label: 'Expired' },
  { id: 'overcooked', label: 'Overcooked' },
  { id: 'dropped', label: 'Dropped' },
  { id: 'other', label: 'Other' },
]

const REASON_LABELS: Record<WasteReason, string> = {
  overcooked: 'Overcooked',
  expired: 'Expired',
  leftover: 'Leftover',
  spoiled: 'Spoiled',
  dropped: 'Dropped',
  other: 'Other',
}

const MEAL_OPTIONS = ['breakfast', 'lunch', 'dinner', 'other'] as const

// Legacy first-gen simplified docs stored a `wasteType` instead of `reason`.
const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  food_waste: 'Food Waste',
  spoiled: 'Spoiled Items',
  other: 'Other',
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function fmtKg(n: number): string {
  return `${Number((Number(n) || 0).toFixed(2))} kg`
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

type WasteRow = {
  id: string
  date: string
  typeLabel: string
  weightKg: number
  details: string
  loggedByName: string
}

// Normalise the three doc shapes we may find in `wasteLog` into one display row:
// (1) new reason-based weight docs, (2) old wasteType-based weight docs, and
// (3) legacy item-based docs.
function normalize(id: string, e: WasteEntry): WasteRow {
  // (2) Old wasteType-based docs
  if (e.wasteType) {
    let details = '—'
    if (e.wasteType === 'spoiled') details = e.spoiledItems?.trim() || '—'
    else if (e.wasteType === 'food_waste') details = e.mealType ? cap(e.mealType) : '—'
    else if (e.notes?.trim()) details = e.notes.trim()
    return {
      id,
      date: e.date,
      typeLabel: WASTE_TYPE_LABELS[e.wasteType],
      weightKg: Number(e.weightKg ?? 0),
      details,
      loggedByName: e.loggedByName ?? '',
    }
  }
  // (1) New reason-based weight docs
  if (e.weightKg != null) {
    let details = '—'
    if (e.reason === 'expired') details = e.expiredItems?.trim() || '—'
    else if (e.reason === 'leftover' || e.reason === 'overcooked') details = e.mealType ? cap(e.mealType) : '—'
    else if (e.notes?.trim()) details = e.notes.trim()
    return {
      id,
      date: e.date,
      typeLabel: e.reason ? REASON_LABELS[e.reason] : 'Other',
      weightKg: Number(e.weightKg ?? 0),
      details,
      loggedByName: e.loggedByName ?? '',
    }
  }
  // (3) Legacy item-based docs — derive a weight from the old quantity/unit.
  let weightKg = 0
  if (e.unit === 'kg') weightKg = Number(e.quantity ?? 0)
  else if (e.unit === 'grams') weightKg = Number(e.quantity ?? 0) / 1000
  const details = e.itemName
    ? `${e.itemName}${e.quantity ? ` · ${e.quantity} ${e.unit ?? ''}` : ''}`
    : '—'
  return {
    id,
    date: e.date,
    typeLabel: e.reason ? REASON_LABELS[e.reason] : 'Other',
    weightKg,
    details,
    loggedByName: e.loggedByName ?? '',
  }
}

export default function WastePage() {
  const { user } = useKitchen()
  const [rows, setRows] = useState<WasteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showSlide, setShowSlide] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<KitchenAISuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  // Form
  const [fDate, setFDate] = useState(today())
  const [fReason, setFReason] = useState<WasteReason>('leftover')
  const [fWeight, setFWeight] = useState('')
  const [fExpiredItems, setFExpiredItems] = useState('')
  const [fMealType, setFMealType] = useState<(typeof MEAL_OPTIONS)[number]>('lunch')
  const [fNotes, setFNotes] = useState('')

  const showMealType = fReason === 'leftover' || fReason === 'overcooked'
  const showExpired = fReason === 'expired'

  async function loadData() {
    setLoading(true)
    try {
      // Fetch without a compound orderBy. Ordering by two different fields
      // (date + createdAt) requires a composite index that isn't defined, which
      // made the read throw and the log appear empty. Sort newest-first client-side
      // instead — this also keeps docs that are missing one of the fields.
      const wasteSnap = await getDocs(collection(db, 'wasteLog'))
      const list = wasteSnap.docs.map((d) => normalize(d.id, d.data() as WasteEntry))
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setRows(list)
    } catch (err) {
      console.error('[Waste load]', err)
      setRows([])
      showToast('Failed to load waste log. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function resetForm() {
    setFDate(today())
    setFReason('leftover')
    setFWeight('')
    setFExpiredItems('')
    setFMealType('lunch')
    setFNotes('')
  }

  async function handleSave() {
    const weight = Number(fWeight)
    if (!weight || weight <= 0) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        date: fDate,
        reason: fReason,
        weightKg: parseFloat(weight.toFixed(2)),
        notes: fNotes.trim(),
        loggedBy: user?.uid ?? '',
        loggedByName: user?.displayName ?? '',
        createdAt: serverTimestamp(),
      }
      if (fReason === 'expired') payload.expiredItems = fExpiredItems.trim()
      if (fReason === 'leftover' || fReason === 'overcooked') payload.mealType = fMealType
      await addDoc(collection(db, 'wasteLog'), payload)
      setShowSlide(false)
      resetForm()
      showToast('Waste entry logged')
      await loadData()
    } catch (err) {
      console.error('[Waste save]', err)
      showToast('Failed to log waste. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const fetchAiSuggestions = useCallback(async () => {
    if (rows.length === 0) return
    setAiLoading(true)
    try {
      const last30 = rows.filter((r) => r.date >= daysAgo(30))
      const res = await fetch('/api/kitchen-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wasteData: last30.map((r) => ({
            item: r.details || r.typeLabel,
            qty: r.weightKg,
            unit: 'kg',
            reason: r.typeLabel,
            loss: 0,
            date: r.date,
          })),
          inventoryData: [],
        }),
      })
      const data = await res.json() as { suggestions: KitchenAISuggestion[] }
      setAiSuggestions(data.suggestions ?? [])
    } catch {
      setAiSuggestions([])
    } finally {
      setAiLoading(false)
    }
  }, [rows])

  useEffect(() => {
    if (!loading && rows.length > 0) fetchAiSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // Stats — weight based (kg)
  const weekAgoStr = daysAgo(7)
  const monthStr = thisMonthPrefix()
  const weekKg = rows.filter((r) => r.date >= weekAgoStr).reduce((s, r) => s + r.weightKg, 0)
  const monthKg = rows.filter((r) => r.date.startsWith(monthStr)).reduce((s, r) => s + r.weightKg, 0)
  const monthCount = rows.filter((r) => r.date.startsWith(monthStr)).length

  // Chart data: last 14 days (kg)
  const chartData = Array.from({ length: 14 }, (_, i) => {
    const date = daysAgo(13 - i)
    const val = rows.filter((r) => r.date === date).reduce((s, r) => s + r.weightKg, 0)
    return { date: date.slice(5), value: Number(val.toFixed(2)) }
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Waste Tracker</h1>
          <span className="rounded-full bg-[#0B3D6B]/10 px-3 py-1 text-sm font-bold text-[#0B3D6B] dark:bg-white/[0.06] dark:text-[#E8A020]">
            This month: {fmtKg(monthKg)} waste logged
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowSlide(true)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] text-base font-bold text-white hover:bg-[#d4911c] md:w-auto md:px-6"
        >
          <span className="ti ti-plus" /> Log Waste
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {[
          { label: 'This Week', value: fmtKg(weekKg), color: 'text-red-600' },
          { label: 'This Month', value: fmtKg(monthKg), color: 'text-amber-600' },
          { label: 'Entries (month)', value: String(monthCount), color: 'text-[#0B3D6B] dark:text-[#E8A020]' },
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
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">Daily Waste — Last 14 Days (kg)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [fmtKg(Number(v) || 0), 'Waste']} />
            <Bar dataKey="value" fill="#0B3D6B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mobile history */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
          ))
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/40">
            No waste entries yet
          </p>
        ) : (
          rows.slice(0, 50).map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/90 bg-white/65 p-4 dark:border-white/[0.08] dark:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-[#0D1B2A] dark:text-white">{r.typeLabel}</p>
                <p className="shrink-0 text-sm font-bold text-red-600">{fmtKg(r.weightKg)}</p>
              </div>
              <p className="mt-1 text-sm text-gray-500">{r.details}</p>
              <p className="mt-0.5 text-xs text-gray-400">{r.date} · {r.loggedByName || '—'}</p>
            </div>
          ))
        )}
      </div>

      {/* Desktop history */}
      <div className="hidden overflow-hidden rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] text-xs font-medium uppercase text-[#5A6A7A] dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Weight (kg)</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Logged By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                  No waste entries yet
                </td>
              </tr>
            ) : (
              rows.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]">
                  <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">{r.typeLabel}</td>
                  <td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{Number(r.weightKg.toFixed(2))}</td>
                  <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{r.details}</td>
                  <td className="px-4 py-3 text-xs text-[#5A6A7A] dark:text-white/40">{r.loggedByName || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#DDE3EC] bg-[#F5F7FB] dark:border-white/[0.06] dark:bg-white/[0.03]">
                <td className="px-4 py-3 text-sm font-bold text-[#0D1B2A] dark:text-white" colSpan={2}>
                  Total this month:
                </td>
                <td className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400" colSpan={3}>
                  {fmtKg(monthKg)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
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
        {rows.length === 0 ? (
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
                    {s.potentialSaving}
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
              disabled={saving || !fWeight || Number(fWeight) <= 0}
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
            <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">Reason</label>
            <div className="grid grid-cols-3 gap-2">
              {REASON_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setFReason(r.id)}
                  className={`min-h-[48px] rounded-xl border-2 px-2 py-2 text-center text-sm font-semibold ${
                    fReason === r.id
                      ? 'border-[#E8A020] bg-[#E8A020] text-white'
                      : 'border-[#DDE3EC] bg-white text-[#0D1B2A] dark:border-gray-600 dark:bg-gray-900 dark:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
              Total weight wasted (kg) *
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={fWeight}
              onChange={(e) => setFWeight(e.target.value)}
              placeholder="0.0"
              className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>

          {showExpired && (
            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                What items expired? (optional)
              </label>
              <textarea
                value={fExpiredItems}
                onChange={(e) => setFExpiredItems(e.target.value)}
                rows={2}
                placeholder="e.g. Tomatoes 2kg, Green chilli 0.5kg"
                className="w-full min-h-[56px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
          )}

          {showMealType && (
            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">Meal type</label>
              <select
                value={fMealType}
                onChange={(e) => setFMealType(e.target.value as (typeof MEAL_OPTIONS)[number])}
                className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                {MEAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{cap(m)}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold text-[#0D1B2A] dark:text-white">Notes (optional)</label>
            <textarea
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              rows={2}
              className="w-full min-h-[56px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
      </KitchenBottomSheet>
    </div>
  )
}
