'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import { rescaleMenuIngredients, scaleQuantity } from '@/lib/kitchen/mealLogHelpers'
import CountStepper from '@/components/kitchen/CountStepper'
import type { DailyMenu, InventoryItem, MealType, SelectedIngredient } from '@/types/kitchen'

interface DailyMenuLoaderProps {
  mealType: MealType
  inventory: InventoryItem[]
  defaultStudentCount: number
  selected: SelectedIngredient[]
  onChange: (selected: SelectedIngredient[]) => void
  appliedMenu: DailyMenu | null
  onMenuApplied: (menu: DailyMenu | null) => void
}

function parseDailyMenu(id: string, data: Record<string, unknown>): DailyMenu {
  return {
    id,
    menuName: String(data.menuName ?? ''),
    sinhalaName: String(data.sinhalaName ?? ''),
    mealType: data.mealType as MealType,
    location: String(data.location ?? 'Ahangama'),
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
  inventory,
  defaultStudentCount,
  selected,
  onChange,
  appliedMenu,
  onMenuApplied,
}: DailyMenuLoaderProps) {
  const [menus, setMenus] = useState<DailyMenu[]>([])
  const [scaleCount, setScaleCount] = useState(String(defaultStudentCount || 30))

  useEffect(() => {
    setScaleCount(String(defaultStudentCount || 30))
  }, [defaultStudentCount])

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
          snap.docs.map((d) => parseDailyMenu(d.id, d.data() as Record<string, unknown>)),
        )
      } catch {
        const snap = await getDocs(collection(db, 'dailyMenus'))
        setMenus(
          snap.docs
            .map((d) => parseDailyMenu(d.id, d.data() as Record<string, unknown>))
            .filter((m) => m.mealType === mealType && m.isActive),
        )
      }
    }
    void load()
  }, [mealType])

  useEffect(() => {
    if (!appliedMenu) return
    const today = Number(scaleCount) || appliedMenu.baseStudentCount
    onChange(rescaleMenuIngredients(appliedMenu.ingredients, appliedMenu.baseStudentCount, today, inventory))
  }, [scaleCount, appliedMenu?.id])

  if (menus.length === 0) return null

  const today = Number(scaleCount) || 0
  const multiplier =
    appliedMenu && appliedMenu.baseStudentCount > 0
      ? Math.round((today / appliedMenu.baseStudentCount) * 100) / 100
      : 1

  const stockIssues = selected
    .map((s) => {
      const item = inventory.find((i) => i.id === s.itemId)
      if (!item || s.qty <= item.currentStock) return null
      return { ...s, available: item.currentStock }
    })
    .filter(Boolean) as Array<SelectedIngredient & { available: number }>

  return (
    <div className="space-y-3 rounded-xl border border-[#0B3D6B]/20 bg-[#0B3D6B]/5 p-4">
      <p className="text-sm font-bold text-[#0B3D6B] dark:text-white">📋 Load Daily Menu</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {menus.map((menu) => {
          const visual = MEAL_SESSION_VISUAL[menu.mealType]
          const active = appliedMenu?.id === menu.id
          return (
            <button
              key={menu.id}
              type="button"
              onClick={() => {
                onMenuApplied(menu)
                const count = Number(scaleCount) || defaultStudentCount || menu.baseStudentCount
                onChange(
                  rescaleMenuIngredients(menu.ingredients, menu.baseStudentCount, count, inventory),
                )
              }}
              className={`min-w-[200px] shrink-0 rounded-xl border p-3 text-left ${
                active
                  ? 'border-[#E8A020] bg-[#E8A020]/10'
                  : 'border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-900'
              }`}
            >
              <span className="text-2xl">{visual?.emoji}</span>
              <p className="mt-1 text-sm font-bold">{menu.menuName}</p>
              <p className="text-xs text-[#E8A020]">{menu.sinhalaName}</p>
              <p className="mt-1 text-[10px] text-gray-500">
                Base: {menu.baseStudentCount} students · {menu.ingredients.length} ingredients
              </p>
              <p className="mt-1 line-clamp-1 text-[10px] text-gray-400">
                {menu.ingredients.map((i) => `${i.emoji} ${i.itemName}`).join(' · ')}
              </p>
            </button>
          )
        })}
      </div>

      {appliedMenu && (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-gray-600 dark:bg-gray-900">
          <p className="text-sm font-bold text-[#0D1B2A] dark:text-white">
            Adjust for today&apos;s student count
          </p>
          <p className="mt-1 text-xs text-gray-500">Base: {appliedMenu.baseStudentCount} students</p>
          <div className="mt-3 max-w-xs">
            <p className="mb-1 text-xs font-medium">Today:</p>
            <CountStepper value={scaleCount} onChange={setScaleCount} step={1} min={1} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Quantities scale automatically ({multiplier}× multiplier)
          </p>
          <ul className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {appliedMenu.ingredients.slice(0, 6).map((ing) => {
              const scaled = scaleQuantity(ing.baseQty, appliedMenu.baseStudentCount, today)
              return (
                <li key={ing.itemId}>
                  {ing.emoji} {ing.itemName}: {ing.baseQty} {ing.unit} → {scaled} {ing.unit} (for{' '}
                  {today} students)
                </li>
              )
            })}
          </ul>
          {stockIssues.map((s) => (
            <p key={s.itemId} className="mt-2 text-xs font-medium text-red-600">
              ⚠️ Not enough {s.itemName} — need {s.qty} {s.unit}, only {s.available} {s.unit} in
              stock. Order more or reduce quantity.
            </p>
          ))}
          <button
            type="button"
            onClick={() => onMenuApplied(null)}
            className="mt-3 text-xs font-semibold text-[#5A6A7A] underline"
          >
            Clear menu
          </button>
        </div>
      )}
    </div>
  )
}
