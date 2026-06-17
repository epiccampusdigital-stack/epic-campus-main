'use client'

import { useMemo, useState } from 'react'
import { findFoodItem } from '@/lib/kitchen/foodImages'
import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'
import { inventoryToSelected } from '@/lib/kitchen/ingredientSelection'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { InventoryItem, SelectedIngredient } from '@/types/kitchen'

interface IngredientGridProps {
  inventoryItems: InventoryItem[]
  selected: SelectedIngredient[]
  onChange: (selected: SelectedIngredient[]) => void
  sinhala?: boolean
  totalServings?: number
  showTotals?: boolean
}

function stockLabel(item: InventoryItem): { text: string; className: string } {
  if (item.currentStock <= 0) {
    return { text: 'Out', className: 'text-red-600' }
  }
  if (item.currentStock <= item.minStockLevel) {
    return { text: `${item.currentStock} ${item.unit}`, className: 'text-amber-600' }
  }
  return { text: `${item.currentStock} ${item.unit} ✓`, className: 'text-emerald-600' }
}

export default function IngredientGrid({
  inventoryItems,
  selected,
  onChange,
  sinhala: sinhalaProp,
  totalServings = 0,
  showTotals = true,
}: IngredientGridProps) {
  const { sinhala: sinhalaSetting } = useKitchenSinhala()
  const showSinhala = sinhalaProp ?? sinhalaSetting
  const [search, setSearch] = useState('')

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.itemId)), [selected])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return inventoryItems.filter((item) => {
      if (!q) return true
      const food = findFoodItem(item.itemName)
      return (
        item.itemName.toLowerCase().includes(q) ||
        (food?.sinhalaName?.includes(q) ?? false)
      )
    })
  }, [inventoryItems, search])

  const totalCost = selected.reduce((sum, s) => sum + s.qty * s.unitCost, 0)
  const costPerPerson = totalServings > 0 ? totalCost / totalServings : 0

  function toggleItem(item: InventoryItem) {
    if (item.currentStock <= 0) return
    if (selectedIds.has(item.id)) {
      onChange(selected.filter((s) => s.itemId !== item.id))
    } else {
      onChange([...selected, inventoryToSelected(item, 1)])
    }
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
        className="min-h-[48px] w-full rounded-xl border border-[#DDE3EC] bg-white px-4 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {filtered.map((item) => {
          const isSelected = selectedIds.has(item.id)
          const outOfStock = item.currentStock <= 0
          const lowStock = !outOfStock && item.currentStock <= item.minStockLevel
          const food = findFoodItem(item.itemName)
          const stock = stockLabel(item)

          return (
            <button
              key={item.id}
              type="button"
              disabled={outOfStock}
              onClick={() => toggleItem(item)}
              className={`relative flex min-h-[120px] flex-col items-center justify-center rounded-xl p-3 text-center transition-all ${
                outOfStock
                  ? 'cursor-not-allowed border border-gray-200 bg-white opacity-40 dark:border-gray-700 dark:bg-white/5'
                  : isSelected
                    ? 'border-2 border-[#E8A020] bg-[#E8A020]/10'
                    : lowStock
                      ? 'border border-amber-400 bg-white dark:bg-white/5'
                      : 'border border-gray-200 bg-white dark:border-gray-600 dark:bg-white/5'
              }`}
            >
              {isSelected && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#E8A020] text-xs font-bold text-white">
                  ✓
                </span>
              )}
              {outOfStock && (
                <span className="absolute right-2 top-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                  Out
                </span>
              )}
              <span className="text-[48px] leading-none">{food?.emoji ?? '📦'}</span>
              <p className="mt-1 line-clamp-2 text-sm font-bold text-[#0D1B2A] dark:text-white">
                {item.itemName}
              </p>
              {showSinhala && food?.sinhalaName && (
                <p className="text-xs text-[#E8A020]">{food.sinhalaName}</p>
              )}
              <p className={`mt-1 text-[10px] font-medium ${stock.className}`}>{stock.text}</p>
            </button>
          )
        })}
      </div>

      {selected.length > 0 && (
        <div className="space-y-3 rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-900/40">
          <p className="text-sm font-bold text-[#0B3D6B] dark:text-white">Selected quantities</p>
          {selected.map((row) => {
            const item = inventoryItems.find((i) => i.id === row.itemId)
            const overStock = item && row.qty > item.currentStock
            return (
              <div
                key={row.itemId}
                className="flex flex-wrap items-center gap-2 border-b border-[#DDE3EC]/60 pb-3 last:border-0 last:pb-0 dark:border-gray-700"
              >
                <span className="text-2xl">{row.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">
                    {row.itemName}
                  </p>
                  {showSinhala && row.sinhalaName && (
                    <p className="text-xs text-[#E8A020]">{row.sinhalaName}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustQty(row.itemId, -0.5)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#DDE3EC] bg-white text-lg font-bold dark:border-gray-600 dark:bg-gray-800"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={row.qty}
                    onChange={(e) => updateQty(row.itemId, parseFloat(e.target.value) || 0)}
                    className="h-11 w-16 rounded-lg border border-[#DDE3EC] bg-white text-center text-sm font-semibold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <span className="w-10 text-center text-xs text-gray-500">{row.unit}</span>
                  <button
                    type="button"
                    onClick={() => adjustQty(row.itemId, 0.5)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#DDE3EC] bg-white text-lg font-bold dark:border-gray-600 dark:bg-gray-800"
                  >
                    +
                  </button>
                </div>
                <p className="w-full text-right text-sm font-semibold text-[#0B3D6B] sm:w-auto dark:text-white">
                  {formatLKR(row.qty * row.unitCost)}
                </p>
                {overStock && (
                  <p className="w-full text-xs font-medium text-amber-600">
                    Only {item!.currentStock} {item!.unit} available
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showTotals && selected.length > 0 && (
        <div className="rounded-xl bg-[#E8A020]/10 p-4 text-center">
          <p className="text-xl font-bold text-[#E8A020]">
            Total estimated cost: {formatLKR(totalCost)}
          </p>
          {totalServings > 0 && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Cost per person: {formatLKR(costPerPerson)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
