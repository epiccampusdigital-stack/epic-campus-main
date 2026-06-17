'use client'

import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import IngredientGrid from '@/components/kitchen/IngredientGrid'
import KitchenBottomSheet from '@/components/kitchen/KitchenBottomSheet'
import CountStepper from '@/components/kitchen/CountStepper'
import { fetchActiveInventory } from '@/lib/kitchen/fetchActiveInventory'
import { MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import { selectedToMenuIngredients } from '@/lib/kitchen/ingredientSelection'
import type { DailyMenu, MealType, InventoryItem, SelectedIngredient } from '@/types/kitchen'

const KITCHEN_LOCATION = 'Ahangama'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'tea']

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  tea: 'Tea',
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

function menuToSelected(menu: DailyMenu, inventory: InventoryItem[]): SelectedIngredient[] {
  return menu.ingredients.reduce<SelectedIngredient[]>((acc, ing) => {
      const item = inventory.find((i) => i.id === ing.itemId)
      if (!item) return acc
      acc.push({
        itemId: ing.itemId,
        itemName: ing.itemName,
        emoji: ing.emoji,
        sinhalaName: ing.sinhalaName,
        qty: ing.baseQty,
        unit: ing.unit,
        unitCost: item.unitCost,
      })
      return acc
    }, [])
}

export default function DailyMenusPage() {
  const { user } = useKitchen()
  const [menus, setMenus] = useState<DailyMenu[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<DailyMenu | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const [menuName, setMenuName] = useState('')
  const [sinhalaName, setSinhalaName] = useState('')
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [baseStudentCount, setBaseStudentCount] = useState('30')
  const [selected, setSelected] = useState<SelectedIngredient[]>([])

  async function loadMenus() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'dailyMenus'))
      setMenus(
        snap.docs
          .map((d) => parseMenu(d.id, d.data() as Record<string, unknown>))
          .filter((m) => m.location === KITCHEN_LOCATION)
          .sort((a, b) => a.mealType.localeCompare(b.mealType)),
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadInventory() {
    const items = await fetchActiveInventory()
    setInventory(items)
  }

  useEffect(() => {
    void loadMenus()
    void loadInventory()
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  function openCreate() {
    setEditing(null)
    setMenuName('')
    setSinhalaName('')
    setMealType('breakfast')
    setBaseStudentCount('30')
    setSelected([])
    void loadInventory()
    setSlideOpen(true)
  }

  function openEdit(menu: DailyMenu) {
    setEditing(menu)
    setMenuName(menu.menuName)
    setSinhalaName(menu.sinhalaName)
    setMealType(menu.mealType)
    setBaseStudentCount(String(menu.baseStudentCount))
    setSelected(menuToSelected(menu, inventory))
    void loadInventory()
    setSlideOpen(true)
  }

  async function handleSave() {
    if (!menuName.trim() || selected.length === 0) return
    setSaving(true)
    try {
      const payload = {
        menuName: menuName.trim(),
        sinhalaName: sinhalaName.trim(),
        mealType,
        location: KITCHEN_LOCATION,
        isActive: true,
        baseStudentCount: Number(baseStudentCount) || 30,
        ingredients: selectedToMenuIngredients(selected),
        updatedAt: serverTimestamp(),
      }

      if (editing) {
        await updateDoc(doc(db, 'dailyMenus', editing.id), payload)
        showToast('Menu updated')
      } else {
        await addDoc(collection(db, 'dailyMenus'), {
          ...payload,
          createdBy: user?.uid ?? '',
          createdAt: serverTimestamp(),
        })
        showToast('Menu created')
      }
      setSlideOpen(false)
      await loadMenus()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(menu: DailyMenu) {
    if (!confirm(`Delete "${menu.menuName}"?`)) return
    await deleteDoc(doc(db, 'dailyMenus', menu.id))
    showToast('Menu deleted')
    await loadMenus()
  }

  const slideFooter = (
    <button
      type="button"
      onClick={() => void handleSave()}
      disabled={saving || !menuName.trim() || selected.length === 0}
      className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] disabled:opacity-50"
    >
      {saving ? 'Saving…' : 'Save Menu'}
    </button>
  )

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-24 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-6">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Daily Menus</h1>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-[48px] rounded-xl bg-[#E8A020] px-5 text-sm font-bold text-[#0B3D6B]"
        >
          Create New Menu
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : (
        MEAL_TYPES.map((type) => {
          const sectionMenus = menus.filter((m) => m.mealType === type && m.isActive)
          const visual = MEAL_SESSION_VISUAL[type]
          return (
            <section key={type}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#0D1B2A] dark:text-white">
                <span>{visual?.emoji}</span> {MEAL_LABELS[type]}
              </h2>
              {sectionMenus.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#DDE3EC] py-8 text-center text-sm text-gray-500 dark:border-gray-600">
                  No active menus for {MEAL_LABELS[type].toLowerCase()}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sectionMenus.map((menu) => (
                    <div
                      key={menu.id}
                      className="rounded-xl border border-white/90 bg-white/65 p-4 dark:border-white/[0.08] dark:bg-white/[0.05]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">
                          {menu.ingredients[0]?.emoji ?? visual?.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#0D1B2A] dark:text-white">{menu.menuName}</p>
                          {menu.sinhalaName && (
                            <p className="text-sm text-[#E8A020]">{menu.sinhalaName}</p>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            Base: {menu.baseStudentCount} students · {menu.ingredients.length}{' '}
                            ingredients
                          </p>
                          <p className="mt-2 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                            {menu.ingredients
                              .slice(0, 5)
                              .map((i) => `${i.emoji} ${i.itemName}`)
                              .join(' · ')}
                            {menu.ingredients.length > 5 ? '…' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(menu)}
                          className="min-h-[40px] flex-1 rounded-lg border border-[#DDE3EC] text-sm font-semibold dark:border-gray-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(menu)}
                          className="min-h-[40px] flex-1 rounded-lg border border-red-200 text-sm font-semibold text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}

      <KitchenBottomSheet
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editing ? 'Edit Menu' : 'Create Menu'}
        footer={slideFooter}
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-bold">Menu name (English)</label>
            <input
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-[#DDE3EC] px-3 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold">Menu name (Sinhala)</label>
            <input
              value={sinhalaName}
              onChange={(e) => setSinhalaName(e.target.value)}
              placeholder="සිංහල නම"
              className="min-h-[48px] w-full rounded-xl border border-[#DDE3EC] px-3 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold">Meal type</label>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((t) => {
                const v = MEAL_SESSION_VISUAL[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMealType(t)}
                    className={`min-h-[72px] rounded-xl border-2 ${
                      mealType === t
                        ? 'border-[#E8A020] bg-[#E8A020]/10'
                        : 'border-[#DDE3EC] dark:border-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{v?.emoji}</span>
                    <p className="text-sm font-semibold">{MEAL_LABELS[t]}</p>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold">Base student count</label>
            <CountStepper value={baseStudentCount} onChange={setBaseStudentCount} step={1} />
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-[#0B3D6B] dark:text-white">
              Ingredients — quantities below are for {baseStudentCount || 30} students
            </p>
            <IngredientGrid
              inventoryItems={inventory}
              selected={selected}
              onChange={setSelected}
              showTotals={false}
            />
          </div>
        </div>
      </KitchenBottomSheet>
    </div>
  )
}
