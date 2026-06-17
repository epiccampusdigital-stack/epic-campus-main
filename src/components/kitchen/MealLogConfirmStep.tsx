'use client'

import { formatLKR } from '@/lib/utils/formatCurrency'
import { MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import type { DailyMenu, InventoryItem, MealType, SelectedIngredient } from '@/types/kitchen'

interface MealLogConfirmStepProps {
  mealType: MealType
  date: string
  studentCount: number
  staffCount: number
  selected: SelectedIngredient[]
  inventory: InventoryItem[]
  appliedMenu: DailyMenu | null
  duplicateToday: boolean
  onEdit: () => void
  onConfirm: () => void
  saving: boolean
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MealLogConfirmStep({
  mealType,
  date,
  studentCount,
  staffCount,
  selected,
  inventory,
  appliedMenu,
  duplicateToday,
  onEdit,
  onConfirm,
  saving,
}: MealLogConfirmStepProps) {
  const visual = MEAL_SESSION_VISUAL[mealType]
  const totalServings = studentCount + staffCount
  const totalCost = selected.reduce((s, i) => s + i.qty * i.unitCost, 0)
  const costPerStudent = studentCount > 0 ? totalCost / studentCount : 0

  const stockWarnings = selected.filter((row) => {
    const item = inventory.find((i) => i.id === row.itemId)
    return item && row.qty > item.currentStock
  })

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-[#0D1B2A] dark:text-white">Confirm Meal Log</h2>

      <div className="flex items-center gap-3">
        <span className="text-4xl">{visual?.emoji}</span>
        <div>
          <p className="font-bold capitalize text-[#0D1B2A] dark:text-white">{mealType}</p>
          <p className="text-sm text-gray-500">{formatDisplayDate(date)}</p>
        </div>
      </div>

      {appliedMenu && (
        <span className="inline-block rounded-full bg-[#0B3D6B]/10 px-3 py-1 text-sm font-medium text-[#0B3D6B] dark:text-[#E8A020]">
          📋 {appliedMenu.menuName}
          {appliedMenu.sinhalaName ? ` / ${appliedMenu.sinhalaName}` : ''}
        </span>
      )}

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-gray-600">
        <table className="w-full text-sm">
          <tbody>
            {selected
              .filter((s) => s.qty > 0)
              .map((row) => (
                <tr
                  key={row.itemId}
                  className="border-b border-[#DDE3EC] last:border-0 dark:border-gray-700"
                >
                  <td className="px-3 py-2">
                    <span className="mr-2">{row.emoji}</span>
                    {row.itemName}
                    {row.sinhalaName && (
                      <span className="ml-1 text-xs text-[#E8A020]">/ {row.sinhalaName}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {row.qty} {row.unit}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatLKR(row.qty * row.unitCost)}
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#F5F7FB] dark:bg-gray-900/50">
              <td colSpan={2} className="px-3 py-3 font-bold text-[#0D1B2A] dark:text-white">
                Total cost:
              </td>
              <td className="px-3 py-3 text-right text-lg font-bold text-[#E8A020]">
                {formatLKR(totalCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Students: {studentCount} | Staff: {staffCount} | Total: {totalServings}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Cost per student: {formatLKR(costPerStudent)}
      </p>

      {stockWarnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          ⚠️ {stockWarnings.length} ingredient(s) exceed available stock
        </div>
      )}

      {duplicateToday && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          ⚠️ A {mealType} meal may already be logged for this date
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[#DDE3EC] text-sm font-semibold text-[#5A6A7A]"
        >
          ← Edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving || selected.filter((s) => s.qty > 0).length === 0}
          className="flex min-h-[52px] flex-[2] items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Confirm & Save'}
        </button>
      </div>
    </div>
  )
}
