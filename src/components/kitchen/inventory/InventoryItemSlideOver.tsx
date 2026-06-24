'use client'

import { useEffect, useMemo, useState } from 'react'
import KitchenBottomSheet from '@/components/kitchen/KitchenBottomSheet'
import CountStepper from '@/components/kitchen/CountStepper'
import {
  CATEGORY_PILLS,
  FOOD_LIBRARY,
  findFoodItem,
  getFoodByCategory,
  getFoodEmoji,
  type FoodItem,
} from '@/lib/kitchen/foodImages'
import { searchEmoji, getEmojiForItem } from '@/lib/kitchen/emojiSearch'
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
  expiryDate: string
  expiryAlertDays: string
  notes: string
  emoji: string
}

interface InventoryItemSlideOverProps {
  mode: 'add' | 'edit'
  initial: InventoryFormValues
  onClose: () => void
  onSave: (
    values: InventoryFormValues,
    brands: {
      brandName: string
      supplierName: string
      pricePerUnit: string
      isPreferred: boolean
    }[],
  ) => void
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
  const [emojiSuggestions, setEmojiSuggestions] = useState<string[]>([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedFood, setSelectedFood] = useState<string | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [brands, setBrands] = useState<{
    brandName: string
    supplierName: string
    pricePerUnit: string
    isPreferred: boolean
  }[]>([])

  useEffect(() => {
    setForm(initial)
    setBrands([])
    const match = findFoodItem(initial.itemName)
    setSelectedFood(match?.name ?? null)
    setCustomMode(!match && !!initial.itemName)
  }, [initial])

  const filteredFood = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim()
    if (!q) return FOOD_LIBRARY.filter((f) => f.name !== 'Other')
    return FOOD_LIBRARY.filter(
      (f) => f.name.toLowerCase().includes(q) || f.sinhalaName?.includes(q),
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

  const categories = CATEGORY_PILLS.filter((c) => c.id !== '')

  const footer = (
    <button
      type="button"
      onClick={() => onSave(form, brands)}
      disabled={
        saving || !form.itemName || !form.currentStock || !form.minStockLevel || !form.unitCost
      }
      className="w-full rounded-xl bg-[#E8A020] py-4 text-base font-bold text-white hover:bg-[#d4911c] disabled:opacity-50"
    >
      {saving ? 'Saving…' : 'Save Item'}
    </button>
  )

  return (
    <KitchenBottomSheet
      open
      onClose={onClose}
      title={mode === 'add' ? 'Add Item' : 'Edit Item'}
      footer={footer}
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-base font-bold text-[#0D1B2A] dark:text-white">
            1. Choose a picture
          </p>
          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg">
              🔍
            </span>
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search food…"
              className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white py-3 pl-10 pr-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>

          {!pickerSearch &&
            categories.map((cat) => {
              const items = getFoodByCategory(cat.id as InventoryCategory)
              if (items.length === 0) return null
              return (
                <div key={cat.id} className="mb-4">
                  <p className="mb-2 text-sm font-semibold uppercase text-gray-500">
                    {cat.emoji} {cat.label}
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
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
            <div className="grid grid-cols-4 gap-2">
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
            className={`mt-3 min-h-[48px] w-full rounded-xl border-2 border-dashed py-3 text-sm font-medium ${
              customMode
                ? 'border-[#E8A020] bg-[#E8A020]/10 text-[#E8A020]'
                : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400'
            }`}
          >
            📦 Custom item — type any name
          </button>
        </div>

        <div className="border-t border-[#DDE3EC] pt-5 dark:border-white/[0.06]">
          <p className="mb-3 text-base font-bold text-[#0D1B2A] dark:text-white">2. Set details</p>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Item name *
              </label>
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
                className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Emoji
              </label>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">
                  {form.emoji || getFoodEmoji(form.itemName) || '📦'}
                </span>
                <input
                  type="text"
                  value={form.emoji}
                  onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                  placeholder="Paste emoji e.g. 🍚"
                  maxLength={8}
                  className="w-28 min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-2xl dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const suggestions = searchEmoji(form.itemName, 8)
                    setEmojiSuggestions(suggestions)
                  }}
                  className="rounded-xl bg-[#0B3D6B] px-3 py-2 text-xs font-semibold text-white"
                >
                  Search
                </button>
              </div>

              {emojiSuggestions.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-[#5A6A7A] dark:text-white/40">
                    Tap to pick:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {emojiSuggestions.map((emoji, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, emoji }))
                          setEmojiSuggestions([])
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#DDE3EC] bg-white text-2xl hover:border-[#E8A020] dark:border-gray-600 dark:bg-gray-900"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEmojiSuggestions([])}
                      className="rounded-xl border border-[#DDE3EC] px-2 py-1 text-xs text-[#5A6A7A]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-1 text-xs text-[#5A6A7A] dark:text-white/40">
                Click Search to find emojis by item name, or paste one directly
              </p>
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Category
              </label>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, category: cat.id as InventoryCategory }))
                    }
                    className={`min-h-[40px] shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
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
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Unit
              </label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Current stock *
              </label>
              <CountStepper
                value={form.currentStock}
                onChange={(v) => setForm((f) => ({ ...f, currentStock: v }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Min stock level *
              </label>
              <CountStepper
                value={form.minStockLevel}
                onChange={(v) => setForm((f) => ({ ...f, minStockLevel: v }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Unit cost (LKR) *
              </label>
              <input
                type="number"
                min="0"
                value={form.unitCost}
                onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
                className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Expiry Date
              </label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Alert me X days before
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={form.expiryAlertDays}
                onChange={(e) => setForm((f) => ({ ...f, expiryAlertDays: e.target.value }))}
                className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="e.g. Store in cool dry place, check expiry monthly..."
                className="w-full resize-none rounded-xl border border-[#DDE3EC] bg-white px-3 py-3 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="border-t border-[#DDE3EC] pt-5 dark:border-white/[0.06]">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-base font-bold text-[#0D1B2A] dark:text-white">3. Brands & Suppliers</p>
                <button
                  type="button"
                  onClick={() =>
                    setBrands((b) => [
                      ...b,
                      {
                        brandName: '',
                        supplierName: '',
                        pricePerUnit: '',
                        isPreferred: false,
                      },
                    ])
                  }
                  className="rounded-xl bg-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  + Add Brand
                </button>
              </div>

              {brands.length === 0 && (
                <p className="text-sm text-[#5A6A7A] dark:text-white/40">
                  No brands added yet. Add brands you buy for this item.
                </p>
              )}

              <div className="space-y-4">
                {brands.map((brand, idx) => (
                  <div
                    key={idx}
                    className="space-y-3 rounded-xl border border-[#DDE3EC] p-4 dark:border-white/[0.08]"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#0B3D6B] dark:text-white">
                        Brand {idx + 1}
                      </p>
                      <div className="flex items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#5A6A7A] dark:text-white/50">
                          <input
                            type="checkbox"
                            checked={brand.isPreferred}
                            onChange={(e) =>
                              setBrands((b) =>
                                b.map((br, i) =>
                                  i === idx ? { ...br, isPreferred: e.target.checked } : br,
                                ),
                              )
                            }
                            className="rounded"
                          />
                          Preferred
                        </label>
                        <button
                          type="button"
                          onClick={() => setBrands((b) => b.filter((_, i) => i !== idx))}
                          className="text-xs font-medium text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                        Brand Name *
                      </label>
                      <input
                        type="text"
                        value={brand.brandName}
                        onChange={(e) =>
                          setBrands((b) =>
                            b.map((br, i) => (i === idx ? { ...br, brandName: e.target.value } : br)),
                          )
                        }
                        placeholder="e.g. Saumya, Nippon, CIC"
                        className="w-full min-h-[44px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                        Supplier Name
                      </label>
                      <input
                        type="text"
                        value={brand.supplierName}
                        onChange={(e) =>
                          setBrands((b) =>
                            b.map((br, i) =>
                              i === idx ? { ...br, supplierName: e.target.value } : br,
                            ),
                          )
                        }
                        placeholder="e.g. Galle Wholesale Market"
                        className="w-full min-h-[44px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                        Price per unit (LKR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={brand.pricePerUnit}
                        onChange={(e) =>
                          setBrands((b) =>
                            b.map((br, i) =>
                              i === idx ? { ...br, pricePerUnit: e.target.value } : br,
                            ),
                          )
                        }
                        placeholder="0"
                        className="w-full min-h-[44px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      />
                    </div>

                    {brand.isPreferred && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8A020]/15 px-2.5 py-0.5 text-xs font-semibold text-[#E8A020]">
                        ★ Preferred brand
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </KitchenBottomSheet>
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
      className={`relative flex min-h-[72px] flex-col items-center justify-center rounded-xl border-2 bg-white p-2 transition-colors dark:bg-gray-900 ${
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
      <span className="text-2xl leading-none md:text-[48px]">{food.emoji}</span>
      <span className="mt-1 text-center text-xs font-medium leading-tight text-[#0B3D6B] dark:text-white">
        {food.name}
      </span>
      {sinhala && food.sinhalaName && (
        <span className="text-[10px] text-gray-500">{food.sinhalaName}</span>
      )}
    </button>
  )
}
