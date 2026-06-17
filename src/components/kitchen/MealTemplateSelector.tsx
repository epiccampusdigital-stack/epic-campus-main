'use client'

import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  selectedToTemplateIngredients,
  templateToSelected,
} from '@/lib/kitchen/ingredientSelection'
import type {
  InventoryItem,
  MealTemplate,
  MealType,
  SelectedIngredient,
} from '@/types/kitchen'

const KITCHEN_LOCATION = 'Ahangama'

interface MealTemplateSelectorProps {
  mealType: MealType
  inventory: InventoryItem[]
  selected: SelectedIngredient[]
  onApply: (ingredients: SelectedIngredient[], templateId: string | null) => void
  appliedTemplateId: string | null
  userId: string
  onSaved?: () => void
}

function parseTemplate(id: string, data: Record<string, unknown>): MealTemplate {
  return {
    id,
    name: String(data.name ?? ''),
    sinhalaName: String(data.sinhalaName ?? ''),
    mealType: data.mealType as MealType,
    ingredients: Array.isArray(data.ingredients) ? (data.ingredients as MealTemplate['ingredients']) : [],
    createdAt: data.createdAt as MealTemplate['createdAt'],
    createdBy: String(data.createdBy ?? ''),
    location: String(data.location ?? KITCHEN_LOCATION),
    usageCount: Number(data.usageCount ?? 0),
  }
}

export default function MealTemplateSelector({
  mealType,
  inventory,
  selected,
  onApply,
  appliedTemplateId,
  userId,
  onSaved,
}: MealTemplateSelectorProps) {
  const [templates, setTemplates] = useState<MealTemplate[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [nameEn, setNameEn] = useState('')
  const [nameSi, setNameSi] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'mealTemplates'),
            where('mealType', '==', mealType),
            where('location', '==', KITCHEN_LOCATION),
          ),
        )
        setTemplates(
          snap.docs
            .map((d) => parseTemplate(d.id, d.data() as Record<string, unknown>))
            .sort((a, b) => b.usageCount - a.usageCount),
        )
      } catch {
        const snap = await getDocs(collection(db, 'mealTemplates'))
        setTemplates(
          snap.docs
            .map((d) => parseTemplate(d.id, d.data() as Record<string, unknown>))
            .filter((t) => t.mealType === mealType)
            .sort((a, b) => b.usageCount - a.usageCount),
        )
      }
    }
    void load()
  }, [mealType, onSaved])

  async function handleSaveTemplate() {
    if (!nameEn.trim() || selected.length === 0) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'mealTemplates'), {
        name: nameEn.trim(),
        sinhalaName: nameSi.trim(),
        mealType,
        ingredients: selectedToTemplateIngredients(selected),
        location: KITCHEN_LOCATION,
        usageCount: 0,
        createdBy: userId,
        createdAt: serverTimestamp(),
      })
      setSaveOpen(false)
      setNameEn('')
      setNameSi('')
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  if (templates.length === 0 && selected.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {templates.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-[#0D1B2A] dark:text-white">
            Use a saved template?
          </p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  const items = t.ingredients
                    .map((ing) => templateToSelected(ing, inventory))
                    .filter((x): x is SelectedIngredient => x !== null)
                  onApply(items, t.id)
                }}
                className={`min-w-[160px] shrink-0 rounded-xl border p-3 text-left ${
                  appliedTemplateId === t.id
                    ? 'border-[#E8A020] bg-[#E8A020]/10'
                    : 'border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-900'
                }`}
              >
                <p className="text-2xl">{t.ingredients[0]?.emoji ?? '🍽️'}</p>
                <p className="mt-1 text-sm font-bold text-[#0D1B2A] dark:text-white">{t.name}</p>
                {t.sinhalaName && (
                  <p className="text-xs text-[#E8A020]">{t.sinhalaName}</p>
                )}
                <p className="mt-1 text-[10px] text-gray-500">
                  {t.ingredients.length} ingredients · Used {t.usageCount} times
                </p>
              </button>
            ))}
          </div>
          {appliedTemplateId && (
            <button
              type="button"
              onClick={() => onApply([], null)}
              className="mt-2 text-xs font-semibold text-[#5A6A7A] underline"
            >
              Clear template
            </button>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => setSaveOpen(true)}
          className="text-sm font-semibold text-[#0B3D6B] underline dark:text-[#E8A020]"
        >
          Save as Template
        </button>
      )}

      {saveOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="font-bold text-[#0B3D6B] dark:text-white">Save as Template</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Template name (English)</label>
                <input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-[#DDE3EC] px-3 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Template name (Sinhala)</label>
                <input
                  value={nameSi}
                  onChange={(e) => setNameSi(e.target.value)}
                  placeholder="සිංහල නම ඇතුළත් කරන්න"
                  className="min-h-[44px] w-full rounded-lg border border-[#DDE3EC] px-3 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <p className="text-xs text-gray-500">Meal type: {mealType}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                className="min-h-[44px] flex-1 rounded-lg border border-[#DDE3EC] text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!nameEn.trim() || saving}
                onClick={() => void handleSaveTemplate()}
                className="min-h-[44px] flex-1 rounded-lg bg-[#E8A020] text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
