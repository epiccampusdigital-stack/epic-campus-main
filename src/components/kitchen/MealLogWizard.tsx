'use client'

import { useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import CountStepper from '@/components/kitchen/CountStepper'
import DailyMenuLoader from '@/components/kitchen/DailyMenuLoader'
import IngredientGrid from '@/components/kitchen/IngredientGrid'
import KitchenBottomSheet from '@/components/kitchen/KitchenBottomSheet'
import MealConfirmSummary from '@/components/kitchen/MealConfirmSummary'
import MealTemplateSelector from '@/components/kitchen/MealTemplateSelector'
import { getFoodEmoji, MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import { selectedToIngredients } from '@/lib/kitchen/mealLogHelpers'
import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'
import type { DailyMenu, InventoryItem, MealLog, MealType, SelectedIngredient } from '@/types/kitchen'

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'tea', label: 'Tea' },
]

interface MealLogWizardProps {
  open: boolean
  onClose: () => void
  inventory: InventoryItem[]
  existingLogs: MealLog[]
  userId: string
  userName: string
  onSaved: () => void
  onToast: (msg: string, kind?: 'success' | 'warning') => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function MealLogWizard({
  open,
  onClose,
  inventory,
  existingLogs,
  userId,
  userName,
  onSaved,
  onToast,
}: MealLogWizardProps) {
  const { sinhala } = useKitchenSinhala()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)

  const [fDate, setFDate] = useState(today())
  const [fType, setFType] = useState<MealType>('lunch')
  const [fStudents, setFStudents] = useState('30')
  const [fStaff, setFStaff] = useState('5')
  const [fNotes, setFNotes] = useState('')
  const [selected, setSelected] = useState<SelectedIngredient[]>([])

