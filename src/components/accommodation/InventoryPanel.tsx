'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { AccommodationHouse, InventoryCategory, InventoryItem, ItemCondition } from '@/types/accommodation'

interface Props {
  house: AccommodationHouse
  canManage: boolean
  onClose: () => void
}

const CATEGORIES: InventoryCategory[] = ['Furniture', 'Appliance', 'Kitchen', 'Bathroom', 'Bedding', 'Other']
const CONDITION_ORDER: ItemCondition[] = ['good', 'fair', 'poor', 'missing']

const CONDITION_STYLES: Record<ItemCondition, string> = {
  good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  fair: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  poor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  missing: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function parseItem(id: string, data: Record<string, unknown>, houseId: string): InventoryItem {
  const cat = String(data.category ?? 'Other')
  const category = (CATEGORIES.includes(cat as InventoryCategory) ? cat : 'Other') as InventoryCategory
  const cond = String(data.condition ?? 'good')
  const condition = (CONDITION_ORDER.includes(cond as ItemCondition) ? cond : 'good') as ItemCondition
  return {
    id,
    houseId: String(data.houseId ?? houseId),
    itemName: String(data.itemName ?? 'Item'),
    category,
    present: data.present !== false,
    condition,
    notes: data.notes ? String(data.notes) : '',
  }
}

export default function InventoryPanel({ house, canManage, onClose }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<InventoryCategory>('Furniture')
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'accommodations', house.id, 'inventory'))
      setItems(snap.docs.map((d) => parseItem(d.id, d.data() as Record<string, unknown>, house.id)))
    } catch (err) {
      console.error('[InventoryPanel] load', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [house.id])

  useEffect(() => {
    void load()
  }, [load])

  const presentCount = useMemo(() => items.filter((i) => i.present).length, [items])
  const totalCount = items.length
  const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0
  const catItems = items.filter((i) => i.category === activeCat)

  async function patchItem(item: InventoryItem, patch: Partial<InventoryItem>) {
    if (!canManage) return
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))
    try {
      await updateDoc(doc(db, 'accommodations', house.id, 'inventory', item.id), patch)
    } catch (err) {
      console.error('[InventoryPanel] patch', err)
      void load()
    }
  }

  function cycleCondition(item: InventoryItem) {
    const idx = CONDITION_ORDER.indexOf(item.condition)
    const next = CONDITION_ORDER[(idx + 1) % CONDITION_ORDER.length]
    void patchItem(item, { condition: next })
  }

  async function addItem() {
    if (!canManage || !newItemName.trim()) return
    setAdding(true)
    try {
      const payload = {
        houseId: house.id,
        itemName: newItemName.trim(),
        category: activeCat,
        present: true,
        condition: 'good' as ItemCondition,
        notes: '',
      }
      const ref = await addDoc(collection(db, 'accommodations', house.id, 'inventory'), payload)
      setItems((prev) => [...prev, { id: ref.id, ...payload }])
      setNewItemName('')
    } catch (err) {
      console.error('[InventoryPanel] add', err)
    } finally {
      setAdding(false)
    }
  }

  function printChecklist() {
    const byCat = CATEGORIES.map((c) => ({ c, list: items.filter((i) => i.category === c) })).filter((g) => g.list.length > 0)
    const sections = byCat
      .map(
        (g) => `<h2>${g.c}</h2><table><thead><tr><th>Item</th><th>Present</th><th>Condition</th><th>Notes</th></tr></thead><tbody>${g.list
          .map(
            (i) =>
              `<tr><td>${escapeHtml(i.itemName)}</td><td style="text-align:center">${i.present ? '☑' : '☐'}</td><td>${i.condition}</td><td>${escapeHtml(i.notes ?? '')}</td></tr>`,
          )
          .join('')}</tbody></table>`,
      )
      .join('')
    const html = `<!doctype html><html><head><title>${escapeHtml(house.name)} — Inventory</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#0D1B2A}
      h1{color:#0B3D6B;font-size:20px} h2{color:#0B3D6B;font-size:15px;margin-top:20px}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
      th,td{border:1px solid #DDE3EC;padding:6px;text-align:left} th{background:#F5F7FB}</style></head>
      <body><h1>${escapeHtml(house.name)} — Inventory Checklist</h1>
      <p>${presentCount} / ${totalCount} items present</p>${sections}</body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[700px] flex-col bg-white shadow-2xl dark:bg-[#0d1a2e]">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/[0.08] px-6 py-4">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">{house.name}</h2>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50">Inventory Checklist</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={printChecklist} className="rounded-lg border border-[#DDE3EC] dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-[#0B3D6B] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]">
              <span className="ti ti-printer mr-1" /> Print
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]">
              <span className="ti ti-x text-xl" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Progress */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-[#0D1B2A] dark:text-white">{presentCount} / {totalCount} items present</span>
              <span className="text-[#5A6A7A] dark:text-white/50">{pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-white/10">
              <div className="h-full rounded-full bg-[#E8A020] transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Category tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const count = items.filter((i) => i.category === c).length
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCat(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    activeCat === c
                      ? 'bg-[#E8A020] text-white'
                      : 'border border-[#DDE3EC] dark:border-white/10 text-[#0B3D6B] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {c} ({count})
                </button>
              )
            })}
          </div>

          {/* Items */}
          {loading ? (
            <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/40">Loading…</p>
          ) : catItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/40">No items in {activeCat}</p>
          ) : (
            <div className="space-y-2">
              {catItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.present}
                      disabled={!canManage}
                      onChange={(e) => void patchItem(item, { present: e.target.checked })}
                      className="h-5 w-5 shrink-0 rounded border-[#DDE3EC] text-[#E8A020] focus:ring-[#E8A020]"
                    />
                    <span className={`min-w-0 flex-1 truncate text-sm font-medium ${item.present ? 'text-[#0D1B2A] dark:text-white' : 'text-gray-400 line-through dark:text-white/30'}`}>
                      {item.itemName}
                    </span>
                    <button
                      type="button"
                      onClick={() => cycleCondition(item)}
                      disabled={!canManage}
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${CONDITION_STYLES[item.condition]} ${canManage ? 'cursor-pointer' : 'cursor-default'}`}
                      title={canManage ? 'Click to change condition' : undefined}
                    >
                      {item.condition}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotesOpenId(notesOpenId === item.id ? null : item.id)}
                      className="shrink-0 rounded p-1 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:text-white/50 dark:hover:bg-white/10"
                      title="Notes"
                    >
                      <span className="ti ti-note" />
                    </button>
                  </div>
                  {notesOpenId === item.id && (
                    <input
                      value={item.notes ?? ''}
                      disabled={!canManage}
                      onChange={(e) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, notes: e.target.value } : i)))}
                      onBlur={(e) => void patchItem(item, { notes: e.target.value })}
                      placeholder="Add a note…"
                      className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
                    />
                  )}
                  {notesOpenId !== item.id && item.notes && (
                    <p className="mt-1.5 pl-8 text-xs text-[#5A6A7A] dark:text-white/50">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add item */}
          {canManage && (
            <div className="mt-4 flex gap-2">
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void addItem() }}
                placeholder={`Add item to ${activeCat}…`}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
              />
              <button
                type="button"
                disabled={adding || !newItemName.trim()}
                onClick={() => void addItem()}
                className="rounded-lg bg-[#0B3D6B] px-4 py-2 text-sm font-bold text-white hover:bg-[#0a3460] disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}
