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
import { templateToSelected } from '@/lib/kitchen/mealLogHelpers'
import type {
  InventoryItem,
  MealTemplate,
  MealType,
  SelectedIngredient,
} from '@/types/kitchen'

interface MealTemplateSelectorProps {
  mealType: MealType
  inventory: InventoryItem[]
  selected: SelectedIngredient[]
  onChange: (selected: SelectedIngredient[]) => void
  userId: string
  location?: string
  appliedTemplateId: string | null
  onTemplateApplied: (id: string | null, name?: string) => void
  onToast: (msg: string) => void
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
    location: String(data.location ?? 'Ahangama'),
    usageCount: Number(data.usageCount ?? 0),
  }
}

export default function MealTemplateSelector({
  mealType,
  inventory,
  selected,
  onChange,
  userId,
  location = 'Ahangama',
  appliedTemplateId,
  onTemplateApplied,
  onToast,
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
          ),
        )
        setTemplates(
          snap.docs
            .map((d) => parseTemplate(d.id, d.data() as Record<string, unknown>))
            .sort((a, b) => b.usageCount - a.usageCount),
        )
      } catch (err) {
        console.error('[MealTemplateSelector]', err)
        setTemplates([])
      }
    }
    void load()
  }, [mealType])

  async function saveTemplate() {
    if (!nameEn.trim() || selected.length === 0) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'mealTemplates'), {
        name: nameEn.trim(),
        sinhalaName: nameSi.trim(),
        mealType,
        ingredients: selected.map((s) => ({
          itemId: s.itemId,
          itemName: s.itemName,
          emoji: s.emoji,
          qty: s.qty,
          unit: s.unit,
          unitCost: s.unitCost,
        })),
        location,
        usageCount: 0,
        createdBy: userId,
        createdAt: serverTimestamp(),
      })
      onToast('Template saved! ✅')
      setSaveOpen(false)
      setNameEn('')
      setNameSi('')
      const snap = await getDocs(
        query(collection(db, 'mealTemplates'), where('mealType', '==', mealType)),
      )
      setTemplates(
        snap.docs
          .map((d) => parseTemplate(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.usageCount - a.usageCount),
      )
    } catch (err) {
      console.error('[saveTemplate]', err)
      onToast('Could not save template')
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
          <div className="flex gap-3 overflow-x-auto pb-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onChange(templateToSelected(t, inventory))
                  onTemplateApplied(t.id, t.name)
                }}
                className={`min-w-[160px] shrink-0 rounded-xl border p-3 text-left ${
                  appliedTemplateId === t.id
                    ? 'border-[#E8A020] bg-[#E8A020]/10'
                    : 'border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-900'
                }`}
              >
                <span className="text-2xl">{t.ingredients[0]?.emoji ?? '🍽️'}</span>
                <p className="mt-1 text-sm font-bold text-[#0D1B2A] dark:text-white">{t.name}</p>
                <p className="text-xs text-[#E8A020]">{t.sinhalaName}</p>
                <p className="mt-1 text-[10px] text-gray-500">
                  {t.ingredients.length} ingredients · Used {t.usageCount} times
                </p>
              </button>
            ))}
          </div>
          {appliedTemplateId && (
            <button
              type="button"
              onClick={() => {
                onChange([])
                onTemplateApplied(null)
              }}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-[#0d1a2e]">
            <h4 className="font-bold text-[#0D1B2A] dark:text-white">Save as Template</h4>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Template name (English)"
              className="mt-3 h-11 w-full rounded-lg border border-[#DDE3EC] px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <input
              value={nameSi}
              onChange={(e) => setNameSi(e.target.value)}
              placeholder="සිංහල නම ඇතුළත් කරන්න"
              className="mt-2 h-11 w-full rounded-lg border border-[#DDE3EC] px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <p className="mt-2 text-xs text-gray-500 capitalize">Meal type: {mealType}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                className="flex-1 rounded-lg border py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !nameEn.trim()}
                onClick={() => void saveTemplate()}
                className="flex-1 rounded-lg bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
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
