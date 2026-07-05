'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  deleteDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import CountStepper from '@/components/kitchen/CountStepper'
import KitchenBottomSheet from '@/components/kitchen/KitchenBottomSheet'
import IngredientGrid from '@/components/kitchen/IngredientGrid'
import MealTemplateSelector from '@/components/kitchen/MealTemplateSelector'
import DailyMenuLoader from '@/components/kitchen/DailyMenuLoader'
import MealLogConfirmStep from '@/components/kitchen/MealLogConfirmStep'
import { fetchActiveInventory } from '@/lib/kitchen/fetchActiveInventory'
import { getFoodEmoji, MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import {
  menuIngredientsToSelected,
  selectedToIngredientsUsed,
} from '@/lib/kitchen/ingredientSelection'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { DailyMenu, MealLog, MealType, InventoryItem, SelectedIngredient } from '@/types/kitchen'

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'morning-tea', label: 'Morning Tea' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'evening-tea', label: 'Evening Tea' },
  { value: 'tea', label: 'Tea' },
]

type WizardStep = 1 | 2 | 3

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizeMealDate(date: unknown): string {
  if (!date) return ''
  if (typeof date === 'string') return date.slice(0, 10)
  if (typeof date === 'object' && date !== null && 'toDate' in date) {
    const toDate = (date as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') {
      return toDate.call(date).toISOString().slice(0, 10)
    }
  }
  if (typeof date === 'object' && date !== null && 'seconds' in date) {
    return new Date((date as { seconds: number }).seconds * 1000).toISOString().slice(0, 10)
  }
  return String(date).slice(0, 10)
}

