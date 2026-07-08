'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  addDoc as addHistory,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { writeStockLog } from '@/lib/kitchen/stockLog'
import type {
  SupplyItem,
  SuppliesCategory,
  SupplyUnit,
  StationerySubcategory,
  FirstAidSubcategory,
} from '@/types/supplies'

const STATIONERY_ITEMS = [
  { name: 'Pens', emoji: '🖊️', sub: 'writing' },
  { name: 'Pencils', emoji: '✏️', sub: 'writing' },
  { name: 'Markers', emoji: '🖊️', sub: 'writing' },
  { name: 'Whiteboard Markers', emoji: '🖊️', sub: 'writing' },
  { name: 'A4 Paper', emoji: '📄', sub: 'paper' },
  { name: 'Notebooks', emoji: '📓', sub: 'paper' },
  { name: 'Files', emoji: '📁', sub: 'filing' },
  { name: 'Folders', emoji: '📂', sub: 'filing' },
  { name: 'Staplers', emoji: '📎', sub: 'filing' },
  { name: 'Staples', emoji: '📎', sub: 'filing' },
  { name: 'Scissors', emoji: '✂️', sub: 'filing' },
  { name: 'Tape', emoji: '🏷️', sub: 'filing' },
  { name: 'Printer Ink', emoji: '🖨️', sub: 'printing' },
  { name: 'Toner', emoji: '🖨️', sub: 'printing' },
  { name: 'Rubber Bands', emoji: '🔵', sub: 'other_stationery' },
  { name: 'Glue', emoji: '🟡', sub: 'other_stationery' },
] as const

const FIRST_AID_ITEMS = [
  { name: 'Paracetamol', emoji: '💊', sub: 'medicines' },
  { name: 'Antacid', emoji: '💊', sub: 'medicines' },
  { name: 'Antiseptic Cream', emoji: '🧴', sub: 'medicines' },
  { name: 'Pain Relief Spray', emoji: '🧴', sub: 'medicines' },
  { name: 'Bandages', emoji: '🩹', sub: 'bandages' },
  { name: 'Gauze', emoji: '🩹', sub: 'bandages' },
  { name: 'Cotton Wool', emoji: '☁️', sub: 'bandages' },
  { name: 'Plasters', emoji: '🩹', sub: 'bandages' },
  { name: 'Hand Sanitizer', emoji: '🧴', sub: 'sanitization' },
  { name: 'Disinfectant', emoji: '🧴', sub: 'sanitization' },
  { name: 'Face Masks', emoji: '😷', sub: 'sanitization' },
  { name: 'Gloves', emoji: '🧤', sub: 'sanitization' },
  { name: 'Thermometer', emoji: '🌡️', sub: 'equipment' },
  { name: 'Scissors (Medical)', emoji: '✂️', sub: 'equipment' },
  { name: 'First Aid Box', emoji: '🏥', sub: 'equipment' },
] as const

const SUPPLY_UNITS: {
  value: SupplyUnit
  label: string
}[] = [
  { value: 'units', label: 'Units' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'packets', label: 'Packets' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'reams', label: 'Reams' },
]

const STATIONERY_SUBS: { id: StationerySubcategory; label: string }[] = [
  { id: 'writing', label: 'Writing' },
  { id: 'paper', label: 'Paper' },
  { id: 'filing', label: 'Filing' },
  { id: 'printing', label: 'Printing' },
  { id: 'other_stationery', label: 'Other' },
]

const FIRST_AID_SUBS: { id: FirstAidSubcategory; label: string }[] = [
  { id: 'medicines', label: 'Medicines' },
  { id: 'bandages', label: 'Bandages' },
  { id: 'sanitization', label: 'Sanitization' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'other_firstaid', label: 'Other' },
]

const ALLOWED_ROLES = ['admin', 'owner', 'accountant', 'reception', 'teacher'] as const

