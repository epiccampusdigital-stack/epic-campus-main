'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import toast from 'react-hot-toast'
import { db, storage } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { Role } from '@/types'

type ExpenseLocation = 'Galle' | 'Ahangama' | 'Both' | 'Other'
type ExpenseMethod = 'cash' | 'bank' | 'cheque' | 'card'
type ExpenseStatus = 'pending' | 'approved' | 'paid'

const CATEGORIES = [
  'Salary',
  'Utilities (CEB/Water/Internet)',
  'Maintenance',
  'Garden & Cleaning',
  'Catering & Food',
  'Transport',
  'Hardware & Equipment',
  'Office Supplies',
  'Installment',
  'Telecom',
  'Rent',
  'Other',
] as const

const LOCATIONS: ExpenseLocation[] = ['Galle', 'Ahangama', 'Both', 'Other']
const METHODS: ExpenseMethod[] = ['cash', 'bank', 'cheque', 'card']
const STATUSES: ExpenseStatus[] = ['pending', 'approved', 'paid']

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  location: ExpenseLocation
  date: string // YYYY-MM-DD (local)
  month: string // YYYY-MM
  paidBy: string
  paymentMethod: ExpenseMethod
  receiptUrl: string | null
  notes: string
  status: ExpenseStatus
}

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthOptions(count: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  const base = new Date()
  for (let i = 0; i < count; i++) {
    const dt = new Date(base.getFullYear(), base.getMonth() - i, 1)
    out.push({
      value: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`,
      label: dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    })
  }
  return out
}

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  approved: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
}

const inputClass =
  'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1535] px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-[#E8A020] dark:focus:border-[#E8A020]'

function emptyForm() {
  return {
    description: '',
    amount: '',
    category: CATEGORIES[0] as string,
    location: 'Ahangama' as ExpenseLocation,
    date: toLocalISODate(new Date()),
    paymentMethod: 'cash' as ExpenseMethod,
    notes: '',
  }
}

export default function ExpensesPage() {
  const { user, hasRole } = useManagement()
  const allowed = (['admin', 'owner', 'accountant', 'reception'] as Role[]).some((r) => hasRole(r))
  const canApprove = (['admin', 'owner', 'accountant'] as Role[]).some((r) => hasRole(r))
  const canDelete = hasRole('admin') || hasRole('owner')

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())
  const [locationFilter, setLocationFilter] = useState<ExpenseLocation | ''>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | ''>('')

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const months = useMemo(() => monthOptions(12), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc')))
        .catch(() => getDocs(collection(db, 'expenses')))
      setExpenses(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>
          const rawDate = data.date
          const dateStr =
            rawDate instanceof Timestamp
              ? toLocalISODate(rawDate.toDate())
              : String(rawDate ?? '').slice(0, 10)
          return {
            id: d.id,
            description: String(data.description ?? ''),
            amount: Number(data.amount ?? 0),
            category: String(data.category ?? 'Other'),
            location: (data.location as ExpenseLocation) ?? 'Other',
            date: dateStr,
            month: String(data.month ?? dateStr.slice(0, 7)),
            paidBy: String(data.paidBy ?? ''),
            paymentMethod: (data.paymentMethod as ExpenseMethod) ?? 'cash',
            receiptUrl: data.receiptUrl ? String(data.receiptUrl) : null,
            notes: String(data.notes ?? ''),
            status: (data.status as ExpenseStatus) ?? 'pending',
          }
        }),
      )
    } catch (err) {
      console.error('[Expenses] load', err)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) void load()
  }, [allowed, load])

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (monthFilter && e.month !== monthFilter) return false
      if (locationFilter && e.location !== locationFilter) return false
      if (categoryFilter && e.category !== categoryFilter) return false
      if (statusFilter && e.status !== statusFilter) return false
      return true
    })
  }, [expenses, monthFilter, locationFilter, categoryFilter, statusFilter])

  const summary = useMemo(() => {
    const monthExpenses = expenses.filter((e) => e.month === monthFilter)
    const total = monthExpenses.reduce((s, e) => s + e.amount, 0)
    const galle = monthExpenses.filter((e) => e.location === 'Galle').reduce((s, e) => s + e.amount, 0)
    const ahangama = monthExpenses.filter((e) => e.location === 'Ahangama').reduce((s, e) => s + e.amount, 0)
    const pending = monthExpenses.filter((e) => e.status === 'pending').length
    return { total, galle, ahangama, pending }
  }, [expenses, monthFilter])

  const filteredTotal = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered])

  async function handleSave() {
    if (!user || !form.description.trim() || !form.amount) return
    setSaving(true)
    try {
      let receiptUrl: string | null = null
      if (receiptFile) {
        const storageRef = ref(storage, `expenses/${Date.now()}-${receiptFile.name}`)
        await uploadBytes(storageRef, receiptFile)
        receiptUrl = await getDownloadURL(storageRef)
      }
      await addDoc(collection(db, 'expenses'), {
        description: form.description.trim(),
        amount: Number(form.amount) || 0,
        category: form.category,
        location: form.location,
        date: form.date,
        month: form.date.slice(0, 7),
        paidBy: user.displayName ?? user.email ?? '',
        paymentMethod: form.paymentMethod,
        receiptUrl,
        notes: form.notes.trim(),
        status: 'pending',
        addedBy: user.uid,
        addedAt: serverTimestamp(),
      })
      toast.success('Expense added')
      setFormOpen(false)
      setForm(emptyForm())
      setReceiptFile(null)
      void load()
    } catch (err) {
      console.error('[Expenses] save', err)
      toast.error('Failed to add expense')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(expense: Expense, status: ExpenseStatus) {
    try {
      await updateDoc(doc(db, 'expenses', expense.id), { status, updatedAt: serverTimestamp() })
      setExpenses((prev) => prev.map((e) => (e.id === expense.id ? { ...e, status } : e)))
    } catch (err) {
      console.error('[Expenses] status', err)
      toast.error('Failed to update status')
    }
  }

  async function handleDelete(expense: Expense) {
    if (!window.confirm(`Delete "${expense.description}"?`)) return
    try {
      await deleteDoc(doc(db, 'expenses', expense.id))
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id))
      toast.success('Expense deleted')
    } catch (err) {
      console.error('[Expenses] delete', err)
      toast.error('Failed to delete')
    }
  }

  function exportPdf() {
    const monthLabel = months.find((m) => m.value === monthFilter)?.label ?? monthFilter
    const rows = filtered
      .map(
        (e) =>
          `<tr><td>${e.date}</td><td>${escapeHtml(e.description)}</td><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.location)}</td><td style="text-align:right">${e.amount.toLocaleString('en-LK')}</td></tr>`,
      )
      .join('')
    const html = `<!doctype html><html><head><title>Expenses ${monthLabel}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#0D1B2A}
      h1{color:#0B3D6B;font-size:20px} table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
      th,td{border:1px solid #DDE3EC;padding:8px;text-align:left} th{background:#F5F7FB}
      tfoot td{font-weight:bold;background:#F5F7FB}</style></head><body>
      <h1>EPIC Campus — Expenses (${monthLabel})</h1>
      <table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Location</th><th style="text-align:right">Amount (LKR)</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">TOTAL</td><td style="text-align:right">${filteredTotal.toLocaleString('en-LK')}</td></tr></tfoot></table>
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) {
      toast.error('Pop-up blocked — allow pop-ups to export')
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  if (!allowed) {
    return <p className="text-sm text-[#5A6A7A] dark:text-white/50">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Expenses</h1>
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">Track office, campus and operational spending</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
          >
            <span className="ti ti-printer" /> Export PDF
          </button>
          <button
            type="button"
            onClick={() => { setForm(emptyForm()); setReceiptFile(null); setFormOpen(true) }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
          >
            <span className="ti ti-plus" /> Add Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: 'Total This Month', value: formatLKR(summary.total), tone: 'text-[#0B3D6B] dark:text-[#E8A020]' },
          { label: 'Galle Total', value: formatLKR(summary.galle), tone: 'text-[#0B3D6B] dark:text-white' },
          { label: 'Ahangama Total', value: formatLKR(summary.ahangama), tone: 'text-[#0B3D6B] dark:text-white' },
          { label: 'Pending Approval', value: String(summary.pending), tone: 'text-amber-600 dark:text-amber-400' },
        ].map((c) => (
          <div key={c.label} className="stat-card-glass p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/50">{c.label}</p>
            <p className={`mt-2 font-jakarta text-lg font-black sm:text-xl ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1535] p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className={inputClass}>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value as ExpenseLocation | '')} className={inputClass}>
            <option value="">All locations</option>
            {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ExpenseStatus | '')} className={inputClass}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/[0.05] bg-white dark:bg-white/[0.04]">
        <table className="min-w-[800px] w-full text-left text-sm">
          <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              {['Date', 'Description', 'Category', 'Location', 'Amount', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-4"><div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-white/[0.08]" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-white/40">No expenses for the selected filters.</td></tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-gray-500 dark:text-white/50 whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {e.description}
                    {e.receiptUrl && (
                      <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#0B3D6B] dark:text-[#E8A020]" title="View receipt">
                        <span className="ti ti-paperclip" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-white/50">{e.category}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-white/50">{e.location}</td>
                  <td className="px-4 py-3 font-semibold text-[#0B3D6B] dark:text-[#E8A020] whitespace-nowrap">{formatLKR(e.amount)}</td>
                  <td className="px-4 py-3">
                    {canApprove ? (
                      <select
                        value={e.status}
                        onChange={(ev) => void changeStatus(e, ev.target.value as ExpenseStatus)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize outline-none ${STATUS_STYLES[e.status]}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s} className="capitalize bg-white dark:bg-[#1A1535] text-gray-900 dark:text-white">{s}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[e.status]}`}>{e.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canDelete && (
                      <button type="button" onClick={() => void handleDelete(e)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                        <span className="ti ti-trash" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03]">
                <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">TOTAL ({filtered.length})</td>
                <td className="px-4 py-3 text-sm font-black text-[#E8A020]">{formatLKR(filteredTotal)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add expense modal */}
      {formOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setFormOpen(false)} aria-hidden="true" />
          <div className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white dark:bg-[#1A1535] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">Add Expense</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-1.5 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:text-white/60 dark:hover:bg-white/[0.06]">
                <span className="ti ti-x text-lg" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Description *</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. CEB Campus 1" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Amount (LKR) *</label>
                  <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Category</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputClass}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Location</label>
                  <select value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value as ExpenseLocation }))} className={inputClass}>
                    {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Payment Method</label>
                <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as ExpenseMethod }))} className={inputClass}>
                  {METHODS.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional" className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Receipt (optional)</label>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-[#5A6A7A] dark:text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0B3D6B] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white" />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 py-2.5 text-sm font-semibold text-gray-700 dark:text-white/70">Cancel</button>
              <button
                type="button"
                disabled={saving || !form.description.trim() || !form.amount}
                onClick={() => void handleSave()}
                className="flex-[2] rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Expense'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}
