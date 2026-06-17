'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import MealLogWizard from '@/components/kitchen/MealLogWizard'
import { fetchActiveInventory } from '@/lib/kitchen/fetchActiveInventory'
import { MEAL_SESSION_VISUAL } from '@/lib/kitchen/foodImages'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { MealLog, MealType, InventoryItem } from '@/types/kitchen'

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'tea', label: 'Tea' },
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizeMealDate(date: unknown): string {
  if (!date) return ''
  if (typeof date === 'string') return date.slice(0, 10)
  if (typeof date === 'object' && date !== null && 'toDate' in date) {
    const toDate = (date as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') {
      return toDate.call(date).toISOString().slice(0, 10)
    }
  }
  if (typeof date === 'object' && date !== null && 'seconds' in date) {
    return new Date((date as { seconds: number }).seconds * 1000).toISOString().slice(0, 10)
  }
  return String(date).slice(0, 10)
}

function parseMealLog(id: string, data: Record<string, unknown>): MealLog {
  return {
    id,
    date: normalizeMealDate(data.date),
    mealType: data.mealType as MealType,
    studentCount: Number(data.studentCount ?? 0),
    staffCount: Number(data.staffCount ?? 0),
    totalServings: Number(data.totalServings ?? 0),
    ingredientsUsed: Array.isArray(data.ingredientsUsed)
      ? (data.ingredientsUsed as MealLog['ingredientsUsed'])
      : [],
    estimatedCost: Number(data.estimatedCost ?? 0),
    costPerPerson: Number(data.costPerPerson ?? 0),
    notes: String(data.notes ?? ''),
    loggedBy: String(data.loggedBy ?? ''),
    loggedByName: String(data.loggedByName ?? ''),
    createdAt: data.createdAt as MealLog['createdAt'],
    dailyMenuId: data.dailyMenuId ? String(data.dailyMenuId) : undefined,
    dailyMenuName: data.dailyMenuName ? String(data.dailyMenuName) : undefined,
    dailyMenuSinhalaName: data.dailyMenuSinhalaName ? String(data.dailyMenuSinhalaName) : undefined,
    mealTemplateId: data.mealTemplateId ? String(data.mealTemplateId) : undefined,
    mealTemplateName: data.mealTemplateName ? String(data.mealTemplateName) : undefined,
  }
}

export default function MealLogPage() {
  const { user } = useKitchen()
  const [logs, setLogs] = useState<MealLog[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(today())
  const [typeFilter, setTypeFilter] = useState<MealType | 'all'>('all')
  const [showWizard, setShowWizard] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [toast, setToast] = useState('')
  const [toastKind, setToastKind] = useState<'success' | 'warning'>('success')

  async function loadLogs() {
    setLoading(true)
    try {
      let snap
      try {
        snap = await getDocs(
          query(collection(db, 'mealLogs'), orderBy('createdAt', 'desc'), limit(50)),
        )
      } catch (err) {
        console.warn('[MealLog] indexed query failed, falling back', err)
        const allSnap = await getDocs(collection(db, 'mealLogs'))
        const docs = allSnap.docs
          .map((d) => ({ doc: d, createdAt: d.data().createdAt }))
          .sort((a, b) => {
            const aSec =
              a.createdAt && typeof a.createdAt === 'object' && 'seconds' in a.createdAt
                ? (a.createdAt as { seconds: number }).seconds
                : 0
            const bSec =
              b.createdAt && typeof b.createdAt === 'object' && 'seconds' in b.createdAt
                ? (b.createdAt as { seconds: number }).seconds
                : 0
            return bSec - aSec
          })
          .slice(0, 50)
          .map((x) => x.doc)
        snap = { docs } as typeof allSnap
      }

      setLogs(
        snap.docs.map((d) => parseMealLog(d.id, d.data() as Record<string, unknown>)),
      )
    } catch (err) {
      console.error('[MealLog]', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadInventory() {
    try {
      setInventoryItems(await fetchActiveInventory())
    } catch (err) {
      console.error('[MealLog inventory]', err)
    }
  }

  useEffect(() => {
    void loadLogs()
    void loadInventory()
  }, [])

  function showToast(msg: string, kind: 'success' | 'warning' = 'success') {
    setToastKind(kind)
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  function openWizard() {
    void loadInventory()
    setShowWizard(true)
  }

  const filtered = logs.filter((l) => {
    const matchDate = !dateFilter || l.date === dateFilter
    const matchType = typeFilter === 'all' || l.mealType === typeFilter
    return matchDate && matchType
  })

  return (
    <div className="space-y-4 md:space-y-6">
      {toast && (
        <div
          className={`fixed bottom-24 right-4 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-6 ${
            toastKind === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'
          }`}
        >
          {toast}
        </div>
      )}

      <div className="space-y-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Meal Log</h1>
        <button
          type="button"
          onClick={openWizard}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] text-base font-bold text-white hover:bg-[#d4911c] md:w-auto md:px-6"
        >
          <span className="ti ti-plus" /> Log New Meal
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="min-h-[48px] w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:w-auto"
        />
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:overflow-visible">
          {(['all', ...MEAL_TYPES.map((m) => m.value)] as (MealType | 'all')[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`min-h-[44px] shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                typeFilter === t
                  ? 'bg-[#0B3D6B] text-white'
                  : 'border border-[#DDE3EC] bg-white text-[#5A6A7A] dark:border-gray-600 dark:bg-gray-900 dark:text-white/60'
              }`}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/90 bg-white/65 py-16 text-center dark:border-white/[0.08] dark:bg-white/[0.05]">
          <span className="text-4xl">🍽️</span>
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/40">No meal logs for this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => {
            const visual = MEAL_SESSION_VISUAL[log.mealType]
            const expanded = expandedId === log.id
            return (
              <div
                key={log.id}
                className="rounded-xl border border-white/90 bg-white/65 dark:border-white/[0.08] dark:bg-white/[0.05]"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span className="text-3xl">{visual?.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold capitalize text-[#0D1B2A] dark:text-white">
                      {log.mealType}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{log.date}</p>
                    {log.dailyMenuName && (
                      <p className="text-xs text-[#E8A020]">📋 {log.dailyMenuName}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">
                      {log.studentCount + log.staffCount} served
                    </p>
                    <p className="text-sm font-bold text-[#E8A020]">
                      {formatLKR(log.estimatedCost)}
                    </p>
                  </div>
                  <span className={`ti ti-chevron-${expanded ? 'up' : 'down'} text-gray-400`} />
                </button>
                {expanded && (
                  <div className="border-t border-[#DDE3EC] px-4 py-3 text-sm dark:border-white/[0.06]">
                    <p className="text-gray-600 dark:text-gray-400">
                      {log.studentCount} students · {log.staffCount} staff
                    </p>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      {formatLKR(log.costPerPerson)} per person
                    </p>
                    {log.ingredientsUsed?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {log.ingredientsUsed.map((ing, i) => (
                          <li key={i} className="text-gray-600 dark:text-gray-400">
                            {ing.itemName}: {ing.qtyUsed} {ing.unit}
                          </li>
                        ))}
                      </ul>
                    )}
                    {log.notes && (
                      <p className="mt-2 text-gray-500 dark:text-gray-500">Notes: {log.notes}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">By {log.loggedByName}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <MealLogWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        inventory={inventoryItems}
        existingLogs={logs}
        userId={user?.uid ?? ''}
        userName={user?.displayName ?? ''}
        onSaved={() => {
          void loadLogs()
          void loadInventory()
        }}
        onToast={showToast}
      />
    </div>
  )
}
