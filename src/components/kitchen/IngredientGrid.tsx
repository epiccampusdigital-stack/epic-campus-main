'use client'

import { useMemo, useState } from 'react'
import { findFoodItem } from '@/lib/kitchen/foodImages'
import { estimateCost } from '@/lib/kitchen/mealLogHelpers'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { InventoryItem, SelectedIngredient } from '@/types/kitchen'

interface IngredientGridProps {
  inventoryItems: InventoryItem[]
  selected: SelectedIngredient[]
  onChange: (selected: SelectedIngredient[]) => void
  sinhala?: boolean
  baseStudentCount?: number
  labelQuantitiesFor?: number
  totalServings?: number
}

export default function IngredientGrid({
  inventoryItems,
  selected,
  onChange,
  sinhala = false,
  baseStudentCount,
  labelQuantitiesFor,
  totalServings,
}: IngredientGridProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return inventoryItems
    return inventoryItems.filter((item) => {
      const food = findFoodItem(item.itemName)
      return (
        item.itemName.toLowerCase().includes(q) ||
        (food?.sinhalaName?.includes(q) ?? false)
      )
    })
  }, [inventoryItems, search])

  const totalCost = estimateCost(selected)
  const qtyLabel =
    labelQuantitiesFor != null && baseStudentCount != null
      ? `Quantities below are for ${labelQuantitiesFor} students (base: ${baseStudentCount})`
      : null

  function toggleItem(item: InventoryItem) {
    if (item.currentStock <= 0) return
    const exists = selected.find((s) => s.itemId === item.id)
    if (exists) {
      onChange(selected.filter((s) => s.itemId !== item.id))
      return
    }
    const food = findFoodItem(item.itemName)
    onChange([
      ...selected,
      {
        itemId: item.id,
        itemName: item.itemName,
        sinhalaName: food?.sinhalaName,
        emoji: food?.emoji ?? '📦',
        qty: 1,
        unit: item.unit,
        unitCost: item.unitCost,
      },
    ])
  }

  function updateQty(itemId: string, qty: number) {
    onChange(
      selected.map((s) =>
        s.itemId === itemId ? { ...s, qty: Math.max(0, Math.round(qty * 10) / 10) } : s,
      ),
    )
  }

  function adjustQty(itemId: string, delta: number) {
    const row = selected.find((s) => s.itemId === itemId)
    if (!row) return
    updateQty(itemId, row.qty + delta)
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search ingredients…"
        className="h-12 w-full rounded-xl border border-[#DDE3EC] bg-white px-4 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />

      {qtyLabel && (
        <p className="text-xs font-medium text-[#5A6A7A]">{qtyLabel}</p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {filtered.map((item) => {
          const isSelected = selected.some((s) => s.itemId === item.id)
          const outOfStock = item.currentStock <= 0
          const lowStock = !outOfStock && item.currentStock <= item.minStockLevel
          const food = findFoodItem(item.itemName)

          return (
            <button
              key={item.id}
              type="button"
              disabled={outOfStock}
              onClick={() => toggleItem(item)}
              className={`relative flex min-h-[100px] flex-col items-center justify-center rounded-xl p-2 text-center transition-all ${
                outOfStock
                  ? 'cursor-not-allowed border border-gray-200 bg-gray-50 opacity-40 dark:border-gray-700 dark:bg-gray-900'
                  : isSelected
                    ? 'border-2 border-[#E8A020] bg-[#E8A020]/10'
                    : lowStock
                      ? 'border-2 border-amber-400 bg-white dark:bg-white/5'
                      : 'border border-gray-200 bg-white dark:border-gray-600 dark:bg-white/5'
              }`}
            >
              {isSelected && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#E8A020] text-xs font-bold text-white">
                  ✓
                </span>
              )}
              {outOfStock && (
                <span className="absolute left-1.5 top-1.5 rounded bg-red-500 px-1 text-[9px] font-bold text-white">
                  Out
                </span>
              )}
              <span className="text-[48px] leading-none">{food?.emoji ?? '📦'}</span>
              <span className="mt-1 line-clamp-2 text-sm font-bold text-[#0D1B2A] dark:text-white">
                {item.itemName}
              </span>
              {(sinhala || food?.sinhalaName) && food?.sinhalaName && (
                <span className="text-xs text-[#E8A020]">{food.sinhalaName}</span>
              )}
              <span
                className={`mt-0.5 text-[10px] font-medium ${
                  lowStock ? 'text-amber-600' : 'text-gray-500'
                }`}
              >
                {item.currentStock} {item.unit}
                {lowStock ? ' ⚠' : ' ✓'}
              </span>
            </button>
          )
        })}
      </div>

      {selected.length > 0 && (
        <div className="space-y-2 border-t border-[#DDE3EC] pt-4 dark:border-gray-600">
          <p className="text-sm font-bold text-[#0D1B2A] dark:text-white">Selected quantities</p>
          {selected.map((row) => {
            const item = inventoryItems.find((i) => i.id === row.itemId)
            const overStock = item && row.qty > item.currentStock
            const lineCost = row.qty * row.unitCost
            return (
              <div
                key={row.itemId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[#DDE3EC] bg-white p-3 dark:border-gray-600 dark:bg-gray-900/50"
              >
                <span className="text-2xl">{row.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">
                    {row.itemName}
                  </p>
                  {row.sinhalaName && (
                    <p className="text-xs text-[#E8A020]">{row.sinhalaName}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustQty(row.itemId, -0.5)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-lg font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={row.qty}
                    onChange={(e) => updateQty(row.itemId, parseFloat(e.target.value) || 0)}
                    className="h-11 w-16 rounded-xl border border-[#DDE3EC] text-center text-sm font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <span className="w-8 text-center text-xs text-gray-500">{row.unit}</span>
                  <button
                    type="button"
                    onClick={() => adjustQty(row.itemId, 0.5)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-lg font-bold"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-semibold text-[#0B3D6B]">{formatLKR(lineCost)}</span>
                {overStock && (
                  <p className="w-full text-xs font-medium text-amber-600">
                    Only {item!.currentStock} {row.unit} available
                  </p>
                )}
              </div>
            )
          })}

          <div className="rounded-xl bg-[#E8A020]/10 p-4 text-center">
            <p className="text-lg font-bold text-[#E8A020] md:text-xl">
              Total estimated cost: {formatLKR(totalCost)}
            </p>
            {totalServings != null && totalServings > 0 && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Cost per person: {formatLKR(totalCost / totalServings)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
