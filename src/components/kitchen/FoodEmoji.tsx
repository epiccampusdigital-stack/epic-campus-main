'use client'

import { findFoodItem, getFoodEmoji } from '@/lib/kitchen/foodImages'
import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'

interface FoodEmojiProps {
  itemName: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showName?: boolean
  sinhala?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: { emoji: 'text-[32px] leading-none', box: 'h-14 w-14', name: 'text-xs', sinhala: 'text-[10px]' },
  md: { emoji: 'text-[48px] leading-none', box: 'h-20 w-20', name: 'text-sm', sinhala: 'text-xs' },
  lg: { emoji: 'text-[64px] leading-none', box: 'h-24 w-24', name: 'text-base', sinhala: 'text-sm' },
  xl: { emoji: 'text-[80px] leading-none', box: 'h-28 w-28', name: 'text-lg', sinhala: 'text-sm' },
}

export default function FoodEmoji({
  itemName,
  size = 'md',
  showName = false,
  sinhala: sinhalaProp,
  className = '',
}: FoodEmojiProps) {
  const { sinhala: sinhalaSetting } = useKitchenSinhala()
  const showSinhala = sinhalaProp ?? sinhalaSetting
  const food = findFoodItem(itemName)
  const emoji = food?.emoji ?? getFoodEmoji(itemName)
  const styles = SIZE_MAP[size]

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div
        className={`flex ${styles.box} items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800`}
      >
        <span className={styles.emoji} role="img" aria-label={itemName}>
          {emoji}
        </span>
      </div>
      {showName && (
        <div className="text-center">
          <p className={`font-semibold text-[#0B3D6B] dark:text-white ${styles.name}`}>
            {itemName}
          </p>
          {showSinhala && food?.sinhalaName && (
            <p className={`text-gray-500 dark:text-gray-400 ${styles.sinhala}`}>
              {food.sinhalaName}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
