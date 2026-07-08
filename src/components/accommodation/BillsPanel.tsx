'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { currentMonthKey, monthKeyToLabel, monthOptionsList } from '@/lib/accommodation/helpers'
import type { AccommodationBill, AccommodationHouse } from '@/types/accommodation'

interface Props {
  house: AccommodationHouse
  canManage: boolean
  onClose: () => void
  onChanged: () => void
}

const inputClass =
  'w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]'

function num(v: unknown): number {
  return Number(v ?? 0) || 0
}

function parseBill(id: string, data: Record<string, unknown>): AccommodationBill {
  const rentAmount = num(data.rentAmount)
  const ceb = num(data.ceb)
  const water = num(data.water)
  const internet = num(data.internet)
  const other = num(data.other)
  return {
    id,
    houseId: String(data.houseId ?? ''),
    month: String(data.month ?? monthKeyToLabel(id)),
    year: num(data.year) || Number(id.slice(0, 4)) || new Date().getFullYear(),
    monthKey: String(data.monthKey ?? id),
    rentAmount,
    rentPaid: Boolean(data.rentPaid ?? data.paid ?? false),
    rentPaidDate: data.rentPaidDate ? String(data.rentPaidDate) : undefined,
    ceb,
    water,
    internet,
    other,
    otherNote: data.otherNote ? String(data.otherNote) : data.notes ? String(data.notes) : undefined,
    totalBill: data.totalBill != null ? num(data.totalBill) : rentAmount + ceb + water + internet + other,
    createdAt: String(data.createdAt ?? ''),
  }
}

interface BillForm {
  monthKey: string
  rentAmount: string
  rentPaid: boolean
  rentPaidDate: string
  ceb: string
  water: string
  internet: string
  other: string
  otherNote: string
}

