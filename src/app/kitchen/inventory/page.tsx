'use client'

import { useEffect, useRef, useState } from 'react'
import {
  collection,
  collectionGroup,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import InventoryGridCard from '@/components/kitchen/inventory/InventoryGridCard'
import InventoryItemSlideOver, {
  type InventoryFormValues,
} from '@/components/kitchen/inventory/InventoryItemSlideOver'
import FoodEmoji from '@/components/kitchen/FoodEmoji'
import { CATEGORY_PILLS, getFoodEmoji } from '@/lib/kitchen/foodImages'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { InventoryCategory, InventoryItem } from '@/types/kitchen'

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  grains: 'Grains & Rice',
  protein: 'Protein',
  vegetables: 'Vegetables',
  dairy: 'Dairy',
  condiments: 'Condiments & Spices',
  beverages: 'Beverages',
  other: 'Other',
}

const SEED_DATA = [
  { itemName: 'Rice', category: 'grains', unit: 'kg', currentStock: 50, minStockLevel: 10, unitCost: 180 },
  { itemName: 'Dhal', category: 'grains', unit: 'kg', currentStock: 20, minStockLevel: 5, unitCost: 280 },
  { itemName: 'Coconut Oil', category: 'condiments', unit: 'litres', currentStock: 10, minStockLevel: 3, unitCost: 450 },
  { itemName: 'Eggs', category: 'protein', unit: 'units', currentStock: 120, minStockLevel: 30, unitCost: 35 },
  { itemName: 'Bread', category: 'grains', unit: 'units', currentStock: 40, minStockLevel: 10, unitCost: 90 },
  { itemName: 'Sugar', category: 'condiments', unit: 'kg', currentStock: 15, minStockLevel: 5, unitCost: 210 },
  { itemName: 'Tea Leaves', category: 'beverages', unit: 'kg', currentStock: 5, minStockLevel: 2, unitCost: 1200 },
  { itemName: 'Milk Powder', category: 'dairy', unit: 'kg', currentStock: 8, minStockLevel: 2, unitCost: 1800 },
  { itemName: 'Onions', category: 'vegetables', unit: 'kg', currentStock: 10, minStockLevel: 3, unitCost: 150 },
  { itemName: 'Tomatoes', category: 'vegetables', unit: 'kg', currentStock: 8, minStockLevel: 3, unitCost: 200 },
  { itemName: 'Potatoes', category: 'vegetables', unit: 'kg', currentStock: 12, minStockLevel: 4, unitCost: 180 },
  { itemName: 'Chicken', category: 'protein', unit: 'kg', currentStock: 15, minStockLevel: 5, unitCost: 1400 },
  { itemName: 'Canned Fish', category: 'protein', unit: 'units', currentStock: 24, minStockLevel: 12, unitCost: 320 },
  { itemName: 'Salt', category: 'condiments', unit: 'kg', currentStock: 3, minStockLevel: 1, unitCost: 120 },
  { itemName: 'Chilli Powder', category: 'condiments', unit: 'kg', currentStock: 2, minStockLevel: 0.5, unitCost: 900 },
]

interface StockHistoryEntry {
  id: string
  itemId?: string
  itemName?: string
  emoji?: string
  unit?: string
  mealType?: string
  action: string
  qty: number
  reason: string
  date: string
  by: string
  byName: string
  createdAt: Timestamp
}

function formatHistoryDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function historyDescription(h: StockHistoryEntry): string {
  const emoji = h.emoji ?? '📦'
  const name = h.itemName ?? 'Item'
  const unit = h.unit ?? ''

  if (h.action === 'deducted' && h.reason === 'meal-log') {
    const meal = h.mealType
      ? h.mealType.charAt(0).toUpperCase() + h.mealType.slice(1)
      : 'meal'
    return `${emoji} ${name} — used ${h.qty} ${unit} for ${meal}`.trim()
  }
  if (h.action === 'restocked') {
    return `${emoji} ${name} — restocked +${h.qty} ${unit}`.trim()
  }
  return `${emoji} ${name} — ${h.action} ${h.qty} ${unit}`.trim()
}

