'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { findFoodItem, getFoodEmoji } from '@/lib/kitchen/foodImages'
import type { InventoryItem } from '@/types/kitchen'

interface IngredientPickerProps {
  inventoryItems: InventoryItem[]
  selectedItemId?: string
  onSelect: (item: InventoryItem) => void
  placeholder?: string
  disabled?: boolean
}

function stockBadge(item: InventoryItem): { label: string; className: string } {
  if (item.currentStock <= 0) {
    return {
      label: 'OUT',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
  }
  if (item.currentStock <= item.minStockLevel) {
    return {
      label: `${item.currentStock} ${item.unit} low`,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    }
  }
  return {
    label: `${item.currentStock} ${item.unit} in stock`,
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  }
}

export default function IngredientPicker({
  inventoryItems,
  selectedItemId = '',
  onSelect,
  placeholder = 'Search ingredients…',
  disabled = false,
}: IngredientPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = inventoryItems.find((i) => i.id === selectedItemId)

  const sorted = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = inventoryItems.filter((item) => {
      if (!q) return true
      const food = findFoodItem(item.itemName)
      return (
        item.itemName.toLowerCase().includes(q) ||
        (food?.sinhalaName?.includes(q) ?? false)
      )
    })
    return [...filtered].sort((a, b) => {
      const aOut = a.currentStock <= 0 ? 1 : 0
      const bOut = b.currentStock <= 0 ? 1 : 0
      if (aOut !== bOut) return aOut - bOut
      return a.itemName.localeCompare(b.itemName)
    })
  }, [inventoryItems, search])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const displayValue = open ? search : (selected?.itemName ?? '')

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg">
          🔍
        </span>
        {selected && !open && (
          <span className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-2xl">
            {getFoodEmoji(selected.itemName)}
          </span>
        )}
        <input
          type="text"
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setSearch(selected?.itemName ?? '')
          }}
          className={`w-full min-h-[52px] rounded-xl border border-[#DDE3EC] bg-white py-3 pr-4 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white ${
            selected && !open ? 'pl-16' : 'pl-10'
          }`}
        />
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-[40vh] w-full overflow-y-auto rounded-xl border border-[#DDE3EC] bg-white shadow-lg dark:border-gray-600 dark:bg-gray-900">
          {inventoryItems.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500">Loading inventory…</li>
          ) : sorted.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500">No items found</li>
          ) : (
            sorted.map((item) => {
              const food = findFoodItem(item.itemName)
              const badge = stockBadge(item)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item)
                      setSearch('')
                      setOpen(false)
                    }}
                    className={`flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06] ${
                      selectedItemId === item.id ? 'bg-[#E8A020]/10' : ''
                    }`}
                  >
                    <span className="text-[32px] leading-none">{getFoodEmoji(item.itemName)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#0D1B2A] dark:text-white">
                        {item.itemName}
                      </p>
                      {food?.sinhalaName && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {food.sinhalaName}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
