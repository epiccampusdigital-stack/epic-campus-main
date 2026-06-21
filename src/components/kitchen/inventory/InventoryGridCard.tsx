'use client'

import FoodEmoji from '@/components/kitchen/FoodEmoji'
import { findFoodItem, getFoodEmoji } from '@/lib/kitchen/foodImages'
import {
  daysUntilExpiry,
  formatExpiryBadgeDate,
  getExpiryStatus,
} from '@/lib/kitchen/expiryHelpers'
import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'
import type { InventoryItem } from '@/types/kitchen'

interface InventoryGridCardProps {
  item: InventoryItem
  onEdit: () => void
  onRestock: () => void
  onRemove: () => void
}

function stockBarColor(item: InventoryItem): string {
  if (item.currentStock <= 0) return 'bg-red-500'
  if (item.currentStock <= item.minStockLevel) return 'bg-red-500'
  if (item.currentStock <= item.minStockLevel * 1.5) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function ExpiryBadge({ item }: { item: InventoryItem }) {
  if (!item.expiryDate) return null
  const status = getExpiryStatus(item)
  const label = formatExpiryBadgeDate(item.expiryDate)

  if (status === 'expired') {
    return (
      <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
        EXPIRED {label}
      </span>
    )
  }
  if (status === 'alert') {
    return (
      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        Expires {label}
      </span>
    )
  }
  if (status === 'week') {
    return (
      <span className="mt-1 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        Exp: {label}
      </span>
    )
  }
  return <p className="mt-1 text-center text-[10px] text-gray-400">Exp: {label}</p>
}

export default function InventoryGridCard({
  item,
  onEdit,
  onRestock,
  onRemove,
}: InventoryGridCardProps) {
  const { sinhala } = useKitchenSinhala()
  const food = findFoodItem(item.itemName)
  const maxBar = Math.max(item.minStockLevel * 2, item.currentStock, 1)
  const fillPct = Math.min(100, (item.currentStock / maxBar) * 100)
  const isOut = item.currentStock <= 0
  const isLow = item.currentStock <= item.minStockLevel && !isOut
  const expiryStatus = getExpiryStatus(item)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => e.key === 'Enter' && onEdit()}
      className={`relative flex min-h-[180px] cursor-pointer flex-col rounded-2xl border-2 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900/50 md:min-h-0 md:p-4 ${
        expiryStatus === 'expired'
          ? 'border-red-500 bg-red-50/30 dark:border-red-600'
          : isOut
            ? 'border-red-400 bg-red-50/50 dark:border-red-600 dark:bg-red-900/10'
            : isLow
              ? 'border-[#E8A020]'
              : 'border-gray-200 dark:border-gray-600'
      }`}
    >
      {isOut && (
        <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
          OUT
        </span>
      )}
      {isLow && !isOut && (
        <span className="absolute right-2 top-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
          Low
        </span>
      )}

      <div className="flex justify-center py-1 md:py-2">
        <span className="text-[56px] leading-none md:hidden" role="img" aria-label={item.itemName}>
          {food?.emoji ?? getFoodEmoji(item.itemName)}
        </span>
        <div className="hidden md:block">
          <FoodEmoji itemName={item.itemName} size="lg" />
        </div>
      </div>

      <p className="text-center text-sm font-bold text-[#0B3D6B] dark:text-white md:text-base">
        {item.itemName}
      </p>
      {sinhala && food?.sinhalaName && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">{food.sinhalaName}</p>
      )}
      {item.notes && (
        <p className="mt-0.5 truncate px-1 text-center text-[10px] text-[#5A6A7A] dark:text-white/40">
          {item.notes}
        </p>
      )}

      <div className="mt-2 md:mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 md:h-2.5">
          <div
            className={`h-full rounded-full transition-all ${stockBarColor(item)}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
        <p className="mt-1 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
          {item.currentStock} {item.unit}
        </p>
        <div className="text-center">
          <ExpiryBadge item={item} />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 md:mt-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          <span className="text-lg">−</span> Remove
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRestock()
          }}
          className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl bg-[#0B3D6B] py-2.5 text-sm font-semibold text-white hover:bg-[#0a3460]"
        >
          <span className="text-lg">+</span> Restock
        </button>
      </div>
    </div>
  )
}
