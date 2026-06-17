'use client'

import { MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import { estimateCost, stockWarnings } from '@/lib/kitchen/mealLogHelpers'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { InventoryItem, MealType, SelectedIngredient } from '@/types/kitchen'

interface MealConfirmSummaryProps {
  date: string
  mealType: MealType
  studentCount: number
  staffCount: number
  selected: SelectedIngredient[]
  inventory: InventoryItem[]
  menuName?: string
  menuSinhalaName?: string
  duplicateMealToday?: boolean
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MealConfirmSummary({
  date,
  mealType,
  studentCount,
  staffCount,
  selected,
  inventory,
  menuName,
  menuSinhalaName,
  duplicateMealToday,
}: MealConfirmSummaryProps) {
  const visual = MEAL_SESSION_VISUAL[mealType]
  const totalCost = estimateCost(selected)
  const totalServings = studentCount + staffCount
  const costPerStudent = studentCount > 0 ? totalCost / studentCount : 0
  const warnings = stockWarnings(selected, inventory)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-[#0D1B2A] dark:text-white">Confirm Meal Log</h3>

      <div className="flex items-center gap-3">
        <span className="text-3xl">{visual?.emoji}</span>
        <div>
          <p className="font-bold capitalize text-[#0D1B2A] dark:text-white">
            {mealType} — {formatDisplayDate(date)}
          </p>
          {menuName && (
            <span className="mt-1 inline-block rounded-full bg-[#0B3D6B]/10 px-2 py-0.5 text-xs font-semibold text-[#0B3D6B]">
              📋 {menuName}
              {menuSinhalaName ? ` / ${menuSinhalaName}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-gray-600">
        <table className="w-full text-sm">
          <tbody>
            {selected.map((row) => (
              <tr key={row.itemId} className="border-b border-[#DDE3EC] dark:border-gray-700">
                <td className="px-3 py-2">
                  <span className="mr-1">{row.emoji}</span>
                  {row.itemName}
                  {row.sinhalaName && (
                    <span className="text-[#E8A020]"> / {row.sinhalaName}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {row.qty} {row.unit}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatLKR(row.qty * row.unitCost)}
                </td>
              </tr>
            ))}
            <tr className="bg-[#F5F7FB] font-bold dark:bg-white/5">
              <td className="px-3 py-3" colSpan={2}>
                Total cost
              </td>
              <td className="px-3 py-3 text-right text-[#E8A020]">{formatLKR(totalCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Students: {studentCount} | Staff: {staffCount} | Total: {totalServings}
      </p>
      <p className="text-sm font-semibold text-[#0B3D6B] dark:text-white">
        Cost per student: {formatLKR(costPerStudent)}
      </p>

      {warnings.map((w) => (
        <p key={w.itemName} className="text-sm font-medium text-amber-600">
          ⚠️ {w.itemName}: need {w.needed} {w.unit}, only {w.available} {w.unit} in stock
        </p>
      ))}

      {duplicateMealToday && (
        <p className="text-sm font-medium text-amber-600">
          ⚠️ A {mealType} meal was already logged for this date
        </p>
      )}
    </div>
  )
}