function parseMealLog(id: string, data: Record<string, unknown>): MealLog {
  return {
    id,
    date: normalizeMealDate(data.date),
    mealType: data.mealType as MealType,
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

function StepIndicator({ step }: { step: WizardStep }) {
  const steps = [
    { n: 1 as const, label: 'Meal Details' },
    { n: 2 as const, label: 'Ingredients' },
    { n: 3 as const, label: 'Confirm' },
  ]
  return (
    <div className="mb-4 flex items-center justify-between border-b border-[#DDE3EC] pb-3 dark:border-gray-700">
      {steps.map((s, i) => (
        <div key={s.n} className="flex flex-1 items-center">
          <div className="flex flex-col items-center">
            <span
              className={`text-xs font-bold ${
                step === s.n
                  ? 'text-[#E8A020] underline decoration-2 underline-offset-4'
                  : step > s.n
                    ? 'text-[#E8A020]'
                    : 'text-gray-400'
              }`}
            >
              {step > s.n ? '✓' : s.n} {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="mx-1 flex-1 text-center text-gray-300">→</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function MealLogPage() {
  const { user } = useKitchen()
  const [logs, setLogs] = useState<MealLog[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(today())
  const [typeFilter, setTypeFilter] = useState<MealType | 'all'>('all')
  const [showSlide, setShowSlide] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null)
  const [deletingLog, setDeletingLog] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [toastKind, setToastKind] = useState<'success' | 'warning'>('success')
  const [editingLogId, setEditingLogId] = useState<string | null>(null)

  const [step, setStep] = useState<WizardStep>(1)
  const [fDate, setFDate] = useState(today())
  const [fType, setFType] = useState<MealType | ''>('')
  const [fStudents, setFStudents] = useState('')
  const [fStaff, setFStaff] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [selected, setSelected] = useState<SelectedIngredient[]>([])
  const [appliedMenu, setAppliedMenu] = useState<DailyMenu | null>(null)
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null)
  const [menuTodayCount, setMenuTodayCount] = useState(0)
  const [templateRefresh, setTemplateRefresh] = useState(0)

  async function loadLogs() {
    setLoading(true)
    try {
      let snap
      try {
        snap = await getDocs(
          query(collection(db, 'mealLogs'), orderBy('createdAt', 'desc'), limit(50)),
        )
      } catch (err) {
        console.warn('[MealLog] indexed query failed, falling back', err)
        const allSnap = await getDocs(collection(db, 'mealLogs'))
        const docs = allSnap.docs
          .map((d) => ({ doc: d, createdAt: d.data().createdAt }))
          .sort((a, b) => {
            const aSec =
              a.createdAt && typeof a.createdAt === 'object' && 'seconds' in a.createdAt
                ? (a.createdAt as { seconds: number }).seconds
                : 0
            const bSec =
              b.createdAt && typeof b.createdAt === 'object' && 'seconds' in b.createdAt
                ? (b.createdAt as { seconds: number }).seconds
                : 0
            return bSec - aSec
          })
          .slice(0, 50)
          .map((x) => x.doc)
        snap = { docs } as typeof allSnap
      }

      setLogs(
        snap.docs.map((d) => parseMealLog(d.id, d.data() as Record<string, unknown>)),
      )
    } catch (err) {
      console.error('[MealLog]', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteLog(id: string) {
    setDeletingLog(true)
    try {
      await deleteDoc(doc(db, 'mealLogs', id))
      setLogs((prev) => prev.filter((l) => l.id !== id))
      setDeleteLogId(null)
      setExpandedId(null)
      showToast('Meal log deleted')
    } catch (err) {
      console.error('[MealLog delete]', err)
      showToast('Failed to delete log', 'warning')
    } finally {
      setDeletingLog(false)
    }
  }

  async function loadInventory() {
    try {
      const items = await fetchActiveInventory()
      setInventoryItems(items)
    } catch (err) {
      console.error('[MealLog inventory]', err)
    }
  }

  useEffect(() => {
    loadLogs()
    loadInventory()
  }, [])

  const totalServings = (Number(fStudents) || 0) + (Number(fStaff) || 0)
  const studentCount = Number(fStudents) || 0

  const duplicateToday = useMemo(() => {
    if (!fType || !fDate) return false
    return logs.some((l) => l.date === fDate && l.mealType === fType)
  }, [logs, fDate, fType])

  const hasValidIngredients = selected.some((s) => s.qty > 0)

  function showToast(msg: string, kind: 'success' | 'warning' = 'success') {
    setToastKind(kind)
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  function resetWizard() {
    setStep(1)
    setFDate(today())
    setFType('')
    setFStudents('')
    setFStaff('')
    setFNotes('')
    setSelected([])
    setAppliedMenu(null)
    setAppliedTemplateId(null)
    setMenuTodayCount(0)
    setEditingLogId(null)
  }

  function openLogSlide() {
    resetWizard()
    void loadInventory()
    setShowSlide(true)
  }

  function openEditLog(log: MealLog) {
    setFDate(log.date)
    setFType(log.mealType)
    setFStudents(String(log.studentCount))
    setFStaff(String(log.staffCount))
    setFNotes(log.notes ?? '')
    setSelected(
      log.ingredientsUsed.map((ing) => ({
        itemId: ing.itemId,
        itemName: ing.itemName,
        emoji: getFoodEmoji(ing.itemName),
        qty: ing.qtyUsed,
        unit: ing.unit,
        unitCost: ing.unitCost,
      })),
    )
    setEditingLogId(log.id)
    setStep(2)
    setShowSlide(true)
  }

  function handleSelectMenu(menu: DailyMenu) {
    const count = studentCount || menu.baseStudentCount
    setAppliedMenu(menu)
    setAppliedTemplateId(null)
    setMenuTodayCount(count)
    if (!fStudents) setFStudents(String(count))
    setSelected(
      menuIngredientsToSelected(menu.ingredients, menu.baseStudentCount, count, inventoryItems),
    )
  }

  function handleClearMenu() {
    setAppliedMenu(null)
    setMenuTodayCount(0)
    setSelected([])
  }

  function handleMenuTodayCountChange(count: number) {
    setMenuTodayCount(count)
    setFStudents(String(count))
    if (appliedMenu) {
      setSelected(
        menuIngredientsToSelected(
          appliedMenu.ingredients,
          appliedMenu.baseStudentCount,
          count,
          inventoryItems,
        ),
      )
    }
  }

  function handleApplyTemplate(ingredients: SelectedIngredient[], templateId: string | null) {
    setAppliedTemplateId(templateId)
    if (templateId) {
      setAppliedMenu(null)
      setSelected(ingredients)
    } else {
      setSelected([])
    }
  }

  const filtered = logs.filter((l) => {
    const matchDate = !dateFilter || l.date === dateFilter
    const matchType = typeFilter === 'all' || l.mealType === typeFilter
    return matchDate && matchType
  })

  async function handleConfirmSave() {
    if (!fType || (!fStudents && !fStaff)) return
    setSaving(true)
    try {
      const usedIngredients = selectedToIngredientsUsed(selected)
      const totalCost = usedIngredients.reduce((s, i) => s + i.totalCost, 0)
      const costPerPerson = totalServings > 0 ? totalCost / totalServings : 0

      const logPayload = {
        date: fDate,
        mealType: fType,
        studentCount: Number(fStudents) || 0,
        staffCount: Number(fStaff) || 0,
        totalServings,
        ingredientsUsed: usedIngredients,
        estimatedCost: totalCost,
        costPerPerson,
        notes: fNotes,
        menuId: appliedMenu?.id ?? null,
        menuName: appliedMenu?.menuName ?? null,
        templateId: appliedTemplateId,
        loggedBy: user?.uid ?? '',
        loggedByName: user?.displayName ?? '',
      }

      if (editingLogId) {
        await updateDoc(doc(db, 'mealLogs', editingLogId), {
          ...logPayload,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'mealLogs'), {
          ...logPayload,
          createdAt: serverTimestamp(),
        })
      }

      if (appliedTemplateId) {
        try {
          await updateDoc(doc(db, 'mealTemplates', appliedTemplateId), {
            usageCount: increment(1),
          })
        } catch {
          /* non-fatal */
        }
      }

      let inventoryErrors = 0
      const updatedItems: Array<{
        itemName: string
        emoji: string
        currentStock: number
        minStockLevel: number
        unit: string
      }> = []

      for (const ing of usedIngredients) {
        const item = inventoryItems.find((i) => i.id === ing.itemId)
        if (!item) continue
        try {
          const newStock = Math.max(0, item.currentStock - ing.qtyUsed)
          updatedItems.push({
            itemName: item.itemName,
            emoji: getFoodEmoji(item.itemName),
            currentStock: newStock,
            minStockLevel: item.minStockLevel,
            unit: item.unit,
          })
          await updateDoc(doc(db, 'inventory', ing.itemId), {
            currentStock: newStock,
            lastUpdated: serverTimestamp(),
            updatedBy: user?.uid ?? '',
            updatedByName: user?.displayName ?? '',
          })
          await addDoc(collection(db, 'inventory', ing.itemId, 'history'), {
            action: 'deducted',
            qty: ing.qtyUsed,
            itemId: ing.itemId,
            itemName: item.itemName,
            emoji: getFoodEmoji(item.itemName),
            unit: item.unit,
            reason: 'meal-log',
            mealType: fType,
            date: fDate,
            by: user?.uid ?? '',
            byName: user?.displayName ?? '',
            createdAt: serverTimestamp(),
          })
        } catch (err) {
          inventoryErrors += 1
          console.error('[MealLog inventory deduct]', ing.itemId, err)
        }
      }

      const lowItems = updatedItems.filter((i) => i.currentStock <= i.minStockLevel)
      if (lowItems.length > 0) {
        fetch('/api/kitchen/low-stock-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lowStockItems: lowItems }),
        }).catch(() => {})
      }

      setShowSlide(false)
      resetWizard()
      if (inventoryErrors > 0) {
        showToast(
          `Meal logged, but ${inventoryErrors} inventory update(s) failed — check stock manually`,
          'warning',
        )
      } else if (lowItems.length > 0) {
        showToast('Meal logged successfully. ⚠️ Low stock alert sent to admin', 'warning')
      } else {
        showToast('Meal logged successfully')
      }
      await loadLogs()
      await loadInventory()
    } catch (err) {
      console.error('[MealLog save]', err)
    } finally {
      setSaving(false)
    }
  }

  const slideFooter =
    step === 1 ? (
      <button
        type="button"
        onClick={() => setStep(2)}
        disabled={!fType}
        className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] disabled:opacity-50"
      >
        Next →
      </button>
    ) : step === 2 ? (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[#DDE3EC] text-sm font-semibold"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          disabled={!hasValidIngredients}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] disabled:opacity-50"
        >
          Review →
        </button>
      </div>
    ) : null

  return (
    <div className="space-y-4 md:space-y-6">
      {toast && (
        <div
          className={`fixed bottom-24 right-4 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-6 ${
            toastKind === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'
          }`}
        >
          {toast}
        </div>
      )}

      <div className="space-y-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Meal Log</h1>
        <button
          type="button"
          onClick={openLogSlide}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] text-base font-bold text-white hover:bg-[#d4911c] md:w-auto md:px-6"
        >
          <span className="ti ti-plus" /> Log New Meal
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="min-h-[48px] w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:w-auto"
        />
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:overflow-visible">
          {(['all', ...MEAL_TYPES.map((m) => m.value)] as (MealType | 'all')[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`min-h-[44px] shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                typeFilter === t
                  ? 'bg-[#0B3D6B] text-white'
                  : 'border border-[#DDE3EC] bg-white text-[#5A6A7A] dark:border-gray-600 dark:bg-gray-900 dark:text-white/60'
              }`}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/90 bg-white/65 py-16 text-center dark:border-white/[0.08] dark:bg-white/[0.05]">
          <span className="text-4xl">🍽️</span>
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/40">No meal logs for this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => {
            const visual = MEAL_SESSION_VISUAL[log.mealType]
            const expanded = expandedId === log.id
            return (
              <div
                key={log.id}
                className="rounded-xl border border-white/90 bg-white/65 dark:border-white/[0.08] dark:bg-white/[0.05]"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span className="text-3xl">{visual?.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold capitalize text-[#0D1B2A] dark:text-white">
                      {log.mealType}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{log.date}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">
                      {log.studentCount + log.staffCount} served
                    </p>
                    <p className="text-sm font-bold text-[#E8A020]">
                      {formatLKR(log.estimatedCost)}
                    </p>
                  </div>
                  <span className={`ti ti-chevron-${expanded ? 'up' : 'down'} text-gray-400`} />
                </button>
                {expanded && (
                  <div className="border-t border-[#DDE3EC] px-4 py-3 text-sm dark:border-white/[0.06]">
                    <p className="text-gray-600 dark:text-gray-400">
                      {log.studentCount} students · {log.staffCount} staff
                    </p>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      {formatLKR(log.costPerPerson)} per person
                    </p>
                    {log.ingredientsUsed?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {log.ingredientsUsed.map((ing, i) => (
                          <li key={i} className="text-gray-600 dark:text-gray-400">
                            {ing.itemName}: {ing.qtyUsed} {ing.unit}
                          </li>
                        ))}
                      </ul>
                    )}
                    {log.notes && (
                      <p className="mt-2 text-gray-500 dark:text-gray-500">Notes: {log.notes}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">By {log.loggedByName}</p>
                    <div className="mt-3 flex items-center gap-2">
                      {deleteLogId === log.id ? (
                        <div className="flex w-full flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                            ⚠️ Delete this meal log? This cannot be undone.
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleDeleteLog(log.id)}
                              disabled={deletingLog}
                              className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingLog ? 'Deleting…' : 'Confirm Delete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteLogId(null)}
                              className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 dark:border-gray-600 dark:text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditLog(log)
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5A6A7A] hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06] hover:text-[#0B3D6B] transition-colors"
                          >
                            <span className="ti ti-edit text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteLogId(log.id)
                            }}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                          >
                            🗑️ Delete Log
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <KitchenBottomSheet
        open={showSlide}
        onClose={() => {
          setShowSlide(false)
          setEditingLogId(null)
        }}
        title={editingLogId ? 'Edit Meal Log' : 'Log Meal'}
        footer={slideFooter}
      >
        <StepIndicator step={step} />

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Meal Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MEAL_TYPES.map((m) => {
                  const visual = MEAL_SESSION_VISUAL[m.value]
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setFType(m.value)}
                      className={`flex min-h-[88px] flex-col items-center justify-center rounded-xl border-2 py-2 ${
                        fType === m.value
                          ? 'border-[#E8A020] bg-[#E8A020]/15'
                          : 'border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-900'
                      }`}
                    >
                      <span className="text-[32px] leading-none">{visual?.emoji}</span>
                      <span className="mt-1 text-sm font-semibold">{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Date
              </label>
              <input
                type="date"
                value={fDate}
                onChange={(e) => setFDate(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                  Students
                </label>
                <CountStepper value={fStudents} onChange={setFStudents} step={1} />
              </div>
              <div>
                <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                  Staff
                </label>
                <CountStepper value={fStaff} onChange={setFStaff} step={1} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Notes (optional)
              </label>
              <textarea
                value={fNotes}
                onChange={(e) => setFNotes(e.target.value)}
                rows={3}
                className="w-full min-h-[80px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {step === 2 && fType && (
          <div className="space-y-5">
            <DailyMenuLoader
              mealType={fType}
              studentCount={studentCount}
              inventory={inventoryItems}
              appliedMenu={appliedMenu}
              onSelectMenu={handleSelectMenu}
              onClearMenu={handleClearMenu}
              onTodayCountChange={handleMenuTodayCountChange}
              todayCount={menuTodayCount || studentCount}
            />

            <MealTemplateSelector
              mealType={fType}
              inventory={inventoryItems}
              selected={selected}
              onApply={handleApplyTemplate}
              appliedTemplateId={appliedTemplateId}
              userId={user?.uid ?? ''}
              onSaved={() => {
                setTemplateRefresh((n) => n + 1)
                showToast('Template saved! ✅')
              }}
              key={`${fType}-${templateRefresh}`}
            />

            <IngredientGrid
              inventoryItems={inventoryItems}
              selected={selected}
              onChange={setSelected}
              totalServings={totalServings}
            />
          </div>
        )}

        {step === 3 && fType && (
          <MealLogConfirmStep
            mealType={fType}
            date={fDate}
            studentCount={studentCount}
            staffCount={Number(fStaff) || 0}
            selected={selected}
            inventory={inventoryItems}
            appliedMenu={appliedMenu}
            duplicateToday={duplicateToday}
            onEdit={() => setStep(2)}
            onConfirm={() => void handleConfirmSave()}
            saving={saving}
          />
        )}
      </KitchenBottomSheet>
    </div>
  )
}