export default function SuppliesPage() {
  const { user, hasRole } = useManagement()

  if (user && !ALLOWED_ROLES.some((r) => hasRole(r))) {
    return <div className="p-8 text-center text-[#5A6A7A]">You do not have access to this page.</div>
  }

  const canWrite = user?.roles?.some((r) => r !== 'teacher') ?? false

  const [items, setItems] = useState<SupplyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SuppliesCategory>('stationery')
  const [subFilter, setSubFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<SupplyItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    itemName: string
    category: SuppliesCategory
    subcategory: StationerySubcategory | FirstAidSubcategory
    unit: SupplyUnit
    currentStock: string
    minStockLevel: string
    unitCost: string
    notes: string
    expiryDate: string
  }>({
    itemName: '',
    category: 'stationery',
    subcategory: 'writing',
    unit: 'units',
    currentStock: '',
    minStockLevel: '',
    unitCost: '',
    notes: '',
    expiryDate: '',
  })

  const [restockItem, setRestockItem] = useState<SupplyItem | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockBrand, setRestockBrand] = useState('')
  const [restockSupplier, setRestockSupplier] = useState('')
  const [restockInvoice, setRestockInvoice] = useState('')
  const [restockNotes, setRestockNotes] = useState('')

  const [removeItem, setRemoveItem] = useState<SupplyItem | null>(null)
  const [removeQty, setRemoveQty] = useState('')
  const [removeReason, setRemoveReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'supplies'), orderBy('itemName', 'asc'))).catch(
        () => ({ docs: [] as Array<{ id: string; data: () => unknown }> }),
      )
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupplyItem, 'id'>),
        })) as SupplyItem[],
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave() {
    if (!form.itemName || !form.currentStock) return
    setSaving(true)
    try {
      const data = {
        itemName: form.itemName.trim(),
        category: form.category,
        subcategory: form.subcategory,
        unit: form.unit,
        currentStock: Number(form.currentStock),
        minStockLevel: Number(form.minStockLevel) || 0,
        unitCost: Number(form.unitCost) || 0,
        notes: form.notes.trim(),
        expiryDate: form.expiryDate || null,
        isActive: true,
        updatedBy: user?.uid ?? '',
        updatedByName: user?.displayName ?? '',
        lastUpdated: serverTimestamp(),
      }
      const newStockNum = Number(form.currentStock)
      if (editItem) {
        await updateDoc(doc(db, 'supplies', editItem.id), data)
        if (newStockNum !== editItem.currentStock) {
          await writeStockLog({
            itemId: editItem.id,
            itemName: data.itemName,
            changeType: 'adjust',
            previousQty: editItem.currentStock,
            newQty: newStockNum,
            unit: data.unit,
            changedBy: user?.uid ?? '',
            changedByName: user?.displayName ?? 'Staff',
            source: 'supplies',
          })
        }
      } else {
        const ref = await addDoc(collection(db, 'supplies'), data)
        await writeStockLog({
          itemId: ref.id,
          itemName: data.itemName,
          changeType: 'add',
          previousQty: 0,
          newQty: newStockNum,
          unit: data.unit,
          changedBy: user?.uid ?? '',
          changedByName: user?.displayName ?? 'Staff',
          source: 'supplies',
        })
      }
      setModalOpen(false)
      setEditItem(null)
      void load()
    } finally {
      setSaving(false)
    }
  }

  async function handleRestock() {
    if (!restockItem || !restockQty || Number(restockQty) <= 0) return
    try {
      const qty = Number(restockQty)
      const newStock = restockItem.currentStock + qty
      await updateDoc(doc(db, 'supplies', restockItem.id), {
        currentStock: newStock,
        lastRestockedDate: new Date().toISOString().slice(0, 10),
        lastUpdated: serverTimestamp(),
        updatedBy: user?.uid ?? '',
        updatedByName: user?.displayName ?? '',
      })
      await addHistory(collection(db, 'supplies', restockItem.id, 'history'), {
        action: 'restocked',
        qty,
        reason: 'manual-restock',
        brand: restockBrand.trim(),
        supplier: restockSupplier.trim(),
        invoiceNumber: restockInvoice.trim(),
        notes: restockNotes.trim(),
        date: new Date().toISOString().slice(0, 10),
        by: user?.uid ?? '',
        byName: user?.displayName ?? '',
        createdAt: serverTimestamp(),
      })
      await writeStockLog({
        itemId: restockItem.id,
        itemName: restockItem.itemName,
        changeType: 'add',
        previousQty: restockItem.currentStock,
        newQty: newStock,
        unit: restockItem.unit,
        changedBy: user?.uid ?? '',
        changedByName: user?.displayName ?? 'Staff',
        source: 'supplies',
      })
      setItems((prev) => prev.map((i) => (i.id === restockItem.id ? { ...i, currentStock: newStock } : i)))
      setRestockItem(null)
      setRestockQty('')
      setRestockBrand('')
      setRestockSupplier('')
      setRestockInvoice('')
      setRestockNotes('')
    } catch (err) {
      console.error('[Restock]', err)
    }
  }

  async function handleRemove() {
    if (!removeItem || !removeQty || Number(removeQty) <= 0) return
    try {
      const qty = Number(removeQty)
      const newStock = Math.max(0, removeItem.currentStock - qty)
      await updateDoc(doc(db, 'supplies', removeItem.id), {
        currentStock: newStock,
        lastUpdated: serverTimestamp(),
        updatedBy: user?.uid ?? '',
        updatedByName: user?.displayName ?? '',
      })
      await addDoc(collection(db, 'supplies', removeItem.id, 'history'), {
        action: 'removed',
        qty,
        reason: removeReason.trim() || 'manual-remove',
        date: new Date().toISOString().slice(0, 10),
        by: user?.uid ?? '',
        byName: user?.displayName ?? '',
        createdAt: serverTimestamp(),
      })
      await writeStockLog({
        itemId: removeItem.id,
        itemName: removeItem.itemName,
        changeType: 'remove',
        previousQty: removeItem.currentStock,
        newQty: newStock,
        unit: removeItem.unit,
        changedBy: user?.uid ?? '',
        changedByName: user?.displayName ?? 'Staff',
        source: 'supplies',
      })
      setItems((prev) => prev.map((i) => (i.id === removeItem.id ? { ...i, currentStock: newStock } : i)))
      setRemoveItem(null)
      setRemoveQty('')
      setRemoveReason('')
    } catch (err) {
      console.error('[Remove]', err)
    }
  }

  const filtered = items.filter((item) => {
    if (item.category !== activeTab) return false
    if (subFilter !== 'all' && item.subcategory !== subFilter) return false
    if (searchQuery.trim() && !item.itemName.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const lowStockCount = items.filter((i) => i.currentStock <= i.minStockLevel && i.currentStock > 0).length
  const outOfStockCount = items.filter((i) => i.currentStock <= 0).length
  const totalValue = items.reduce((sum, i) => sum + i.currentStock * i.unitCost, 0)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Add to Firestore rules:
      match /supplies/{itemId} {
        allow read: if request.auth != null &&
          request.auth.token.role in
          ['admin','owner','accountant','reception','teacher'];
        allow write: if request.auth != null &&
          request.auth.token.role in
          ['admin','owner','accountant','reception'];
        match /history/{hId} {
          allow read, write: if request.auth != null &&
            request.auth.token.role in
            ['admin','owner','accountant','reception'];
        }
      }
      */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">Supplies</h1>
          <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">Stationery and First Aid inventory</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setEditItem(null)
              setForm({
                itemName: '',
                category: activeTab,
                subcategory: activeTab === 'stationery' ? 'writing' : 'medicines',
                unit: 'units',
                currentStock: '',
                minStockLevel: '',
                unitCost: '',
                notes: '',
                expiryDate: '',
              })
              setModalOpen(true)
            }}
            className="rounded-xl bg-[#E8A020] px-5 py-2.5 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c]"
          >
            + Add Item
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Items', value: items.length, color: 'text-[#0B3D6B]' },
          {
            label: 'Low Stock',
            value: lowStockCount,
            color: lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600',
          },
          {
            label: 'Out of Stock',
            value: outOfStockCount,
            color: outOfStockCount > 0 ? 'text-red-600' : 'text-emerald-600',
          },
          { label: 'Total Value', value: formatLKR(totalValue), color: 'text-[#E8A020]' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#DDE3EC] bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.04]"
          >
            <p className="text-sm text-[#5A6A7A] dark:text-white/50">{card.label}</p>
            <p className={`mt-1 font-jakarta text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-[#DDE3EC] dark:border-white/[0.08]">
        {[
          { id: 'stationery', label: '✏️ Stationery' },
          { id: 'first_aid', label: '🩹 First Aid' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id as SuppliesCategory)
              setSubFilter('all')
            }}
            className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'border-[#E8A020] text-[#0B3D6B] dark:text-[#E8A020]'
                : 'border-transparent text-[#5A6A7A] hover:text-[#0B3D6B]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ id: 'all', label: 'All' }, ...(activeTab === 'stationery' ? STATIONERY_SUBS : FIRST_AID_SUBS)].map(
          (sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSubFilter(sub.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                subFilter === sub.id
                  ? 'bg-[#0B3D6B] text-white dark:bg-[#E8A020] dark:text-[#0B3D6B]'
                  : 'border border-[#DDE3EC] text-[#5A6A7A] dark:border-white/[0.12] dark:text-white/50'
              }`}
            >
              {sub.label}
            </button>
          ),
        )}
      </div>

      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search items..."
        className="w-full max-w-sm rounded-xl border border-[#DDE3EC] bg-white px-4 py-2.5 text-sm text-[#0D1B2A] outline-none placeholder:text-[#5A6A7A] focus:border-[#0B3D6B] dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40 dark:focus:border-[#E8A020]"
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] bg-white py-16 text-center dark:border-white/[0.08] dark:bg-white/[0.04]">
          <p className="text-sm text-[#5A6A7A] dark:text-white/40">
            No items found.
            {canWrite && ' Add your first item.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => {
            const isOut = item.currentStock <= 0
            const isLow = item.currentStock <= item.minStockLevel && !isOut
            const emoji =
              activeTab === 'stationery'
                ? STATIONERY_ITEMS.find((s) => s.name === item.itemName)?.emoji ?? '📦'
                : FIRST_AID_ITEMS.find((f) => f.name === item.itemName)?.emoji ?? '🏥'

            return (
              <div
                key={item.id}
                className={`relative flex flex-col rounded-2xl border-2 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900/50 ${
                  isOut
                    ? 'border-red-400'
                    : isLow
                      ? 'border-[#E8A020]'
                      : 'border-[#DDE3EC] dark:border-gray-600'
                }`}
              >
                {isOut && (
                  <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    OUT
                  </span>
                )}
                {isLow && !isOut && (
                  <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    Low
                  </span>
                )}

                <div className="flex justify-center py-2 text-4xl">{emoji}</div>

                <p className="text-center text-sm font-bold leading-tight text-[#0B3D6B] dark:text-white">
                  {item.itemName}
                </p>

                {item.notes && (
                  <p className="mt-0.5 truncate px-1 text-center text-[10px] text-[#5A6A7A] dark:text-white/40">
                    {item.notes}
                  </p>
                )}

                <div className="mt-2">
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (item.currentStock /
                            Math.max(item.minStockLevel * 2, item.currentStock, 1)) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {item.currentStock} {item.unit}
                  </p>
                </div>

                {item.expiryDate && <p className="mt-0.5 text-center text-[10px] text-amber-600">Exp: {item.expiryDate}</p>}

                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveItem(item)
                        setRemoveQty('')
                        setRemoveReason('')
                      }}
                      className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                    >
                      − Use
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (canWrite) {
                        setRestockItem(item)
                        setRestockQty('')
                        setRestockBrand('')
                        setRestockSupplier('')
                        setRestockInvoice('')
                        setRestockNotes('')
                      }
                    }}
                    className={`flex min-h-[40px] items-center justify-center gap-1 rounded-xl bg-[#0B3D6B] text-xs font-semibold text-white hover:bg-[#0a3460] ${
                      !canWrite ? 'col-span-2 cursor-default opacity-60' : ''
                    }`}
                  >
                    + Restock
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditItem(item)
                        setForm({
                          itemName: item.itemName,
                          category: item.category,
                          subcategory: item.subcategory,
                          unit: item.unit,
                          currentStock: String(item.currentStock),
                          minStockLevel: String(item.minStockLevel),
                          unitCost: String(item.unitCost),
                          notes: item.notes ?? '',
                          expiryDate: item.expiryDate ?? '',
                        })
                        setModalOpen(true)
                      }}
                      className="col-span-2 flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#DDE3EC] text-xs font-medium text-[#5A6A7A] hover:bg-[#F5F7FB] dark:border-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.04]"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
                  {editItem ? 'Edit Item' : 'Add Item'}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="text-xl text-[#5A6A7A] hover:text-[#0B3D6B]"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-[#5A6A7A] dark:text-white/50">Quick pick</p>
                  <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto">
                    {(activeTab === 'stationery' ? STATIONERY_ITEMS : FIRST_AID_ITEMS).map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            itemName: preset.name,
                            category: activeTab,
                            subcategory: preset.sub,
                          }))
                        }
                        className={`flex flex-col items-center rounded-xl border-2 p-2 text-center text-xs transition-all ${
                          form.itemName === preset.name
                            ? 'border-[#E8A020] bg-[#E8A020]/10'
                            : 'border-[#DDE3EC] dark:border-gray-600'
                        }`}
                      >
                        <span className="text-2xl">{preset.emoji}</span>
                        <span className="mt-1 text-[10px] leading-tight text-[#0B3D6B] dark:text-white">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Item Name *</label>
                  <input
                    type="text"
                    value={form.itemName}
                    onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                    className="w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Category</label>
                  <div className="flex gap-2">
                    {(activeTab === 'stationery' ? STATIONERY_SUBS : FIRST_AID_SUBS).map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, subcategory: sub.id }))}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          form.subcategory === sub.id
                            ? 'bg-[#E8A020] text-white'
                            : 'bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-white/60'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Unit</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SUPPLY_UNITS.map((u) => (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, unit: u.value }))}
                        className={`rounded-xl border-2 py-2 text-xs font-semibold ${
                          form.unit === u.value
                            ? 'border-[#E8A020] bg-[#E8A020] text-white'
                            : 'border-[#DDE3EC] dark:border-gray-600 dark:text-white'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Current Stock *</label>
                    <input
                      type="number"
                      min="0"
                      value={form.currentStock}
                      onChange={(e) => setForm((f) => ({ ...f, currentStock: e.target.value }))}
                      className="w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Min Level</label>
                    <input
                      type="number"
                      min="0"
                      value={form.minStockLevel}
                      onChange={(e) => setForm((f) => ({ ...f, minStockLevel: e.target.value }))}
                      className="w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Unit Cost (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.unitCost}
                    onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
                    className="w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Expiry Date (optional)</label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    className="w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    placeholder="Storage instructions, supplier info..."
                    className="w-full resize-none rounded-xl border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-[#DDE3EC] py-2.5 text-sm font-medium text-[#5A6A7A]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !form.itemName || !form.currentStock}
                  className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {restockItem && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setRestockItem(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <h3 className="mb-1 font-jakarta font-bold text-[#0B3D6B] dark:text-white">Restock - {restockItem.itemName}</h3>
            <p className="mb-4 text-xs text-[#5A6A7A]">Current: {restockItem.currentStock} {restockItem.unit}</p>

            <div className="mb-3 grid grid-cols-4 gap-2">
              {[1, 5, 10, 25].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRestockQty(String(n))}
                  className={`min-h-[44px] rounded-xl border-2 text-sm font-bold ${
                    restockQty === String(n)
                      ? 'border-[#0B3D6B] bg-[#0B3D6B] text-white'
                      : 'border-[#DDE3EC] dark:border-gray-600 dark:text-white'
                  }`}
                >
                  +{n}
                </button>
              ))}
            </div>

            <input
              type="number"
              min="0"
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              placeholder="Custom amount"
              className="mb-3 w-full min-h-[44px] rounded-xl border border-[#DDE3EC] px-3 text-center text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />

            <input
              type="text"
              value={restockBrand}
              onChange={(e) => setRestockBrand(e.target.value)}
              placeholder="Brand (optional)"
              className="mb-2 w-full min-h-[44px] rounded-xl border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={restockSupplier}
              onChange={(e) => setRestockSupplier(e.target.value)}
              placeholder="Supplier (optional)"
              className="mb-2 w-full min-h-[44px] rounded-xl border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={restockInvoice}
              onChange={(e) => setRestockInvoice(e.target.value)}
              placeholder="Invoice number (optional)"
              className="mb-2 w-full min-h-[44px] rounded-xl border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={restockNotes}
              onChange={(e) => setRestockNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="mb-4 w-full min-h-[44px] rounded-xl border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRestockItem(null)}
                className="flex-1 min-h-[52px] rounded-xl border-2 border-[#DDE3EC] text-sm font-semibold text-[#5A6A7A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestock}
                disabled={!restockQty || Number(restockQty) <= 0}
                className="flex-1 min-h-[52px] rounded-xl bg-[#0B3D6B] text-sm font-bold text-white hover:bg-[#0a3460] disabled:opacity-50"
              >
                Add {restockQty || '0'} {restockItem.unit}
              </button>
            </div>
          </div>
        </>
      )}

      {removeItem && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setRemoveItem(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <h3 className="mb-1 font-jakarta font-bold text-[#0B3D6B] dark:text-white">Use - {removeItem.itemName}</h3>
            <p className="mb-4 text-xs text-[#5A6A7A]">Current: {removeItem.currentStock} {removeItem.unit}</p>

            <div className="mb-3 grid grid-cols-4 gap-2">
              {[1, 2, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRemoveQty(String(n))}
                  className={`min-h-[44px] rounded-xl border-2 text-sm font-bold ${
                    removeQty === String(n)
                      ? 'border-red-500 bg-red-500 text-white'
                      : 'border-[#DDE3EC] dark:border-gray-600 dark:text-white'
                  }`}
                >
                  -{n}
                </button>
              ))}
            </div>

            <input
              type="number"
              min="0"
              value={removeQty}
              onChange={(e) => setRemoveQty(e.target.value)}
              placeholder="Custom amount"
              className="mb-3 w-full min-h-[44px] rounded-xl border border-[#DDE3EC] px-3 text-center text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />

            <input
              type="text"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="Reason (e.g. used in class, expired...)"
              className="mb-4 w-full min-h-[44px] rounded-xl border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRemoveItem(null)}
                className="flex-1 min-h-[52px] rounded-xl border-2 border-[#DDE3EC] text-sm font-semibold text-[#5A6A7A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={!removeQty || Number(removeQty) <= 0}
                className="flex-1 min-h-[52px] rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Remove {removeQty || '0'} {removeItem.unit}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
