'use client'

import { useMemo } from 'react'
import IngredientPicker from '@/components/kitchen/IngredientPicker'
import { getFoodEmoji } from '@/lib/kitchen/foodImages'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { InventoryItem, StockUnit } from '@/types/kitchen'

export interface IngredientRow {
  itemId: string
  qty: string
}

interface MealIngredientListProps {
  inventory: InventoryItem[]
  rows: IngredientRow[]
  onChange: (rows: IngredientRow[]) => void
  totalServings: number
  stickyCost?: boolean
}

export default function MealIngredientList({
  inventory,
  rows,
  onChange,
  totalServings,
  stickyCost = false,
}: MealIngredientListProps) {
  const estimatedCost = useMemo(() => {
    return rows.reduce((sum, row) => {
      const item = inventory.find((i) => i.id === row.itemId)
      if (!item) return sum
      const qty = parseFloat(row.qty) || 0
      return sum + qty * item.unitCost
    }, 0)
  }, [rows, inventory])

  const costPerPerson = totalServings > 0 ? estimatedCost / totalServings : 0

  const updateRow = (index: number, patch: Partial<IngredientRow>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(next)
  }

  const addRow = () => onChange([...rows, { itemId: '', qty: '' }])

  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index))

  const adjustQty = (index: number, delta: number) => {
    const row = rows[index]
    const current = parseFloat(row.qty) || 0
    const next = Math.max(0, current + delta)
    updateRow(index, { qty: next > 0 ? String(next) : '' })
  }

  const costBlock = estimatedCost > 0 && (
    <div
      className={`rounded-xl bg-[#E8A020]/10 p-4 text-center ${
        stickyCost ? 'sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]' : ''
      }`}
    >
      <p className="text-lg font-bold text-[#E8A020] md:text-xl">
        Estimated meal cost: {formatLKR(estimatedCost)}
      </p>
      {totalServings > 0 && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Cost per person: {formatLKR(costPerPerson)}
        </p>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <label className="block text-base font-bold text-[#0D1B2A] dark:text-white">
        What ingredients were used?
      </label>

      {rows.map((row, index) => {
        const item = inventory.find((i) => i.id === row.itemId)
        const qty = parseFloat(row.qty) || 0
        const overStock = item && qty > item.currentStock

        return (
          <div
            key={index}
            className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-gray-600 dark:bg-gray-900/50"
          >
            <IngredientPicker
              items={inventory}
              value={row.itemId}
              onChange={(id) => updateRow(index, { itemId: id })}
            />

            {item && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getFoodEmoji(item.itemName)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0B3D6B] dark:text-white">
                    {item.itemName}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    aria-label="Remove ingredient"
                  >
                    🗑️
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustQty(index, -0.5)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-lg font-bold dark:border-gray-600 dark:bg-white/[0.06]"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={row.qty}
                    onChange={(e) => updateRow(index, { qty: e.target.value })}
                    className="h-11 min-h-[44px] flex-1 rounded-xl border border-[#DDE3EC] bg-white text-center text-base font-semibold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <span className="w-10 shrink-0 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                    {item.unit}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustQty(index, 0.5)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-lg font-bold dark:border-gray-600 dark:bg-white/[0.06]"
                  >
                    +
                  </button>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Available: {item.currentStock} {item.unit}
                </p>
                {overStock && (
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Only {item.currentStock} {item.unit} available
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={addRow}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E8A020]/50 py-3 text-sm font-semibold text-[#E8A020] hover:bg-[#E8A020]/5"
      >
        <span className="text-xl">+</span> Add another ingredient
      </button>

      {!stickyCost && costBlock}
      {stickyCost && costBlock}
    </div>
  )
}

export function rowsToIngredients(
  rows: IngredientRow[],
  inventory: InventoryItem[],
): {
  itemId: string
  itemName: string
  qtyUsed: number
  unit: StockUnit
  unitCost: number
  totalCost: number
}[] {
  return rows
    .filter((r) => r.itemId && parseFloat(r.qty) > 0)
    .map((r) => {
      const item = inventory.find((i) => i.id === r.itemId)!
      const qtyUsed = parseFloat(r.qty)
      return {
        itemId: r.itemId,
        itemName: item.itemName,
        qtyUsed,
        unit: item.unit,
        unitCost: item.unitCost,
        totalCost: qtyUsed * item.unitCost,
      }
    })
}
