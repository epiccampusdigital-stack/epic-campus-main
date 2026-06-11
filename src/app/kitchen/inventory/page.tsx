'use client'

import { useEffect, useRef, useState } from 'react'
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { InventoryCategory, InventoryItem, StockUnit } from '@/types/kitchen'

const CATEGORIES: InventoryCategory[] = [
  'grains', 'protein', 'vegetables', 'dairy', 'condiments', 'beverages', 'other',
]

const UNITS: StockUnit[] = ['kg', 'litres', 'units', 'grams']

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
  action: string
  qty: number
  reason: string
  date: string
  by: string
  byName: string
  createdAt: Timestamp
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

interface FormValues {
  itemName: string
  category: InventoryCategory
  unit: StockUnit
  currentStock: string
  minStockLevel: string
  unitCost: string
  notes: string
}

const EMPTY_FORM: FormValues = {
  itemName: '',
  category: 'grains',
  unit: 'kg',
  currentStock: '',
  minStockLevel: '',
  unitCost: '',
  notes: '',
}

export default function InventoryPage() {
  const { user } = useKitchen()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<InventoryCategory | ''>('')
  const [slideMode, setSlideMode] = useState<SlideMode>(null)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
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
    try {
      const allHistory: StockHistoryEntry[] = []
      for (const item of items.slice(0, 5)) {
        const snap = await getDocs(
          query(
            collection(db, 'inventory', item.id, 'history'),
            orderBy('createdAt', 'desc'),
          ),
        )
        snap.docs.forEach((d) => allHistory.push({ id: d.id, ...d.data() } as StockHistoryEntry))
      }
      setHistory(allHistory.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds).slice(0, 20))
    } catch {}
  }

  useEffect(() => { loadItems() }, [])
  useEffect(() => { if (!loading && items.length > 0) loadHistory() }, [loading])

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
      notes: '',
    })
    setSlideMode('edit')
    setMenuOpen(null)
  }

  async function handleSave() {
    if (!form.itemName || !form.currentStock || !form.minStockLevel || !form.unitCost) return
    setSaving(true)
    try {
      const payload = {
        itemName: form.itemName,
        category: form.category,
        unit: form.unit,
        currentStock: Number(form.currentStock),
        minStockLevel: Number(form.minStockLevel),
        unitCost: Number(form.unitCost),
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
          qty: Number(form.currentStock),
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Inventory</h1>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d4911c]"
        >
          <span className="ti ti-plus" /> Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full rounded-lg border border-[#DDE3EC] bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as InventoryCategory | '')}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
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
                      <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">
                        {item.itemName}
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
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>
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
                                onClick={() => { setRestockItem(item); setMenuOpen(null) }}
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

      {/* Stock History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <div className="border-b border-[#DDE3EC] px-5 py-4 dark:border-white/[0.06]">
            <h2 className="text-sm font-bold text-[#0D1B2A] dark:text-white">Recent Stock Changes</h2>
          </div>
          <div className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
            {history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <span className={`font-medium ${h.action === 'restocked' ? 'text-emerald-600' : 'text-[#0D1B2A] dark:text-white'}`}>
                    {h.action === 'restocked' ? '+' : '–'}{h.qty}
                  </span>
                  <span className="ml-2 text-[#5A6A7A] dark:text-white/50">{h.reason}</span>
                </div>
                <div className="text-xs text-[#5A6A7A] dark:text-white/40">
                  {h.byName} · {h.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Slide-over */}
      {slideMode && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setSlideMode(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white/90 backdrop-blur-2xl dark:bg-[#0d1a2e]/90 sm:w-[440px]">
            <div className="flex items-center justify-between border-b border-white/80 bg-white/70 px-5 py-4 dark:border-white/[0.06] dark:bg-white/[0.04]">
              <h3 className="font-semibold text-[#0D1B2A] dark:text-white">
                {slideMode === 'add' ? 'Add Inventory Item' : 'Edit Item'}
              </h3>
              <button type="button" onClick={() => setSlideMode(null)} className="ti ti-x text-xl text-gray-500" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 p-5">
              {([
                ['itemName', 'Item Name', 'text'],
                ['currentStock', 'Current Stock', 'number'],
                ['minStockLevel', 'Min Stock Level', 'number'],
                ['unitCost', 'Unit Cost (LKR)', 'number'],
              ] as [keyof FormValues, string, string][]).map(([key, label, type]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/60">{label} *</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/60">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as InventoryCategory }))}
                  className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/60">Unit *</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as StockUnit }))}
                  className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/60">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t border-white/80 p-5 dark:border-white/[0.06]">
              <button type="button" onClick={() => setSlideMode(null)} className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-sm font-medium text-[#5A6A7A]">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-[#E8A020] py-2 text-sm font-semibold text-white hover:bg-[#d4911c] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Restock Modal */}
      {restockItem && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setRestockItem(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/80 bg-white/90 p-6 backdrop-blur-2xl shadow-2xl dark:border-white/[0.08] dark:bg-[#0d1a2e]/90">
            <h3 className="font-bold text-[#0D1B2A] dark:text-white">Restock — {restockItem.itemName}</h3>
            <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
              Current: {restockItem.currentStock} {restockItem.unit}
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Quantity to Add ({restockItem.unit})</label>
              <input
                type="number"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setRestockItem(null)} className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-sm font-medium text-[#5A6A7A]">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestock}
                disabled={saving}
                className="flex-1 rounded-lg bg-[#0B3D6B] py-2 text-sm font-semibold text-white hover:bg-[#0a3460] disabled:opacity-50"
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
