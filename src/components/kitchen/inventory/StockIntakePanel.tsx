'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import type { KitchenIntake, IntakeItemRow, InventoryItem } from '@/types/kitchen'
import { formatLKR } from '@/lib/utils/formatCurrency'

interface StockIntakePanelProps {
  inventoryItems: InventoryItem[]
  kitchenUser: { uid: string; displayName: string }
  onIntakeSaved: () => void
}

interface IntakeRowDraft {
  inventoryItemId: string
  itemName: string
  quantityReceived: string
  unitCost: string
}

const EMPTY_ROW: IntakeRowDraft = {
  inventoryItemId: '',
  itemName: '',
  quantityReceived: '',
  unitCost: '',
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  return parseFloat(n.toFixed(3)).toString()
}

function formatIntakeDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function uploadReceipt(
  file: File,
  intakeDate: string,
  invoiceNumber: string,
  onProgress: (pct: number) => void,
): Promise<{ url: string; fileName: string }> {
  const storagePath = `kitchen/receipts/${intakeDate.slice(0, 7)}/${invoiceNumber}_${Date.now()}_${file.name}`
  const storageRef = ref(storage, storagePath)
  const task = uploadBytesResumable(storageRef, file)
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100
        onProgress(pct)
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve({ url, fileName: file.name })
      },
    )
  })
}

