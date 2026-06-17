'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import CountStepper from '@/components/kitchen/CountStepper'
import { getFoodEmoji } from '@/lib/kitchen/foodImages'
import { scaleQuantity } from '@/lib/kitchen/ingredientSelection'
import type { DailyMenu, InventoryItem, MealType } from '@/types/kitchen'

const KITCHEN_LOCATION = 'Ahangama'

interface DailyMenuLoaderProps {
  mealType: MealType
  studentCount: number
  inventory: InventoryItem[]
  appliedMenu: DailyMenu | null
  onSelectMenu: (menu: DailyMenu) => void
  onClearMenu: () => void
  onTodayCountChange: (count: number) => void
  todayCount: number
}

function parseMenu(id: string, data: Record<string, unknown>): DailyMenu {
  return {
    id,
    menuName: String(data.menuName ?? ''),
    sinhalaName: String(data.sinhalaName ?? ''),
    mealType: data.mealType as MealType,
    location: String(data.location ?? KITCHEN_LOCATION),
    isActive: data.isActive !== false,
    baseStudentCount: Number(data.baseStudentCount ?? 30),
    ingredients: Array.isArray(data.ingredients)
      ? (data.ingredients as DailyMenu['ingredients'])
      : [],
    createdAt: data.createdAt as DailyMenu['createdAt'],
    updatedAt: data.updatedAt as DailyMenu['updatedAt'],
    createdBy: String(data.createdBy ?? ''),
  }
}

export default function DailyMenuLoader({
  mealType,
  studentCount,
  inventory,
  appliedMenu,
  onSelectMenu,
  onClearMenu,
  onTodayCountChange,
  todayCount,
}: DailyMenuLoaderProps) {
  const [menus, setMenus] = useState<DailyMenu[]>([])

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'dailyMenus'),
            where('mealType', '==', mealType),
            where('isActive', '==', true),
          ),
        )
        setMenus(
          snap.docs
            .map((d) => parseMenu(d.id, d.data() as Record<string, unknown>))
            .filter((m) => m.location === KITCHEN_LOCATION || !m.location),
        )
      } catch {
        const snap = await getDocs(collection(db, 'dailyMenus'))
        setMenus(
          snap.docs
            .map((d) => parseMenu(d.id, d.data() as Record<string, unknown>))
            .filter((m) => m.mealType === mealType && m.isActive),
        )
      }
    }
    void load()
  }, [mealType])

  if (menus.length === 0 && !appliedMenu) return null

  const multiplier =
    appliedMenu && appliedMenu.baseStudentCount > 0
      ? Math.round((todayCount / appliedMenu.baseStudentCount) * 100) / 100
      : 1

  return (
    <div className="space-y-3 rounded-xl border border-[#0B3D6B]/20 bg-[#0B3D6B]/5 p-4">
      <p className="text-sm font-bold text-[#0B3D6B] dark:text-white">📋 Load Daily Menu</p>

      {!appliedMenu && (
        <div className="space-y-2">
          {menus.map((menu) => (
            <button
              key={menu.id}
              type="button"
              onClick={() => onSelectMenu(menu)}
              className="flex w-full items-center gap-3 rounded-xl border border-[#DDE3EC] bg-white p-4 text-left dark:border-gray-600 dark:bg-gray-900"
            >
              <span className="text-3xl">
                {menu.ingredients[0]?.emoji ?? getFoodEmoji(menu.ingredients[0]?.itemName ?? '')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#0D1B2A] dark:text-white">{menu.menuName}</p>
                {menu.sinhalaName && (
                  <p className="text-sm text-[#E8A020]">{menu.sinhalaName}</p>
                )}
                <p className="text-xs text-gray-500">
                  Base: {menu.baseStudentCount} students · {menu.ingredients.length} ingredients
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {appliedMenu && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-[#0D1B2A] dark:text-white">{appliedMenu.menuName}</p>
              {appliedMenu.sinhalaName && (
                <p className="text-sm text-[#E8A020]">{appliedMenu.sinhalaName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClearMenu}
              className="text-xs font-semibold text-gray-500 underline"
            >
              Clear
            </button>
          </div>

          <div className="rounded-lg bg-white p-4 dark:bg-gray-900">
            <p className="mb-3 text-sm font-semibold text-[#0B3D6B] dark:text-white">
              Adjust for today&apos;s student count
            </p>
            <p className="text-xs text-gray-500">Base: {appliedMenu.baseStudentCount} students</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm text-gray-600">Today:</span>
              <CountStepper
                value={String(todayCount || studentCount || appliedMenu.baseStudentCount)}
                onChange={(v) => onTodayCountChange(Number(v) || 0)}
                step={1}
              />
              <span className="text-sm text-gray-500">students</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Quantities will scale automatically · {todayCount || studentCount}/
              {appliedMenu.baseStudentCount} = {multiplier}× multiplier
            </p>
          </div>

          <ul className="space-y-1 text-sm">
            {appliedMenu.ingredients.map((ing) => {
              const scaled = scaleQuantity(
                ing.baseQty,
                appliedMenu.baseStudentCount,
                todayCount || studentCount || appliedMenu.baseStudentCount,
              )
              const item = inventory.find((i) => i.id === ing.itemId)
              const short = item && scaled > item.currentStock
              return (
                <li key={ing.itemId} className={short ? 'text-red-600' : 'text-gray-600'}>
                  {ing.emoji} {ing.itemName}: {ing.baseQty} {ing.unit} → {scaled} {ing.unit}
                  {short && (
                    <span className="block text-xs">
                      ⚠️ Not enough {ing.itemName} — need {scaled} {ing.unit}, only{' '}
                      {item.currentStock} {ing.unit} in stock. Order more or reduce quantity.
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
