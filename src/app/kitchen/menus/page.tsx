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
import CountStepper from '@/components/kitchen/CountStepper'
import IngredientGrid from '@/components/kitchen/IngredientGrid'
import KitchenBottomSheet from '@/components/kitchen/KitchenBottomSheet'
import { fetchActiveInventory } from '@/lib/kitchen/fetchActiveInventory'
import { MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'
import type { DailyMenu, DailyMenuIngredient, MealType, SelectedIngredient } from '@/types/kitchen'

const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch', label: 'Lunch', emoji: '☀️' },
  { value: 'dinner', label: 'Dinner', emoji: '🌙' },
  { value: 'tea', label: 'Tea', emoji: '☕' },
]

const LOCATION = 'Ahangama'

function parseDailyMenu(id: string, data: Record<string, unknown>): DailyMenu {
  return {
    id,
    menuName: String(data.menuName ?? ''),
    sinhalaName: String(data.sinhalaName ?? ''),
    mealType: data.mealType as MealType,
    location: String(data.location ?? LOCATION),
    isActive: data.isActive !== false,
    baseStudentCount: Number(data.baseStudentCount ?? 30),
    ingredients: Array.isArray(data.ingredients)
      ? (data.ingredients as DailyMenuIngredient[])
      : [],
    createdAt: data.createdAt as DailyMenu['createdAt'],
    updatedAt: data.updatedAt as DailyMenu['updatedAt'],
    createdBy: String(data.createdBy ?? ''),
  }
}

function menuToSelected(menu: DailyMenu): SelectedIngredient[] {
  return menu.ingredients.map((ing) => ({
    itemId: ing.itemId,
    itemName: ing.itemName,
    sinhalaName: ing.sinhalaName,
    emoji: ing.emoji,
    qty: ing.baseQty,
    unit: ing.unit,
    unitCost: ing.unitCost,
  }))
}

function selectedToMenuIngredients(selected: SelectedIngredient[]): DailyMenuIngredient[] {
  return selected
    .filter((s) => s.qty > 0)
    .map((s) => ({
      itemId: s.itemId,
      itemName: s.itemName,
      sinhalaName: s.sinhalaName,
      emoji: s.emoji,
      baseQty: s.qty,
      unit: s.unit,
      unitCost: s.unitCost,
    }))
}

export default function DailyMenusPage() {
  const { user } = useKitchen()
  const { sinhala } = useKitchenSinhala()
  const [menus, setMenus] = useState<DailyMenu[]>([])
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof fetchActiveInventory>>>([])
  const [loading, setLoading] = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<DailyMenu | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const [menuName, setMenuName] = useState('')
  const [sinhalaName, setSinhalaName] = useState('')
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [baseCount, setBaseCount] = useState('30')
  const [selected, setSelected] = useState<SelectedIngredient[]>([])

  async function loadMenus() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'dailyMenus'))
      setMenus(
        snap.docs
          .map((d) => parseDailyMenu(d.id, d.data() as Record<string, unknown>))
          .filter((m) => m.location === LOCATION)
          .sort((a, b) => a.menuName.localeCompare(b.menuName)),
      )
    } catch (err) {
      console.error('[DailyMenus]', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadInventory() {
    try {
      setInventory(await fetchActiveInventory())
    } catch (err) {
      console.error('[DailyMenus inventory]', err)
    }
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
    setBaseCount('30')
    setSelected([])
    setSlideOpen(true)
  }

  function openEdit(menu: DailyMenu) {
    setEditing(menu)
    setMenuName(menu.menuName)
    setSinhalaName(menu.sinhalaName)
    setMealType(menu.mealType)
    setBaseCount(String(menu.baseStudentCount))
    setSelected(menuToSelected(menu))
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
        location: LOCATION,
        isActive: true,
        baseStudentCount: Number(baseCount) || 30,
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
    } catch (err) {
      console.error('[DailyMenus save]', err)
      showToast('Failed to save menu')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(menu: DailyMenu) {
    if (!confirm(`Delete "${menu.menuName}"?`)) return
    try {
      await deleteDoc(doc(db, 'dailyMenus', menu.id))
      showToast('Menu deleted')
      await loadMenus()
    } catch (err) {
      console.error('[DailyMenus delete]', err)
      showToast('Failed to delete menu')
    }
  }

  const baseStudentCount = Number(baseCount) || 30
  const canSave = menuName.trim() && selected.some((s) => s.qty > 0)

  const slideFooter = (
    <button
      type="button"
      disabled={saving || !canSave}
      onClick={() => void handleSave()}
      className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] disabled:opacity-50"
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Daily Menus</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex min-h-[48px] items-center justify-center rounded-xl bg-[#E8A020] px-5 text-sm font-bold text-[#0B3D6B]"
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
        MEAL_TYPES.map((section) => {
          const sectionMenus = menus.filter((m) => m.mealType === section.value && m.isActive)
          return (
            <section key={section.value}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#0D1B2A] dark:text-white">
                <span>{section.emoji}</span>
                {section.label}
              </h2>
              {sectionMenus.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#DDE3EC] py-8 text-center text-sm text-gray-500 dark:border-gray-600">
                  No active menus for {section.label.toLowerCase()}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionMenus.map((menu) => {
                    const visual = MEAL_SESSION_VISUAL[menu.mealType]
                    const preview = menu.ingredients
                      .slice(0, 4)
                      .map((i) => `${i.emoji} ${i.itemName}`)
                      .join(' · ')
                    return (
                      <div
                        key={menu.id}
                        className="rounded-xl border border-white/90 bg-white/65 p-4 dark:border-white/[0.08] dark:bg-white/[0.05]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-3xl">{visual?.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-[#0D1B2A] dark:text-white">{menu.menuName}</p>
                            <p className="text-sm text-[#E8A020]">{menu.sinhalaName}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              Base: {menu.baseStudentCount} students · {menu.ingredients.length}{' '}
                              ingredients
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-400">{preview}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(menu)}
                            className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-xs font-semibold dark:border-gray-600"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(menu)}
                            className="flex-1 rounded-lg border border-red-200 py-2 text-xs font-semibold text-red-600 dark:border-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })}
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
            <label className="mb-2 block text-sm font-bold">Menu name (English)</label>
            <input
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#DDE3EC] px-3 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold">Menu name (Sinhala)</label>
            <input
              value={sinhalaName}
              onChange={(e) => setSinhalaName(e.target.value)}
              placeholder="සිංහල නම"
              className="h-12 w-full rounded-xl border border-[#DDE3EC] px-3 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold">Meal type</label>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMealType(m.value)}
                  className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl border-2 ${
                    mealType === m.value
                      ? 'border-[#E8A020] bg-[#E8A020]/15'
                      : 'border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-900'
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-xs font-semibold">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold">Base student count</label>
            <CountStepper value={baseCount} onChange={setBaseCount} min={1} />
            <p className="mt-1 text-xs text-gray-500">
              Quantities below are for {baseStudentCount} students
            </p>
          </div>
          <IngredientGrid
            inventoryItems={inventory}
            selected={selected}
            onChange={setSelected}
            sinhala={sinhala}
            baseStudentCount={baseStudentCount}
            labelQuantitiesFor={baseStudentCount}
          />
        </div>
      </KitchenBottomSheet>
    </div>
  )
}