export default function BillsPanel({ house, canManage, onClose, onChanged }: Props) {
  const monthOptions = useMemo(() => monthOptionsList(7), [])
  const [bills, setBills] = useState<AccommodationBill[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BillForm>({
    monthKey: currentMonthKey(),
    rentAmount: String(house.monthlyRent ?? ''),
    rentPaid: false,
    rentPaidDate: '',
    ceb: '',
    water: '',
    internet: '',
    other: '',
    otherNote: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'accommodations', house.id, 'bills'))
      const rows = snap.docs.map((d) => parseBill(d.id, d.data() as Record<string, unknown>))
      rows.sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      setBills(rows)
    } catch (err) {
      console.error('[BillsPanel] load', err)
      setBills([])
    } finally {
      setLoading(false)
    }
  }, [house.id])

  useEffect(() => {
    void load()
  }, [load])

  const currentKey = currentMonthKey()
  const currentBill = bills.find((b) => b.monthKey === currentKey) ?? null

  const liveTotal =
    num(form.rentAmount) + num(form.ceb) + num(form.water) + num(form.internet) + num(form.other)

  function openAdd() {
    setEditingKey(null)
    setForm({
      monthKey: currentMonthKey(),
      rentAmount: String(house.monthlyRent ?? ''),
      rentPaid: false,
      rentPaidDate: '',
      ceb: '',
      water: '',
      internet: '',
      other: '',
      otherNote: '',
    })
    setFormOpen(true)
  }

  function openEdit(bill: AccommodationBill) {
    setEditingKey(bill.monthKey)
    setForm({
      monthKey: bill.monthKey,
      rentAmount: String(bill.rentAmount ?? ''),
      rentPaid: bill.rentPaid,
      rentPaidDate: bill.rentPaidDate ? bill.rentPaidDate.slice(0, 10) : '',
      ceb: String(bill.ceb || ''),
      water: String(bill.water || ''),
      internet: String(bill.internet || ''),
      other: String(bill.other || ''),
      otherNote: bill.otherNote ?? '',
    })
    setFormOpen(true)
  }

  async function saveBill() {
    if (!canManage) return
    setSaving(true)
    try {
      const rentAmount = num(form.rentAmount)
      const ceb = num(form.ceb)
      const water = num(form.water)
      const internet = num(form.internet)
      const other = num(form.other)
      const utilities = ceb + water + internet + other
      const totalBill = rentAmount + utilities
      const monthKey = form.monthKey
      const existing = bills.find((b) => b.monthKey === monthKey)
      await setDoc(
        doc(db, 'accommodations', house.id, 'bills', monthKey),
        {
          houseId: house.id,
          monthKey,
          month: monthKeyToLabel(monthKey),
          year: Number(monthKey.slice(0, 4)) || new Date().getFullYear(),
          rentAmount,
          rentPaid: form.rentPaid,
          rentPaidDate: form.rentPaid ? form.rentPaidDate || new Date().toISOString().slice(0, 10) : null,
          ceb,
          water,
          internet,
          other,
          otherNote: form.otherNote.trim(),
          totalBill,
          // Legacy compat for the older house-detail bills view.
          totalAmount: utilities,
          paid: form.rentPaid,
          notes: form.otherNote.trim(),
          ...(existing ? {} : { createdAt: new Date().toISOString() }),
        },
        { merge: true },
      )
      setFormOpen(false)
      await load()
      onChanged()
    } catch (err) {
      console.error('[BillsPanel] save', err)
    } finally {
      setSaving(false)
    }
  }

  async function toggleRentPaid() {
    if (!canManage || !currentBill) return
    try {
      await updateDoc(doc(db, 'accommodations', house.id, 'bills', currentBill.monthKey), {
        rentPaid: !currentBill.rentPaid,
        paid: !currentBill.rentPaid,
        rentPaidDate: !currentBill.rentPaid ? new Date().toISOString().slice(0, 10) : null,
      })
      await load()
      onChanged()
    } catch (err) {
      console.error('[BillsPanel] toggle rent', err)
    }
  }

  async function removeBill(bill: AccommodationBill) {
    if (!canManage) return
    if (!window.confirm(`Delete the ${bill.month} bill?`)) return
    try {
      await deleteDoc(doc(db, 'accommodations', house.id, 'bills', bill.monthKey))
      await load()
      onChanged()
    } catch (err) {
      console.error('[BillsPanel] delete', err)
    }
  }

  const cur = currentBill
  const curUtilities = cur ? cur.ceb + cur.water + cur.internet + cur.other : 0
  const curTotal = cur ? cur.totalBill : 0

  return (
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[600px] flex-col bg-white shadow-2xl dark:bg-[#0d1a2e]">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/[0.08] px-6 py-4">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">{house.name}</h2>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50">Bills &amp; Payments</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]">
            <span className="ti ti-x text-xl" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Current month strip */}
          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                {monthKeyToLabel(currentKey)}
              </p>
              {canManage && cur && (
                <button
                  type="button"
                  onClick={() => void toggleRentPaid()}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    cur.rentPaid
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {cur.rentPaid ? 'Rent Paid ✓' : 'Mark Rent Paid'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {[
                { label: 'Rent', value: cur ? cur.rentAmount : 0 },
                { label: 'CEB', value: cur ? cur.ceb : 0 },
                { label: 'Water', value: cur ? cur.water : 0 },
                { label: 'Internet', value: cur ? cur.internet : 0 },
                { label: 'Other', value: cur ? cur.other : 0 },
              ].map((r) => (
                <div key={r.label}>
                  <p className="text-[10px] font-semibold uppercase text-gray-400 dark:text-white/40">{r.label}</p>
                  <p className="font-semibold text-[#0D1B2A] dark:text-white">{formatLKR(r.value)}</p>
                </div>
              ))}
              <div className="col-span-2 sm:col-span-3 mt-1 border-t border-[#DDE3EC] dark:border-white/[0.08] pt-2">
                <p className="text-[10px] font-semibold uppercase text-gray-400 dark:text-white/40">Total (rent + utilities {formatLKR(curUtilities)})</p>
                <p className="font-jakarta text-2xl font-black text-[#E8A020]">{formatLKR(curTotal)}</p>
              </div>
            </div>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openAdd}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
            >
              <span className="ti ti-plus" /> Add / Update Bill
            </button>
          )}

          {/* History */}
          <h3 className="mt-6 mb-3 text-sm font-bold text-[#0B3D6B] dark:text-white">Bill History</h3>
          <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] dark:border-white/[0.06]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] dark:border-white/[0.06] bg-[#F5F7FB] dark:bg-white/[0.03] text-xs uppercase text-[#5A6A7A] dark:text-white/40">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Rent</th>
                  <th className="px-3 py-2 text-right">Utilities</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Rent</th>
                  {canManage && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-6 text-center text-[#5A6A7A] dark:text-white/40">Loading…</td></tr>
                ) : bills.length === 0 ? (
                  <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-6 text-center text-[#5A6A7A] dark:text-white/40">No bills recorded yet</td></tr>
                ) : (
                  bills.map((b) => {
                    const utils = b.ceb + b.water + b.internet + b.other
                    return (
                      <tr key={b.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]">
                        <td className="px-3 py-2 font-medium text-[#0D1B2A] dark:text-white">{b.month}</td>
                        <td className="px-3 py-2 text-right text-[#5A6A7A] dark:text-white/60">{formatLKR(b.rentAmount)}</td>
                        <td className="px-3 py-2 text-right text-[#5A6A7A] dark:text-white/60">{formatLKR(utils)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(b.totalBill)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${b.rentPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {b.rentPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button type="button" onClick={() => openEdit(b)} className="rounded p-1 text-[#0B3D6B] hover:bg-[#F5F7FB] dark:text-white/70 dark:hover:bg-white/10" title="Edit">
                                <span className="ti ti-pencil" />
                              </button>
                              <button type="button" onClick={() => void removeBill(b)} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                                <span className="ti ti-trash" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </aside>

      {/* Add / edit bill modal */}
      {formOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFormOpen(false)} aria-hidden="true" />
          <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
              {editingKey ? 'Edit Bill' : 'Add Bill'}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Month</label>
                <select
                  value={form.monthKey}
                  disabled={!!editingKey}
                  onChange={(e) => setForm((f) => ({ ...f, monthKey: e.target.value }))}
                  className={`${inputClass} disabled:opacity-60`}
                >
                  {monthOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Rent Amount (LKR)</label>
                <input type="number" value={form.rentAmount} onChange={(e) => setForm((f) => ({ ...f, rentAmount: e.target.value }))} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#0D1B2A] dark:text-white">
                <input type="checkbox" checked={form.rentPaid} onChange={(e) => setForm((f) => ({ ...f, rentPaid: e.target.checked }))} className="h-4 w-4 rounded text-[#E8A020] focus:ring-[#E8A020]" />
                Rent Paid
              </label>
              {form.rentPaid && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Rent Paid Date</label>
                  <input type="date" value={form.rentPaidDate} onChange={(e) => setForm((f) => ({ ...f, rentPaidDate: e.target.value }))} className={inputClass} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">CEB (LKR)</label>
                  <input type="number" value={form.ceb} onChange={(e) => setForm((f) => ({ ...f, ceb: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Water (LKR)</label>
                  <input type="number" value={form.water} onChange={(e) => setForm((f) => ({ ...f, water: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Internet (LKR)</label>
                  <input type="number" value={form.internet} onChange={(e) => setForm((f) => ({ ...f, internet: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Other (LKR)</label>
                  <input type="number" value={form.other} onChange={(e) => setForm((f) => ({ ...f, other: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Other description</label>
                <input value={form.otherNote} onChange={(e) => setForm((f) => ({ ...f, otherNote: e.target.value }))} className={inputClass} />
              </div>
              <div className="rounded-lg bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-3">
                <p className="text-xs font-semibold uppercase text-gray-400 dark:text-white/40">Total</p>
                <p className="font-jakarta text-xl font-black text-[#E8A020]">{formatLKR(liveTotal)}</p>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 py-2.5 text-sm font-medium text-[#5A6A7A] dark:text-white/70">Cancel</button>
              <button type="button" disabled={saving} onClick={() => void saveBill()} className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