function getStockStatus(item: InventoryItem): { label: string; cls: string } {
  if (item.currentStock <= item.minStockLevel) {
    return { label: 'Critical', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400' }
  }
  if (item.currentStock <= item.minStockLevel * 1.5) {
    return { label: 'Low', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' }
  }
  return { label: 'OK', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' }
}

type SlideMode = 'add' | 'edit' | null

const EMPTY_FORM: InventoryFormValues = {
  itemName: '',
  category: 'grains',
  unit: 'kg',
  currentStock: '',
  minStockLevel: '',
  unitCost: '',
}

export default function InventoryPage() {
  const { user } = useKitchen()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<InventoryCategory | ''>('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [slideMode, setSlideMode] = useState<SlideMode>(null)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<InventoryFormValues>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [history, setHistory] = useState<StockHistoryEntry[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  async function loadItems() {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'inventory'), orderBy('itemName')))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
      if (all.length === 0) {
        await seedInventory()
        const snap2 = await getDocs(query(collection(db, 'inventory'), orderBy('itemName')))
        setItems(snap2.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)))
      } else {
        setItems(all)
      }
    } catch (err) {
      console.error('[Inventory]', err)
    } finally {
      setLoading(false)
    }
  }

  async function seedInventory() {
    for (const item of SEED_DATA) {
      await addDoc(collection(db, 'inventory'), {
        ...item,
        isActive: true,
        lastUpdated: serverTimestamp(),
        updatedBy: user?.uid ?? '',
        updatedByName: user?.displayName ?? '',
      })
    }
  }

  async function loadHistory() {
    if (items.length === 0) return
    try {
      const itemMap = new Map(items.map((i) => [i.id, i]))
      let entries: StockHistoryEntry[] = []

      try {
        const snap = await getDocs(
          query(collectionGroup(db, 'history'), orderBy('createdAt', 'desc'), limit(20)),
        )
        entries = snap.docs.map((d) => {
          const itemId = d.ref.parent.parent?.id ?? ''
          const item = itemMap.get(itemId)
          const data = d.data()
          return {
            id: `${itemId}-${d.id}`,
            itemId,
            itemName: String(data.itemName ?? item?.itemName ?? 'Item'),
            emoji: String(data.emoji ?? getFoodEmoji(item?.itemName ?? '')),
            unit: String(data.unit ?? item?.unit ?? ''),
            mealType: data.mealType ? String(data.mealType) : undefined,
            action: String(data.action ?? ''),
            qty: Number(data.qty ?? 0),
            reason: String(data.reason ?? ''),
            date: String(data.date ?? ''),
            by: String(data.by ?? ''),
            byName: String(data.byName ?? ''),
            createdAt: data.createdAt as Timestamp,
          }
        })
      } catch (err) {
        console.warn('[Inventory history] collectionGroup failed, falling back', err)
        const allHistory: StockHistoryEntry[] = []
        for (const item of items) {
          const snap = await getDocs(
            query(collection(db, 'inventory', item.id, 'history'), orderBy('createdAt', 'desc')),
          )
          snap.docs.slice(0, 5).forEach((d) => {
            const data = d.data()
            allHistory.push({
              id: `${item.id}-${d.id}`,
              itemId: item.id,
              itemName: String(data.itemName ?? item.itemName),
              emoji: String(data.emoji ?? getFoodEmoji(item.itemName)),
              unit: String(data.unit ?? item.unit),
              mealType: data.mealType ? String(data.mealType) : undefined,
              action: String(data.action ?? ''),
              qty: Number(data.qty ?? 0),
              reason: String(data.reason ?? ''),
              date: String(data.date ?? ''),
              by: String(data.by ?? ''),
              byName: String(data.byName ?? ''),
              createdAt: data.createdAt as Timestamp,
            })
          })
        }
        entries = allHistory
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
          .slice(0, 20)
      }

      setHistory(entries)
    } catch (err) {
      console.error('[Inventory history]', err)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])
  useEffect(() => {
    if (!loading && items.length > 0) loadHistory()
  }, [loading, items])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = items.filter((i) => {
    const matchSearch = i.itemName.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || i.category === catFilter
    const isActive = i.isActive !== false
    return matchSearch && matchCat && isActive
  })

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setSlideMode('add')
  }

  function openEdit(item: InventoryItem) {
    setEditItem(item)
    setForm({
      itemName: item.itemName,
      category: item.category,
      unit: item.unit,
      currentStock: String(item.currentStock),
      minStockLevel: String(item.minStockLevel),
      unitCost: String(item.unitCost),
    })
    setSlideMode('edit')
    setMenuOpen(null)
  }

  async function handleSave(values: InventoryFormValues) {
    if (!values.itemName || !values.currentStock || !values.minStockLevel || !values.unitCost) return
    setSaving(true)
    try {
      const payload = {
        itemName: values.itemName,
        category: values.category,
        unit: values.unit,
        currentStock: Number(values.currentStock),
        minStockLevel: Number(values.minStockLevel),
        unitCost: Number(values.unitCost),
        isActive: true,
        lastUpdated: serverTimestamp(),
        updatedBy: user?.uid ?? '',
        updatedByName: user?.displayName ?? '',
      }
      if (slideMode === 'add') {
        await addDoc(collection(db, 'inventory'), payload)
      } else if (editItem) {
        await updateDoc(doc(db, 'inventory', editItem.id), payload)
        await addDoc(collection(db, 'inventory', editItem.id, 'history'), {
          action: 'updated',
          qty: Number(values.currentStock),
          reason: 'manual-edit',
          date: new Date().toISOString().slice(0, 10),
          by: user?.uid ?? '',
          byName: user?.displayName ?? '',
          createdAt: serverTimestamp(),
        })
      }
      setSlideMode(null)
      await loadItems()
    } catch (err) {
      console.error('[Inventory save]', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleRestock() {
    if (!restockItem || !restockQty || Number(restockQty) <= 0) return
    setSaving(true)
    try {
      const newStock = restockItem.currentStock + Number(restockQty)
      await updateDoc(doc(db, 'inventory', restockItem.id), {
        currentStock: newStock,
        lastUpdated: serverTimestamp(),
        updatedBy: user?.uid ?? '',
        updatedByName: user?.displayName ?? '',
      })
      await addDoc(collection(db, 'inventory', restockItem.id, 'history'), {
        action: 'restocked',
        qty: Number(restockQty),
        reason: 'manual-restock',
        date: new Date().toISOString().slice(0, 10),
        by: user?.uid ?? '',
        byName: user?.displayName ?? '',
        createdAt: serverTimestamp(),
      })
      setRestockItem(null)
      setRestockQty('')
      await loadItems()
    } catch (err) {
      console.error('[Restock]', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(item: InventoryItem) {
    await updateDoc(doc(db, 'inventory', item.id), { isActive: false })
    setMenuOpen(null)
    await loadItems()
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] md:text-2xl dark:text-white">Inventory</h1>
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#DDE3EC] bg-white px-4 py-2 text-sm font-medium text-[#5A6A7A] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            {viewMode === 'grid' ? (
              <>
                <span className="ti ti-table" /> Table
              </>
            ) : (
              <>
                <span className="text-lg">🖼️</span> Grid
              </>
            )}
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E8A020] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#d4911c]"
          >
            <span className="ti ti-plus" /> Add Item
          </button>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {CATEGORY_PILLS.map((pill) => (
          <button
            key={pill.id || 'all'}
            type="button"
            onClick={() => setCatFilter(pill.id as InventoryCategory | '')}
            className={`min-h-[40px] shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              catFilter === pill.id
                ? 'bg-[#E8A020] text-white'
                : 'border border-[#DDE3EC] bg-white text-[#0B3D6B] dark:border-gray-600 dark:bg-gray-900 dark:text-white'
            }`}
          >
            {pill.label} {pill.emoji}
          </button>
        ))}
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl">
          🔍
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white py-3 pl-12 pr-4 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </div>

      <button
        type="button"
        onClick={openAdd}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#E8A020] text-2xl font-bold text-white shadow-lg hover:bg-[#d4911c] md:hidden"
        aria-label="Add item"
      >
        +
      </button>

      <div className={viewMode === 'table' ? 'md:hidden' : ''}>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10 md:h-56" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/90 bg-white/65 py-16 text-center dark:border-white/[0.08] dark:bg-white/[0.05]">
            <p className="text-sm text-[#5A6A7A] dark:text-white/40">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
            {filtered.map((item) => (
              <InventoryGridCard
                key={item.id}
                item={item}
                onEdit={() => openEdit(item)}
                onRestock={() => setRestockItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {viewMode === 'table' && (
        <>
        <div className="space-y-3 md:hidden">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
            ))
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/40">No items found</p>
          ) : (
            filtered.map((item) => {
              const status = getStockStatus(item)
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-white/90 bg-white/65 p-4 dark:border-white/[0.08] dark:bg-white/[0.05]"
                  onClick={() => openEdit(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openEdit(item)}
                >
                  <FoodEmoji itemName={item.itemName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-[#0B3D6B] dark:text-white">{item.itemName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.currentStock} {item.unit} · {formatLKR(item.unitCost)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                    {status.label}
                  </span>
                </div>
              )
            })
          )}
        </div>
        <div className="hidden overflow-hidden rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] md:block">
          <div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] text-xs font-medium uppercase text-[#5A6A7A] dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">In Stock</th>
                  <th className="px-4 py-3">Min Level</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                      No items found
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const status = getStockStatus(item)
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FoodEmoji itemName={item.itemName} size="sm" />
                            <span className="font-medium text-[#0D1B2A] dark:text-white">
                              {item.itemName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">
                          {CATEGORY_LABELS[item.category]}
                        </td>
                        <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{item.unit}</td>
                        <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">
                          {item.minStockLevel} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-[#0B3D6B] dark:text-[#E8A020]">
                          {formatLKR(item.unitCost)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative" ref={menuOpen === item.id ? menuRef : null}>
                            <button
                              type="button"
                              onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}
                              className="rounded-lg p-1.5 text-[#5A6A7A] hover:bg-[#0B3D6B]/[0.06] dark:text-white/50 dark:hover:bg-white/[0.05]"
                            >
                              <span className="ti ti-dots-vertical" />
                            </button>
                            {menuOpen === item.id && (
                              <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-xl border border-[#DDE3EC] bg-white py-1 shadow-lg dark:border-white/[0.08] dark:bg-[#0d1a2e]">
                                <button
                                  type="button"
                                  onClick={() => openEdit(item)}
                                  className="block w-full px-4 py-2 text-left text-sm text-[#0D1B2A] hover:bg-[#F5F7FB] dark:text-white dark:hover:bg-white/[0.05]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRestockItem(item)
                                    setMenuOpen(null)
                                  }}
                                  className="block w-full px-4 py-2 text-left text-sm text-[#0D1B2A] hover:bg-[#F5F7FB] dark:text-white dark:hover:bg-white/[0.05]"
                                >
                                  Restock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeactivate(item)}
                                  className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                >
                                  Deactivate
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <div className="border-b border-[#DDE3EC] px-5 py-4 dark:border-white/[0.06]">
            <h2 className="text-sm font-bold text-[#0D1B2A] dark:text-white">Recent Stock Changes</h2>
          </div>
          <div className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
            {history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <p className="font-medium text-[#0D1B2A] dark:text-white">{historyDescription(h)}</p>
                <div className="text-xs text-[#5A6A7A] dark:text-white/40">
                  {h.byName || 'Staff'} · {formatHistoryDate(h.date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {slideMode && (
        <InventoryItemSlideOver
          mode={slideMode}
          initial={form}
          onClose={() => setSlideMode(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {restockItem && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setRestockItem(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/80 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#0d1a2e]/90">
            <div className="flex justify-center">
              <FoodEmoji itemName={restockItem.itemName} size="lg" showName />
            </div>
            <p className="mt-3 text-center text-sm text-[#5A6A7A] dark:text-white/50">
              Current: {restockItem.currentStock} {restockItem.unit}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const n = Math.max(0, (parseFloat(restockQty) || 0) - 1)
                  setRestockQty(n > 0 ? String(n) : '')
                }}
                className="flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-bold"
              >
                −
              </button>
              <input
                type="number"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                placeholder="Quantity to add"
                className="h-12 flex-1 rounded-xl border border-[#DDE3EC] bg-white text-center text-lg font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setRestockQty(String((parseFloat(restockQty) || 0) + 1))}
                className="flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-bold"
              >
                +
              </button>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setRestockItem(null)}
                className="flex-1 rounded-xl border border-[#DDE3EC] py-3 text-sm font-medium text-[#5A6A7A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestock}
                disabled={saving}
                className="flex-1 rounded-xl bg-[#0B3D6B] py-3 text-sm font-bold text-white hover:bg-[#0a3460] disabled:opacity-50"
              >
                {saving ? 'Adding…' : 'Add Stock'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
