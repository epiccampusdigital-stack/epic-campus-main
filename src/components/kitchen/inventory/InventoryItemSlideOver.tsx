'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CATEGORY_PILLS,
  FOOD_LIBRARY,
  findFoodItem,
  getFoodByCategory,
  type FoodItem,
} from '@/lib/kitchen/foodImages'
import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'
import type { InventoryCategory, StockUnit } from '@/types/kitchen'

const UNITS: { value: StockUnit; label: string; emoji: string }[] = [
  { value: 'kg', label: 'kg', emoji: '⚖️' },
  { value: 'litres', label: 'litres', emoji: '💧' },
  { value: 'units', label: 'units', emoji: '📦' },
  { value: 'grams', label: 'grams', emoji: '🥄' },
]

export interface InventoryFormValues {
  itemName: string
  category: InventoryCategory
  unit: StockUnit
  currentStock: string
  minStockLevel: string
  unitCost: string
}

interface InventoryItemSlideOverProps {
  mode: 'add' | 'edit'
  initial: InventoryFormValues
  onClose: () => void
  onSave: (values: InventoryFormValues) => void
  saving: boolean
}

export default function InventoryItemSlideOver({
  mode,
  initial,
  onClose,
  onSave,
  saving,
}: InventoryItemSlideOverProps) {
  const { sinhala } = useKitchenSinhala()
  const [form, setForm] = useState<InventoryFormValues>(initial)
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedFood, setSelectedFood] = useState<string | null>(null)
  const [customMode, setCustomMode] = useState(false)

  useEffect(() => {
    setForm(initial)
    const match = findFoodItem(initial.itemName)
    setSelectedFood(match?.name ?? null)
    setCustomMode(!match && !!initial.itemName)
  }, [initial])

  const filteredFood = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim()
    if (!q) return FOOD_LIBRARY.filter((f) => f.name !== 'Other')
    return FOOD_LIBRARY.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.sinhalaName?.includes(q),
    )
  }, [pickerSearch])

  function selectFood(food: FoodItem) {
    if (food.name === 'Other') {
      setCustomMode(true)
      setSelectedFood(null)
      return
    }
    setCustomMode(false)
    setSelectedFood(food.name)
    setForm((f) => ({
      ...f,
      itemName: food.name,
      category: food.category,
    }))
  }

  function adjustStock(field: 'currentStock' | 'minStockLevel', delta: number) {
    setForm((f) => {
      const current = parseFloat(f[field]) || 0
      const next = Math.max(0, current + delta)
      return { ...f, [field]: next > 0 ? String(next) : '' }
    })
  }

  const categories = CATEGORY_PILLS.filter((c) => c.id !== '')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white/95 backdrop-blur-2xl dark:bg-[#0d1a2e]/95 sm:w-[480px]">
        <div className="flex items-center justify-between border-b border-white/80 px-5 py-4 dark:border-white/[0.06]">
          <h3 className="text-lg font-semibold text-[#0D1B2A] dark:text-white">
            {mode === 'add' ? 'Add Item' : 'Edit Item'}
          </h3>
          <button type="button" onClick={onClose} className="ti ti-x text-xl text-gray-500" />
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-[#0D1B2A] dark:text-white">
              1. Choose a picture
            </p>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔍</span>
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search food…"
                className="w-full rounded-xl border border-[#DDE3EC] bg-white py-2.5 pl-10 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            {!pickerSearch &&
              categories.map((cat) => {
                const items = getFoodByCategory(cat.id as InventoryCategory)
                if (items.length === 0) return null
                return (
                  <div key={cat.id} className="mb-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                      {cat.emoji} {cat.label}
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {items.map((food) => (
                        <FoodTile
                          key={food.name}
                          food={food}
                          selected={selectedFood === food.name}
                          sinhala={sinhala}
                          onSelect={() => selectFood(food)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}

            {pickerSearch && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {filteredFood.map((food) => (
                  <FoodTile
                    key={food.name}
                    food={food}
                    selected={selectedFood === food.name}
                    sinhala={sinhala}
                    onSelect={() => selectFood(food)}
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setCustomMode(true)
                setSelectedFood(null)
              }}
              className={`mt-3 w-full rounded-xl border-2 border-dashed py-3 text-sm font-medium ${
                customMode
                  ? 'border-[#E8A020] bg-[#E8A020]/10 text-[#E8A020]'
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400'
              }`}
            >
              📦 Custom item — type any name
            </button>
          </div>

          <div className="border-t border-[#DDE3EC] pt-5 dark:border-white/[0.06]">
            <p className="mb-3 text-sm font-semibold text-[#0D1B2A] dark:text-white">
              2. Set details
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Item name *</label>
                <input
                  type="text"
                  value={form.itemName}
                  onChange={(e) => {
                    const name = e.target.value
                    const match = findFoodItem(name)
                    setForm((f) => ({
                      ...f,
                      itemName: name,
                      category: match?.category ?? f.category,
                    }))
                    if (match) setSelectedFood(match.name)
                  }}
                  className="w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, category: cat.id as InventoryCategory }))
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        form.category === cat.id
                          ? 'bg-[#E8A020] text-white'
                          : 'bg-gray-100 text-gray-700 dark:bg-white/[0.08] dark:text-white/70'
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">Unit</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {UNITS.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, unit: u.value }))}
                      className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl border-2 py-2 text-sm font-semibold ${
                        form.unit === u.value
                          ? 'border-[#E8A020] bg-[#E8A020] text-white'
                          : 'border-[#DDE3EC] bg-white text-[#0D1B2A] dark:border-gray-600 dark:bg-gray-900 dark:text-white'
                      }`}
                    >
                      <span className="text-xl">{u.emoji}</span>
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">
                  Current stock *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustStock('currentStock', -1)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-xl font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={form.currentStock}
                    onChange={(e) => setForm((f) => ({ ...f, currentStock: e.target.value }))}
                    className="h-12 flex-1 rounded-xl border border-[#DDE3EC] bg-white text-center text-xl font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => adjustStock('currentStock', 1)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-xl font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">
                  Min stock level *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustStock('minStockLevel', -1)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-xl font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={form.minStockLevel}
                    onChange={(e) => setForm((f) => ({ ...f, minStockLevel: e.target.value }))}
                    className="h-12 flex-1 rounded-xl border border-[#DDE3EC] bg-white text-center text-xl font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => adjustStock('minStockLevel', 1)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-xl font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Unit cost (LKR) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.unitCost}
                  onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
                  className="w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/80 p-5 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={
              saving ||
              !form.itemName ||
              !form.currentStock ||
              !form.minStockLevel ||
              !form.unitCost
            }
            className="w-full rounded-xl bg-[#E8A020] py-4 text-base font-bold text-white hover:bg-[#d4911c] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Item'}
          </button>
        </div>
      </div>
    </>
  )
}

function FoodTile({
  food,
  selected,
  sinhala,
  onSelect,
}: {
  food: FoodItem
  selected: boolean
  sinhala: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-center rounded-xl border-2 bg-white p-2 transition-colors dark:bg-gray-900 ${
        selected
          ? 'border-[#E8A020] bg-[#E8A020]/5'
          : 'border-gray-200 hover:border-[#E8A020]/50 dark:border-gray-600'
      }`}
    >
      {selected && (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E8A020] text-xs text-white">
          ✓
        </span>
      )}
      <span className="text-[48px] leading-none">{food.emoji}</span>
      <span className="mt-1 text-center text-[10px] font-medium leading-tight text-[#0B3D6B] dark:text-white">
        {food.name}
      </span>
      {sinhala && food.sinhalaName && (
        <span className="text-[9px] text-gray-500">{food.sinhalaName}</span>
      )}
    </button>
  )
}
