'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import MealIngredientList, {
  rowsToIngredients,
  type IngredientRow,
} from '@/components/kitchen/MealIngredientList'
import { MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { MealLog, MealType, InventoryItem } from '@/types/kitchen'

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'tea', label: 'Tea' },
]

const MEAL_TYPE_COLORS: Record<MealType, string> = {
  breakfast: 'bg-amber-50 text-amber-700 border-amber-200',
  lunch: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dinner: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  tea: 'bg-orange-50 text-orange-700 border-orange-200',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function MealLogPage() {
  const { user } = useKitchen()
  const [logs, setLogs] = useState<MealLog[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(today())
  const [typeFilter, setTypeFilter] = useState<MealType | 'all'>('all')
  const [showSlide, setShowSlide] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Form state
  const [fDate, setFDate] = useState(today())
  const [fType, setFType] = useState<MealType>('lunch')
  const [fStudents, setFStudents] = useState('')
  const [fStaff, setFStaff] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ itemId: '', qty: '' }])

  async function loadLogs() {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'mealLogs'), orderBy('date', 'desc'), orderBy('createdAt', 'desc')))
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MealLog)))
    } catch (err) {
      console.error('[MealLog]', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadInventory() {
    try {
      const snap = await getDocs(query(collection(db, 'inventory'), where('isActive', '==', true), orderBy('itemName')))
      setInventoryItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)))
    } catch {}
  }

  useEffect(() => { loadLogs(); loadInventory() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const filtered = logs.filter((l) => {
    const matchDate = !dateFilter || l.date === dateFilter
    const matchType = typeFilter === 'all' || l.mealType === typeFilter
    return matchDate && matchType
  })

  const totalServings = (Number(fStudents) || 0) + (Number(fStaff) || 0)

  async function handleSave() {
    if (!fStudents && !fStaff) return
    setSaving(true)
    try {
      const usedIngredients = rowsToIngredients(ingredients, inventoryItems)
      const totalCost = usedIngredients.reduce((s, i) => s + i.totalCost, 0)
      const costPerPerson = totalServings > 0 ? totalCost / totalServings : 0

      await addDoc(collection(db, 'mealLogs'), {
        date: fDate,
        mealType: fType,
        studentCount: Number(fStudents) || 0,
        staffCount: Number(fStaff) || 0,
        totalServings,
        ingredientsUsed: usedIngredients,
        estimatedCost: totalCost,
        costPerPerson,
        notes: fNotes,
        loggedBy: user?.uid ?? '',
        loggedByName: user?.displayName ?? '',
        createdAt: serverTimestamp(),
      })

      // Deduct from inventory
      for (const ing of usedIngredients) {
        const item = inventoryItems.find((i) => i.id === ing.itemId)
        if (!item) continue
        const newStock = Math.max(0, item.currentStock - ing.qtyUsed)
        await updateDoc(doc(db, 'inventory', ing.itemId), {
          currentStock: newStock,
          lastUpdated: serverTimestamp(),
          updatedBy: user?.uid ?? '',
          updatedByName: user?.displayName ?? '',
        })
        await addDoc(collection(db, 'inventory', ing.itemId, 'history'), {
          action: 'deducted',
          qty: ing.qtyUsed,
          reason: 'meal-log',
          date: fDate,
          by: user?.uid ?? '',
          byName: user?.displayName ?? '',
          createdAt: serverTimestamp(),
        })
      }

      setShowSlide(false)
      setFDate(today()); setFType('lunch'); setFStudents(''); setFStaff(''); setFNotes('')
      setIngredients([{ itemId: '', qty: '' }])
      showToast('Meal logged successfully')
      await loadLogs()
    } catch (err) {
      console.error('[MealLog save]', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Meal Log</h1>
        <button
          type="button"
          onClick={() => setShowSlide(true)}
          className="flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d4911c]"
        >
          <span className="ti ti-plus" /> Log New Meal
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <div className="flex rounded-lg border border-[#DDE3EC] bg-white overflow-hidden dark:border-gray-600 dark:bg-gray-900">
          {(['all', ...MEAL_TYPES.map((m) => m.value)] as (MealType | 'all')[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-[#0B3D6B] text-white'
                  : 'text-[#5A6A7A] hover:bg-[#F5F7FB] dark:text-white/60 dark:hover:bg-white/[0.05]'
              }`}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Log cards */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/90 bg-white/65 py-16 text-center dark:border-white/[0.08] dark:bg-white/[0.05]">
          <span className="ti ti-soup text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/40">No meal logs for this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/90 bg-white/65 px-5 py-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]"
            >
              <div className="flex items-center gap-3">
                <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${MEAL_TYPE_COLORS[log.mealType]}`}>
                  {log.mealType}
                </span>
                <p className="text-sm font-medium text-[#0D1B2A] dark:text-white">{log.date}</p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-[#5A6A7A] dark:text-white/60">
                <span>{log.studentCount} students + {log.staffCount} staff</span>
                <span className="font-medium text-[#0B3D6B] dark:text-[#E8A020]">
                  {formatLKR(log.estimatedCost)}
                </span>
                <span>{formatLKR(log.costPerPerson)}/person</span>
                <span className="text-xs">{log.loggedByName}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Meal Slide-over */}
      {showSlide && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowSlide(false)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white/90 backdrop-blur-2xl dark:bg-[#0d1a2e]/90 sm:w-[500px]">
            <div className="flex items-center justify-between border-b border-white/80 bg-white/70 px-5 py-4 dark:border-white/[0.06] dark:bg-white/[0.04]">
              <h3 className="font-semibold text-[#0D1B2A] dark:text-white">Log Meal</h3>
              <button type="button" onClick={() => setShowSlide(false)} className="ti ti-x text-xl text-gray-500" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Date</label>
                  <input
                    type="date"
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-[#5A6A7A]">Meal Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {MEAL_TYPES.map((m) => {
                      const visual = MEAL_SESSION_VISUAL[m.value]
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setFType(m.value)}
                          className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl border-2 py-2 ${
                            fType === m.value
                              ? 'border-[#E8A020] bg-[#E8A020]/10'
                              : 'border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-900'
                          }`}
                        >
                          <span className="text-2xl">{visual?.emoji}</span>
                          <span className="text-xs font-semibold">{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Student Count</label>
                  <input
                    type="number"
                    min="0"
                    value={fStudents}
                    onChange={(e) => setFStudents(e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Staff Count</label>
                  <input
                    type="number"
                    min="0"
                    value={fStaff}
                    onChange={(e) => setFStaff(e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <MealIngredientList
                inventory={inventoryItems}
                rows={ingredients}
                onChange={setIngredients}
                totalServings={totalServings}
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Notes</label>
                <textarea
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t border-white/80 p-5 dark:border-white/[0.06]">
              <button type="button" onClick={() => setShowSlide(false)} className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-sm font-medium text-[#5A6A7A]">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || (!fStudents && !fStaff)}
                className="flex-1 rounded-lg bg-[#E8A020] py-2 text-sm font-semibold text-white hover:bg-[#d4911c] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Log Meal'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
