'use client'

import { useRef, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { writeStockLog } from '@/lib/kitchen/stockLog'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { InventoryCategory, InventoryItem } from '@/types/kitchen'

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'grains', label: 'Grains & Rice' },
  { value: 'protein', label: 'Protein' },
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'condiments', label: 'Condiments & Spices' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'other', label: 'Other' },
]
const CATEGORY_VALUES = CATEGORIES.map((c) => c.value)

interface ParsedItem {
  matchedItemId: string | null
  matchedItemName: string | null
  rawName: string
  quantity: number
  unit: string
  unitPrice: number
  lineTotal: number
  isNewItem: boolean
  suggestedCategory: string
}

interface ParsedBill {
  supplierName: string
  billDate: string
  billTotal: number
  items: ParsedItem[]
  confidence: number
}

interface Row extends ParsedItem {
  include: boolean // matched rows: restock this item
  addNew: boolean // new rows: create this item in inventory
  category: InventoryCategory
}

type Step = 'upload' | 'loading' | 'review' | 'saving'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function normalizeCategory(raw: string): InventoryCategory {
  const v = String(raw ?? '').toLowerCase().trim()
  return (CATEGORY_VALUES as string[]).includes(v) ? (v as InventoryCategory) : 'other'
}

export default function BillImportModal({
  existingItems,
  user,
  onClose,
  onSaved,
}: {
  existingItems: InventoryItem[]
  user: { uid: string; displayName: string }
  onClose: () => void
  onSaved: (summary: { restocked: number; added: number }) => void
}) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [billText, setBillText] = useState('')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [supplier, setSupplier] = useState('')
  const [billDate, setBillDate] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isPdf = file?.type === 'application/pdf'
  const isImage = file?.type.startsWith('image/') ?? false

  function handleFile(f: File | null) {
    setError('')
    setFile(f)
    if (f && f.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(f))
    } else {
      setPreviewUrl(null)
    }
  }

  async function readBill() {
    setError('')
    // A PDF can't be read visually here — require pasted text.
    if (isPdf && !billText.trim()) {
      setError('PDF uploaded — paste the text content below, or take a photo of the bill instead.')
      return
    }
    if (!isImage && !billText.trim()) {
      setError('Upload a photo of the bill or paste its text first.')
      return
    }
    setStep('loading')
    try {
      const existingInventory = existingItems.map((i) => ({
        id: i.id,
        itemName: i.itemName,
        unit: i.unit,
        category: i.category,
      }))
      const payload: Record<string, unknown> = { action: 'parse_bill', existingInventory }
      if (isImage && file) {
        payload.imageBase64 = await fileToBase64(file)
        payload.imageMediaType = file.type
      }
      if (billText.trim()) payload.billText = billText.trim()

      const res = await fetch('/api/kitchen-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as Partial<ParsedBill> & { error?: string }
      if (!res.ok || data.error || !Array.isArray(data.items)) {
        throw new Error(data.error || 'Could not read the bill.')
      }

      setSupplier(String(data.supplierName ?? ''))
      setBillDate(String(data.billDate ?? new Date().toISOString().slice(0, 10)))
      setRows(
        data.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          lineTotal: Number(it.lineTotal) || (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
          include: !it.isNewItem, // matched items import by default
          addNew: false, // new items are opt-in
          category: normalizeCategory(it.suggestedCategory),
        })),
      )
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the bill.')
      setStep('upload')
    }
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  // Rows that will actually be written: matched+include, or new+addNew.
  const activeRows = rows.filter((r) => (r.matchedItemId && r.include) || (r.isNewItem && r.addNew))
  const computedTotal = activeRows.reduce((s, r) => s + r.quantity * r.unitPrice, 0)
  const restockCount = activeRows.filter((r) => r.matchedItemId).length
  const newCount = activeRows.filter((r) => r.isNewItem && r.addNew).length

  async function confirmImport() {
    setStep('saving')
    try {
      for (const r of rows) {
        // Restock a matched item.
        if (r.matchedItemId && r.include) {
          const ref = doc(db, 'inventory', r.matchedItemId)
          await updateDoc(ref, {
            currentStock: increment(r.quantity),
            unitCost: r.unitPrice,
            lastRestockedDate: billDate,
            lastUpdated: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: user.displayName,
          })
          await addDoc(collection(db, 'inventory', r.matchedItemId, 'history'), {
            action: 'restocked',
            type: 'restock',
            source: 'bill_import',
            qty: r.quantity,
            amount: r.quantity,
            unit: r.unit,
            unitCost: r.unitPrice,
            reason: 'bill-import',
            supplier: supplier.trim(),
            date: billDate,
            by: user.uid,
            byName: user.displayName,
            importedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          })
          const matched = existingItems.find((i) => i.id === r.matchedItemId)
          await writeStockLog({
            itemId: r.matchedItemId,
            itemName: matched?.itemName ?? r.rawName,
            changeType: 'add',
            previousQty: matched?.currentStock ?? 0,
            newQty: (matched?.currentStock ?? 0) + r.quantity,
            unit: r.unit,
            changedBy: user.uid,
            changedByName: user.displayName,
            source: 'kitchen',
          })
          continue
        }
        // Create a new inventory item.
        if (r.isNewItem && r.addNew) {
          const created = await addDoc(collection(db, 'inventory'), {
            itemName: r.rawName,
            category: r.category,
            unit: r.unit || 'kg',
            currentStock: r.quantity,
            minStockLevel: 0,
            unitCost: r.unitPrice,
            location: 'Ahangama',
            isActive: true,
            createdVia: 'bill_import',
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: user.displayName,
          })
          await writeStockLog({
            itemId: created.id,
            itemName: r.rawName,
            changeType: 'add',
            previousQty: 0,
            newQty: r.quantity,
            unit: r.unit || 'kg',
            changedBy: user.uid,
            changedByName: user.displayName,
            source: 'kitchen',
          })
        }
      }

      // Import record.
      await addDoc(collection(db, 'kitchen_intake'), {
        supplier: supplier.trim(),
        billDate,
        billTotal: computedTotal,
        items: activeRows.map((r) => ({
          matchedItemId: r.matchedItemId,
          rawName: r.rawName,
          quantity: r.quantity,
          unit: r.unit,
          unitPrice: r.unitPrice,
          lineTotal: r.quantity * r.unitPrice,
          isNewItem: r.isNewItem,
          category: r.category,
        })),
        importedAt: serverTimestamp(),
        importedBy: user.uid,
        source: 'ai_bill_import',
      })

      onSaved({ restocked: restockCount, added: newCount })
      onClose()
    } catch (err) {
      console.error('[BillImport save]', err)
      setError(err instanceof Error ? err.message : 'Failed to update inventory.')
      setStep('review')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-[70] flex items-stretch justify-center sm:items-center sm:p-4">
        <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-[#0d1a2e] sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[#DDE3EC] px-5 py-4 dark:border-white/[0.08]">
            <div>
              <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">
                Import Inventory from Bill
              </h2>
              <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/50">
                Upload a photo or PDF of your supplier bill — AI will read it automatically
              </p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 text-2xl leading-none text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {/* STEP 1 — upload */}
            {step === 'upload' && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#E8A020]/50 bg-[#E8A020]/[0.04] p-6 text-center hover:bg-[#E8A020]/10"
                >
                  <span className="ti ti-camera text-3xl text-[#E8A020]" />
                  <span className="text-sm font-semibold text-[#0B3D6B] dark:text-white">
                    {file ? file.name : 'Tap to take a photo or upload the bill'}
                  </span>
                  <span className="text-xs text-[#5A6A7A] dark:text-white/50">Image or PDF</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />

                {previewUrl && (
                  <img src={previewUrl} alt="Bill preview" className="max-h-56 w-full rounded-xl object-contain" />
                )}
                {isPdf && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                    PDF uploaded — paste the text content below, or take a photo of the bill instead.
                  </p>
                )}

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">
                    Or paste bill text manually
                  </label>
                  <textarea
                    rows={6}
                    value={billText}
                    onChange={(e) => setBillText(e.target.value)}
                    placeholder="Paste the bill contents here…"
                    className="w-full rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base text-[#0D1B2A] outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void readBill()}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] text-base font-bold text-white hover:bg-[#d4911c] sm:w-auto sm:px-6"
                >
                  <span className="ti ti-sparkles" /> Read Bill with AI
                </button>
              </div>
            )}

            {/* STEP 2 — loading */}
            {step === 'loading' && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E8A020] border-t-transparent" />
                <p className="text-sm text-[#5A6A7A] dark:text-white/50">Reading your bill…</p>
              </div>
            )}

            {/* STEP 3 — review */}
            {(step === 'review' || step === 'saving') && (
              <div className="space-y-3">
                {rows.length === 0 && (
                  <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/50">No items found on the bill.</p>
                )}
                {rows.map((r, idx) => {
                  const matched = !!r.matchedItemId
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3 ${
                        matched
                          ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10'
                          : 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">
                          {matched ? (
                            <><span className="ti ti-circle-check text-emerald-600 dark:text-emerald-400" /> Matched: {r.matchedItemName}</>
                          ) : (
                            <><span className="ti ti-alert-triangle text-amber-600 dark:text-amber-400" /> New item: “{r.rawName}”</>
                          )}
                        </p>
                        <button type="button" onClick={() => removeRow(idx)} className="shrink-0 text-xs font-semibold text-red-600 hover:underline dark:text-red-400">
                          Remove
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <label className="flex flex-col text-[10px] font-bold uppercase text-[#5A6A7A] dark:text-white/40">
                          Qty ({r.unit})
                          <input
                            type="number" step="any" min="0" value={r.quantity}
                            onChange={(e) => updateRow(idx, { quantity: Number(e.target.value) || 0 })}
                            className="mt-1 w-24 rounded-lg border border-[#DDE3EC] bg-white px-2 py-1.5 text-base font-normal text-[#0D1B2A] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                        </label>
                        <label className="flex flex-col text-[10px] font-bold uppercase text-[#5A6A7A] dark:text-white/40">
                          Unit Price
                          <input
                            type="number" step="any" min="0" value={r.unitPrice}
                            onChange={(e) => updateRow(idx, { unitPrice: Number(e.target.value) || 0 })}
                            className="mt-1 w-28 rounded-lg border border-[#DDE3EC] bg-white px-2 py-1.5 text-base font-normal text-[#0D1B2A] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                        </label>
                        <span className="pb-1.5 text-xs text-[#5A6A7A] dark:text-white/50">= {formatLKR(r.quantity * r.unitPrice)}</span>
                      </div>

                      {!matched && (
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <label className="flex flex-col text-[10px] font-bold uppercase text-[#5A6A7A] dark:text-white/40">
                            Category
                            <select
                              value={r.category}
                              onChange={(e) => updateRow(idx, { category: e.target.value as InventoryCategory })}
                              className="mt-1 rounded-lg border border-[#DDE3EC] bg-white px-2 py-1.5 text-sm font-normal text-[#0D1B2A] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            >
                              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </label>
                          <label className="flex items-center gap-2 pt-3 text-sm font-medium text-[#0D1B2A] dark:text-white">
                            <input type="checkbox" checked={r.addNew} onChange={(e) => updateRow(idx, { addNew: e.target.checked })} className="h-4 w-4" />
                            Add to inventory
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Supplier / date / total */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col text-[10px] font-bold uppercase text-[#5A6A7A] dark:text-white/40">
                    Supplier
                    <input value={supplier} onChange={(e) => setSupplier(e.target.value)}
                      className="mt-1 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-base font-normal text-[#0D1B2A] dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </label>
                  <label className="flex flex-col text-[10px] font-bold uppercase text-[#5A6A7A] dark:text-white/40">
                    Date
                    <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)}
                      className="mt-1 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-base font-normal text-[#0D1B2A] dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </label>
                </div>
                <p className="text-right text-sm font-bold text-[#E8A020]">Total: {formatLKR(computedTotal)}</p>
              </div>
            )}
          </div>

          {/* Footer actions (review step) */}
          {(step === 'review' || step === 'saving') && (
            <div className="border-t border-[#DDE3EC] px-5 py-3 dark:border-white/[0.08]">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} disabled={step === 'saving'}
                  className="min-h-[48px] w-full rounded-xl border border-[#DDE3EC] text-sm font-semibold text-[#5A6A7A] disabled:opacity-50 dark:border-gray-600 dark:text-white/70 sm:w-auto sm:px-5">
                  Cancel
                </button>
                <button type="button" onClick={() => void confirmImport()} disabled={step === 'saving' || activeRows.length === 0}
                  className="min-h-[48px] w-full rounded-xl bg-[#0B3D6B] text-sm font-bold text-white hover:bg-[#0a3460] disabled:opacity-50 sm:w-auto sm:px-5">
                  {step === 'saving' ? 'Updating…' : `Confirm & Update Inventory (${restockCount + newCount})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