  const [appliedMenu, setAppliedMenu] = useState<DailyMenu | null>(null)
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null)
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null)

  const studentCount = Number(fStudents) || 0
  const staffCount = Number(fStaff) || 0
  const totalServings = studentCount + staffCount

  const duplicateMealToday = useMemo(
    () => existingLogs.some((l) => l.date === fDate && l.mealType === fType),
    [existingLogs, fDate, fType],
  )

  const hasValidIngredients = selected.some((s) => s.qty > 0)

  function reset() {
    setStep(1)
    setFDate(today())
    setFType('lunch')
    setFStudents('30')
    setFStaff('5')
    setFNotes('')
    setSelected([])
    setAppliedMenu(null)
    setAppliedTemplateId(null)
    setAppliedTemplateName(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleConfirmSave() {
    if (!hasValidIngredients || totalServings <= 0) return
    setSaving(true)
    try {
      const usedIngredients = selectedToIngredients(selected)
      const totalCost = usedIngredients.reduce((s, i) => s + i.totalCost, 0)
      const costPerPerson = totalServings > 0 ? totalCost / totalServings : 0

      await addDoc(collection(db, 'mealLogs'), {
        date: fDate,
        mealType: fType,
        studentCount,
        staffCount,
        totalServings,
        ingredientsUsed: usedIngredients,
        estimatedCost: totalCost,
        costPerPerson,
        notes: fNotes,
        loggedBy: userId,
        loggedByName: userName,
        createdAt: serverTimestamp(),
        ...(appliedMenu
          ? {
              dailyMenuId: appliedMenu.id,
              dailyMenuName: appliedMenu.menuName,
              dailyMenuSinhalaName: appliedMenu.sinhalaName,
            }
          : {}),
        ...(appliedTemplateId
          ? {
              mealTemplateId: appliedTemplateId,
              mealTemplateName: appliedTemplateName,
            }
          : {}),
      })

      const updatedItems: Array<{
        itemName: string
        emoji: string
        currentStock: number
        minStockLevel: number
        unit: string
      }> = []

      for (const ing of usedIngredients) {
        const item = inventory.find((i) => i.id === ing.itemId)
        if (!item) continue
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
          updatedBy: userId,
          updatedByName: userName,
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
          by: userId,
          byName: userName,
          createdAt: serverTimestamp(),
        })
      }

      if (appliedTemplateId) {
        await updateDoc(doc(db, 'mealTemplates', appliedTemplateId), {
          usageCount: increment(1),
        })
      }

      if (appliedMenu?.id) {
        await updateDoc(doc(db, 'dailyMenus', appliedMenu.id), {
          usageCount: increment(1),
        }).catch(() => {})
      }

      const lowItems = updatedItems.filter((i) => i.currentStock <= i.minStockLevel)
      if (lowItems.length > 0) {
        fetch('/api/kitchen/low-stock-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lowStockItems: lowItems }),
        }).catch(() => {})
      }

      handleClose()
      if (lowItems.length > 0) {
        onToast('Meal logged successfully. ⚠️ Low stock alert sent to admin', 'warning')
      } else {
        onToast('Meal logged successfully')
      }
      onSaved()
    } catch (err) {
      console.error('[MealLogWizard save]', err)
      onToast('Failed to save meal log', 'warning')
    } finally {
      setSaving(false)
    }
  }

  const stepFooter =
    step === 1 ? (
      <button
        type="button"
        disabled={!fType}
        onClick={() => setStep(2)}
        className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] disabled:opacity-50"
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
          disabled={!hasValidIngredients}
          onClick={() => setStep(3)}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] disabled:opacity-50"
        >
          Review →
        </button>
      </div>
    ) : (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[#DDE3EC] text-sm font-semibold"
        >
          ← Edit
        </button>
        <button
          type="button"
          disabled={saving || !hasValidIngredients}
          onClick={() => void handleConfirmSave()}
          className="flex min-h-[48px] flex-[1.2] items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Confirm & Save'}
        </button>
      </div>
    )

  return (
    <KitchenBottomSheet
      open={open}
      onClose={handleClose}
      title="Log Meal"
      footer={stepFooter}
    >
      <div className="mb-6 flex gap-2 border-b border-[#DDE3EC] pb-3 dark:border-gray-600">
        {[
          { n: 1, label: 'Meal Details' },
          { n: 2, label: 'Ingredients' },
          { n: 3, label: 'Confirm' },
        ].map(({ n, label }) => {
          const done = step > n
          const active = step === n
          return (
            <div key={n} className="flex-1 text-center">
              <p
                className={`text-xs font-semibold ${
                  active ? 'text-[#E8A020] underline decoration-2 underline-offset-4' : done ? 'text-[#E8A020]' : 'text-gray-400'
                }`}
              >
                {done ? '✓ ' : ''}
                {n} {label}
              </p>
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-base font-bold">Meal Type</label>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((m) => {
                const visual = MEAL_SESSION_VISUAL[m.value]
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setFType(m.value)}
                    className={`flex min-h-[80px] flex-col items-center justify-center rounded-xl border-2 py-2 ${
                      fType === m.value
                        ? 'border-[#E8A020] bg-[#E8A020]/15'
                        : 'border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-900'
                    }`}
                  >
                    <span className="text-[32px]">{visual?.emoji}</span>
                    <span className="mt-1 text-sm font-semibold">{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-base font-bold">Date</label>
            <input
              type="date"
              value={fDate}
              onChange={(e) => setFDate(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#DDE3EC] px-3 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-base font-bold">Students</label>
              <CountStepper value={fStudents} onChange={setFStudents} />
            </div>
            <div>
              <label className="mb-2 block text-base font-bold">Staff</label>
              <CountStepper value={fStaff} onChange={setFStaff} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-base font-bold">Notes (optional)</label>
            <textarea
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[#DDE3EC] px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <DailyMenuLoader
            mealType={fType}
            inventory={inventory}
            defaultStudentCount={studentCount}
            selected={selected}
            onChange={setSelected}
            appliedMenu={appliedMenu}
            onMenuApplied={(menu) => {
              setAppliedMenu(menu)
              if (menu) {
                setAppliedTemplateId(null)
                setAppliedTemplateName(null)
              }
            }}
          />

          <MealTemplateSelector
            mealType={fType}
            inventory={inventory}
            selected={selected}
            onChange={setSelected}
            userId={userId}
            appliedTemplateId={appliedTemplateId}
            onTemplateApplied={(id, name) => {
              setAppliedTemplateId(id)
              setAppliedTemplateName(name ?? null)
              if (id) setAppliedMenu(null)
            }}
            onToast={(msg) => onToast(msg)}
          />

          <IngredientGrid
            inventoryItems={inventory}
            selected={selected}
            onChange={setSelected}
            sinhala={sinhala}
            baseStudentCount={appliedMenu?.baseStudentCount}
            labelQuantitiesFor={appliedMenu ? studentCount : undefined}
            totalServings={totalServings}
          />
        </div>
      )}

      {step === 3 && (
        <MealConfirmSummary
          date={fDate}
          mealType={fType}
          studentCount={studentCount}
          staffCount={staffCount}
          selected={selected.filter((s) => s.qty > 0)}
          inventory={inventory}
          menuName={appliedMenu?.menuName}
          menuSinhalaName={appliedMenu?.sinhalaName}
          duplicateMealToday={duplicateMealToday}
        />
      )}
    </KitchenBottomSheet>
  )
}
