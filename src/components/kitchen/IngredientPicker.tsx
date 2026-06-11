'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getFoodEmoji } from '@/lib/kitchen/foodImages'
import type { InventoryItem } from '@/types/kitchen'

interface IngredientPickerProps {
  items: InventoryItem[]
  value: string
  onChange: (itemId: string) => void
  placeholder?: string
  disabled?: boolean
}

export default function IngredientPicker({
  items,
  value,
  onChange,
  placeholder = 'Search ingredients…',
  disabled = false,
}: IngredientPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = items.find((i) => i.id === value)

  const sorted = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = items.filter((i) => !q || i.itemName.toLowerCase().includes(q))
    return [...filtered].sort((a, b) => {
      const aOut = a.currentStock <= 0 ? 1 : 0
      const bOut = b.currentStock <= 0 ? 1 : 0
      if (aOut !== bOut) return aOut - bOut
      return a.itemName.localeCompare(b.itemName)
    })
  }, [items, search])

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
          {sorted.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500">No items found</li>
          ) : (
            sorted.map((item) => {
              const out = item.currentStock <= 0
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(item.id)
                      setSearch('')
                      setOpen(false)
                    }}
                    className={`flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06] ${
                      value === item.id ? 'bg-[#E8A020]/10' : ''
                    }`}
                  >
                    <span className="text-[32px] leading-none">{getFoodEmoji(item.itemName)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#0D1B2A] dark:text-white">
                      {item.itemName}
                    </span>
                    {out ? (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                        OUT
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {item.currentStock} {item.unit}
                      </span>
                    )}
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