export default function StockIntakePanel({
  inventoryItems,
  kitchenUser,
  onIntakeSaved,
}: StockIntakePanelProps) {
  // ─── SECTION A: NEW INTAKE FORM STATE ───
  const [intakeDate, setIntakeDate] = useState<string>(todayStr())
  const [supplier, setSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceTotal, setInvoiceTotal] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<IntakeRowDraft[]>([{ ...EMPTY_ROW }])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // ─── SECTION B: HISTORY STATE ───
  const [intakes, setIntakes] = useState<KitchenIntake[]>([])
  const [loadingIntakes, setLoadingIntakes] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingIntake, setEditingIntake] = useState<KitchenIntake | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Edit modal local fields
  const [editDate, setEditDate] = useState('')
  const [editSupplier, setEditSupplier] = useState('')
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('')
  const [editInvoiceTotal, setEditInvoiceTotal] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editReceiptUrl, setEditReceiptUrl] = useState<string | null>(null)
  const [editReceiptFileName, setEditReceiptFileName] = useState<string | null>(null)
  const [editUploadProgress, setEditUploadProgress] = useState<number | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  async function loadIntakes() {
    setLoadingIntakes(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'kitchen_intake'), orderBy('intakeDate', 'desc')),
      )
      setIntakes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as KitchenIntake)))
    } catch (err) {
      console.error('[StockIntake load]', err)
    } finally {
      setLoadingIntakes(false)
    }
  }

  useEffect(() => {
    loadIntakes()
  }, [])

  function addRow() {
    setRows((r) => [...r, { ...EMPTY_ROW }])
  }

  function removeRow(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx))
  }

  function updateRowItem(idx: number, inventoryItemId: string) {
    const found = inventoryItems.find((it) => it.id === inventoryItemId)
    setRows((r) =>
      r.map((row, i) =>
        i === idx
          ? { ...row, inventoryItemId, itemName: found?.itemName ?? '' }
          : row,
      ),
    )
  }

  function updateRowField(idx: number, field: 'quantityReceived' | 'unitCost', value: string) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)))
  }

  function rowLineTotal(row: IntakeRowDraft): number {
    return (parseFloat(row.quantityReceived) || 0) * (parseFloat(row.unitCost) || 0)
  }

  const runningTotal = rows.reduce((sum, row) => sum + rowLineTotal(row), 0)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setReceiptFile(file)
    if (file && file.type.startsWith('image/')) {
      setReceiptPreviewUrl(URL.createObjectURL(file))
    } else {
      setReceiptPreviewUrl(null)
    }
  }

  function resetForm() {
    setIntakeDate(todayStr())
    setSupplier('')
    setInvoiceNumber('')
    setInvoiceTotal('')
    setNotes('')
    setRows([{ ...EMPTY_ROW }])
    setReceiptFile(null)
    setReceiptPreviewUrl(null)
    setUploadProgress(null)
  }

  async function handleSave() {
    const validRows = rows.filter(
      (r) => r.inventoryItemId && parseFloat(r.quantityReceived) > 0,
    )
    if (!intakeDate || !supplier.trim() || !invoiceNumber.trim() || validRows.length === 0) {
      alert('Please fill date, supplier, invoice number, and at least one item with quantity.')
      return
    }

    setSaving(true)
    try {
      let receiptUrl: string | null = null
      let receiptFileName: string | null = null

      if (receiptFile) {
        const uploaded = await uploadReceipt(
          receiptFile,
          intakeDate,
          invoiceNumber.trim(),
          (pct) => setUploadProgress(pct),
        )
        receiptUrl = uploaded.url
        receiptFileName = uploaded.fileName
      }

      const items: IntakeItemRow[] = validRows.map((r) => ({
        inventoryItemId: r.inventoryItemId,
        itemName: r.itemName,
        quantityReceived: parseFloat(r.quantityReceived),
        unitCost: parseFloat(r.unitCost) || 0,
        lineTotal: (parseFloat(r.quantityReceived) || 0) * (parseFloat(r.unitCost) || 0),
      }))

      const savedRef = await addDoc(collection(db, 'kitchen_intake'), {
        intakeDate,
        supplier: supplier.trim(),
        invoiceNumber: invoiceNumber.trim(),
        invoiceTotal: parseFloat(invoiceTotal) || 0,
        receiptUrl,
        receiptFileName,
        notes: notes.trim(),
        items,
        createdAt: serverTimestamp(),
        createdBy: kitchenUser.uid,
        createdByName: kitchenUser.displayName,
        location: 'Ahangama',
      })

      for (const item of items) {
        await updateDoc(doc(db, 'inventory', item.inventoryItemId), {
          currentStock: increment(item.quantityReceived),
          unitCost: item.unitCost,
          lastUpdated: serverTimestamp(),
        })
        await addDoc(collection(db, 'inventory', item.inventoryItemId, 'history'), {
          type: 'restock',
          amount: item.quantityReceived,
          reason: `Stock intake — Invoice: ${invoiceNumber.trim()} | Supplier: ${supplier.trim()}`,
          changedBy: kitchenUser.uid,
          changedByName: kitchenUser.displayName,
          timestamp: serverTimestamp(),
          intakeId: savedRef.id,
        })
      }

      resetForm()
      onIntakeSaved()
      await loadIntakes()
      setSaving(false)
      setUploadProgress(null)
      alert('Stock intake saved successfully!')
    } catch (err) {
      console.error('[StockIntake save]', err)
      alert('Failed to save stock intake. Please try again.')
      setSaving(false)
      setUploadProgress(null)
    }
  }

  // ─── EDIT MODAL ───
  function openEdit(intake: KitchenIntake) {
    setEditingIntake(intake)
    setEditDate(intake.intakeDate)
    setEditSupplier(intake.supplier)
    setEditInvoiceNumber(intake.invoiceNumber)
    setEditInvoiceTotal(String(intake.invoiceTotal))
    setEditNotes(intake.notes)
    setEditReceiptUrl(intake.receiptUrl)
    setEditReceiptFileName(intake.receiptFileName)
    setEditUploadProgress(null)
  }

  function closeEdit() {
    setEditingIntake(null)
    setEditUploadProgress(null)
  }

  async function handleEditFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editingIntake) return
    try {
      const uploaded = await uploadReceipt(
        file,
        editDate || editingIntake.intakeDate,
        editInvoiceNumber.trim() || editingIntake.invoiceNumber,
        (pct) => setEditUploadProgress(pct),
      )
      setEditReceiptUrl(uploaded.url)
      setEditReceiptFileName(uploaded.fileName)
      setEditUploadProgress(null)
    } catch (err) {
      console.error('[StockIntake edit upload]', err)
      alert('Failed to upload receipt.')
      setEditUploadProgress(null)
    }
  }

  async function handleEditSave() {
    if (!editingIntake) return
    setEditSaving(true)
    try {
      await updateDoc(doc(db, 'kitchen_intake', editingIntake.id), {
        intakeDate: editDate,
        supplier: editSupplier.trim(),
        invoiceNumber: editInvoiceNumber.trim(),
        invoiceTotal: parseFloat(editInvoiceTotal) || 0,
        notes: editNotes.trim(),
        receiptUrl: editReceiptUrl,
        receiptFileName: editReceiptFileName,
      })
      closeEdit()
      await loadIntakes()
    } catch (err) {
      console.error('[StockIntake edit save]', err)
      alert('Failed to update intake.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(db, 'kitchen_intake', id))
      setDeleteConfirmId(null)
      await loadIntakes()
    } catch (err) {
      console.error('[StockIntake delete]', err)
      alert('Failed to delete intake.')
    }
  }

  function isPdf(fileName: string | null): boolean {
    return !!fileName && fileName.toLowerCase().endsWith('.pdf')
  }

  return (
    <div className="space-y-8">
      {/* ─── NEW INTAKE FORM ─── */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-bold text-[#0D1B2A] dark:text-white">🧾 New Stock Intake</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Intake Date *</label>
            <input
              type="date"
              value={intakeDate}
              onChange={(e) => setIntakeDate(e.target.value)}
              className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white placeholder-gray-400 dark:placeholder-white/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Supplier *</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Supplier name"
              className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white placeholder-gray-400 dark:placeholder-white/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Invoice Number *</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-001"
              className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white placeholder-gray-400 dark:placeholder-white/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Invoice Total (LKR)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={invoiceTotal}
              onChange={(e) => setInvoiceTotal(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white placeholder-gray-400 dark:placeholder-white/40"
            />
          </div>
        </div>

        {/* Item rows */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-[#5A6A7A] dark:text-white/70">Items Received</p>
            <button
              type="button"
              onClick={addRow}
              className="rounded-xl bg-[#0B3D6B]/10 dark:bg-white/10 px-3 py-1.5 text-sm font-semibold text-[#0B3D6B] dark:text-white hover:bg-[#0B3D6B]/20 dark:hover:bg-white/20"
            >
              + Add Row
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-[#F5F7FB] dark:bg-white/5 p-3 md:grid-cols-[2fr_1fr_1fr_1.2fr_auto]"
              >
                <select
                  value={row.inventoryItemId}
                  onChange={(e) => updateRowItem(idx, e.target.value)}
                  className="rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white"
                >
                  <option value="" className="bg-white dark:bg-[#0d1a2e] text-[#0D1B2A] dark:text-white">
                    Select item…
                  </option>
                  {inventoryItems.map((it) => (
                    <option key={it.id} value={it.id} className="bg-white dark:bg-[#0d1a2e] text-[#0D1B2A] dark:text-white">
                      {it.itemName} ({it.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={row.quantityReceived}
                  onChange={(e) => updateRowField(idx, 'quantityReceived', e.target.value)}
                  placeholder="Qty"
                  className="rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white placeholder-gray-400 dark:placeholder-white/40"
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={row.unitCost}
                  onChange={(e) => updateRowField(idx, 'unitCost', e.target.value)}
                  placeholder="Unit cost"
                  className="rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white placeholder-gray-400 dark:placeholder-white/40"
                />
                <div className="flex items-center px-2 text-sm font-semibold text-[#E8A020]">
                  {formatLKR(rowLineTotal(row))}
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="rounded-xl bg-red-500/80 px-3 py-2 text-white hover:bg-red-600"
                  aria-label="Remove row"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-end text-sm font-semibold text-[#0D1B2A] dark:text-white">
            Total: <span className="ml-2 text-[#E8A020]">{formatLKR(runningTotal)}</span>
          </div>
        </div>

        {/* Receipt upload */}
        <div className="mt-6">
          <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Receipt (image or PDF)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
            className="block w-full text-sm text-[#5A6A7A] dark:text-white/70 file:mr-3 file:rounded-xl file:border-0 file:bg-[#0B3D6B]/10 dark:file:bg-white/10 file:px-4 file:py-2 file:text-[#0B3D6B] dark:file:text-white hover:file:bg-[#0B3D6B]/20 dark:hover:file:bg-white/20"
          />
          {receiptPreviewUrl && (
            <img
              src={receiptPreviewUrl}
              alt="Receipt preview"
              className="mt-3 h-24 w-24 rounded object-cover"
            />
          )}
          {receiptFile && !receiptPreviewUrl && (
            <div className="mt-3 flex items-center gap-2 text-sm text-[#5A6A7A] dark:text-white/70">
              <span className="text-2xl">📄</span>
              {receiptFile.name}
            </div>
          )}
          {uploadProgress !== null && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded bg-[#DDE3EC] dark:bg-white/10">
              <div
                className="h-2 rounded bg-[#E8A020] transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mt-6">
          <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            className="w-full resize-none rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white placeholder-gray-400 dark:placeholder-white/40"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[#E8A020] px-4 py-2 font-semibold text-white hover:bg-[#d4911c] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Intake'}
          </button>
        </div>
      </div>

      {/* ─── INTAKE HISTORY ─── */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-[#0D1B2A] dark:text-white">Intake History</h2>
        {loadingIntakes ? (
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">Loading…</p>
        ) : intakes.length === 0 ? (
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">No stock intakes yet.</p>
        ) : (
          intakes.map((intake) => (
            <div
              key={intake.id}
              className="mb-3 rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-white/5 p-4"
            >
              <div
                className="flex flex-wrap items-center justify-between gap-2"
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expandedId === intake.id ? null : intake.id)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && setExpandedId(expandedId === intake.id ? null : intake.id)
                }
              >
                <div className="flex flex-wrap items-center gap-3 text-sm text-[#0D1B2A] dark:text-white">
                  <span>📅 {formatIntakeDate(intake.intakeDate)}</span>
                  <span className="font-semibold">{intake.supplier}</span>
                  <span className="text-[#5A6A7A] dark:text-white/60">Invoice: {intake.invoiceNumber}</span>
                  <span className="font-semibold text-[#E8A020]">
                    {formatLKR(intake.invoiceTotal)}
                  </span>
                </div>
                <span className="text-[#5A6A7A] dark:text-white/60">{expandedId === intake.id ? '▲' : '▼'}</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#0B3D6B]/10 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-[#0B3D6B] dark:text-white/70">
                  {intake.items.length} items
                </span>
                {intake.receiptUrl && (
                  isPdf(intake.receiptFileName) ? (
                    <button
                      type="button"
                      onClick={() => window.open(intake.receiptUrl!, '_blank')}
                      className="flex items-center gap-1 rounded-lg bg-[#0B3D6B]/10 dark:bg-white/10 px-2 py-1 text-xs text-[#0B3D6B] dark:text-white hover:bg-[#0B3D6B]/20 dark:hover:bg-white/20"
                    >
                      <span className="text-base">📄</span> PDF
                    </button>
                  ) : (
                    <img
                      src={intake.receiptUrl}
                      alt="Receipt"
                      onClick={() => window.open(intake.receiptUrl!, '_blank')}
                      className="h-10 w-10 cursor-pointer rounded object-cover"
                    />
                  )
                )}
              </div>

              {expandedId === intake.id && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm text-[#0D1B2A] dark:text-white/80">
                    <thead>
                      <tr className="border-b border-[#DDE3EC] dark:border-white/10 text-xs uppercase text-[#5A6A7A] dark:text-white/40">
                        <th className="py-2 pr-3">Item</th>
                        <th className="py-2 pr-3">Qty Received</th>
                        <th className="py-2 pr-3">Unit Cost (LKR)</th>
                        <th className="py-2 pr-3">Line Total (LKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intake.items.map((it, i) => (
                        <tr key={i} className="border-b border-[#DDE3EC] dark:border-white/5 last:border-0">
                          <td className="py-2 pr-3">{it.itemName}</td>
                          <td className="py-2 pr-3">{formatQty(it.quantityReceived)}</td>
                          <td className="py-2 pr-3">{formatLKR(it.unitCost)}</td>
                          <td className="py-2 pr-3">{formatLKR(it.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {intake.notes && (
                    <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">Notes: {intake.notes}</p>
                  )}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(intake)}
                  className="rounded-xl bg-[#0B3D6B]/10 dark:bg-white/10 px-3 py-1.5 text-sm text-[#0B3D6B] dark:text-white hover:bg-[#0B3D6B]/20 dark:hover:bg-white/20"
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(intake.id)}
                  className="rounded-xl bg-red-500/80 px-3 py-1.5 text-sm text-white hover:bg-red-600"
                >
                  🗑️ Delete
                </button>
              </div>

              {deleteConfirmId === intake.id && (
                <div className="mt-3 rounded-xl border border-red-300 dark:border-red-400/30 bg-red-50 dark:bg-red-500/10 p-3 text-sm">
                  <p className="mb-2 text-red-700 dark:text-red-200">
                    ⚠️ This will delete the intake record only. Inventory stock will NOT be reversed.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(intake.id)}
                      className="rounded-xl bg-red-500/80 px-3 py-2 text-white hover:bg-red-600"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded-xl bg-[#0B3D6B]/10 dark:bg-white/10 px-4 py-2 text-[#0B3D6B] dark:text-white hover:bg-[#0B3D6B]/20 dark:hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ─── EDIT MODAL ─── */}
      {editingIntake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-[#0d1a2e] p-6">
            <h3 className="mb-4 text-lg font-bold text-[#0D1B2A] dark:text-white">Edit Intake</h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Intake Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Supplier</label>
                <input
                  type="text"
                  value={editSupplier}
                  onChange={(e) => setEditSupplier(e.target.value)}
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Invoice Number</label>
                <input
                  type="text"
                  value={editInvoiceNumber}
                  onChange={(e) => setEditInvoiceNumber(e.target.value)}
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Invoice Total (LKR)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={editInvoiceTotal}
                  onChange={(e) => setEditInvoiceTotal(e.target.value)}
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/10 px-3 py-2 text-[#0D1B2A] dark:text-white"
              />
            </div>

            {/* Receipt re-upload */}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-[#5A6A7A] dark:text-white/70">Receipt</label>
              {editReceiptUrl && (
                <div className="mb-2">
                  {isPdf(editReceiptFileName) ? (
                    <button
                      type="button"
                      onClick={() => window.open(editReceiptUrl!, '_blank')}
                      className="flex items-center gap-1 rounded-lg bg-[#0B3D6B]/10 dark:bg-white/10 px-2 py-1 text-xs text-[#0B3D6B] dark:text-white hover:bg-[#0B3D6B]/20 dark:hover:bg-white/20"
                    >
                      <span className="text-base">📄</span> {editReceiptFileName ?? 'PDF'}
                    </button>
                  ) : (
                    <img
                      src={editReceiptUrl}
                      alt="Receipt"
                      onClick={() => window.open(editReceiptUrl!, '_blank')}
                      className="h-16 w-16 cursor-pointer rounded object-cover"
                    />
                  )}
                </div>
              )}
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleEditFileSelect}
                className="block w-full text-sm text-[#5A6A7A] dark:text-white/70 file:mr-3 file:rounded-xl file:border-0 file:bg-[#0B3D6B]/10 dark:file:bg-white/10 file:px-4 file:py-2 file:text-[#0B3D6B] dark:file:text-white hover:file:bg-[#0B3D6B]/20 dark:hover:file:bg-white/20"
              />
              {editUploadProgress !== null && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded bg-[#DDE3EC] dark:bg-white/10">
                  <div
                    className="h-2 rounded bg-[#E8A020] transition-all"
                    style={{ width: `${editUploadProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Read-only items */}
            <div className="mt-4">
              <p className="mb-2 text-xs text-[#5A6A7A] dark:text-white/50">Items are read-only after saving</p>
              <div className="space-y-1 rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-[#F5F7FB] dark:bg-white/5 p-3 text-sm text-[#5A6A7A] dark:text-white/70">
                {editingIntake.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{it.itemName}</span>
                    <span>
                      {formatQty(it.quantityReceived)} × {formatLKR(it.unitCost)} ={' '}
                      {formatLKR(it.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-xl bg-[#0B3D6B]/10 dark:bg-white/10 px-4 py-2 text-[#0B3D6B] dark:text-white hover:bg-[#0B3D6B]/20 dark:hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={editSaving}
                className="rounded-xl bg-[#E8A020] px-4 py-2 font-semibold text-white hover:bg-[#d4911c] disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
