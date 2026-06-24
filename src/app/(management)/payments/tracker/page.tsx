'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

interface Installment {
  id: string
  label: string
  amount: number
  dueDate: string
  paidAt?: string
  paidBy?: string
}

interface PaymentPlan {
  id: string
  studentId: string
  studentName: string
  studentCode?: string
  courseId?: string
  location?: string
  totalFee: number
  currency: string
  installments: Installment[]
  createdAt?: unknown
}

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK')}`
}

function isOverdue(dueDate: string, paidAt?: string) {
  if (paidAt) return false
  return dueDate < new Date().toISOString().slice(0, 10)
}

function isPending(dueDate: string, paidAt?: string) {
  if (paidAt) return false
  return !isOverdue(dueDate, paidAt)
}

function StatusBadge({ installment }: { installment: Installment }) {
  if (installment.paidAt) {
    return (
      <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
        Paid
      </span>
    )
  }
  if (isOverdue(installment.dueDate)) {
    return (
      <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
        Overdue
      </span>
    )
  }
  return (
    <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
      Pending
    </span>
  )
}

export default function PaymentTrackerPage() {
  const { user } = useManagement()
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'pending' | 'paid'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [marking, setMarking] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'studentPaymentPlans'), orderBy('createdAt', 'desc'))
      )
      setPlans(
        snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<PaymentPlan, 'id'>),
        }))
      )
    } catch (err) {
      console.error('[PaymentTracker]', err)
      // fallback without orderBy
      try {
        const snap2 = await getDocs(collection(db, 'studentPaymentPlans'))
        setPlans(snap2.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PaymentPlan, 'id'>) })))
      } catch { setPlans([]) }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Summary stats ────────────────────────────────────────────────────────
  const stats = plans.reduce(
    (acc, plan) => {
      plan.installments.forEach(inst => {
        if (inst.paidAt) {
          acc.paid++
          acc.paidAmount += inst.amount
        } else if (isOverdue(inst.dueDate)) {
          acc.overdue++
          acc.overdueAmount += inst.amount
        } else {
          acc.pending++
          acc.pendingAmount += inst.amount
        }
      })
      return acc
    },
    { paid: 0, overdue: 0, pending: 0, paidAmount: 0, overdueAmount: 0, pendingAmount: 0 }
  )

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = plans.filter(plan => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q ||
      plan.studentName.toLowerCase().includes(q) ||
      (plan.studentCode ?? '').toLowerCase().includes(q)

    if (!matchSearch) return false
    if (statusFilter === 'all') return true
    return plan.installments.some(inst => {
      if (statusFilter === 'paid') return !!inst.paidAt
      if (statusFilter === 'overdue') return isOverdue(inst.dueDate, inst.paidAt)
      if (statusFilter === 'pending') return isPending(inst.dueDate, inst.paidAt)
      return true
    })
  })

  // ── Mark single installment paid ─────────────────────────────────────────
  async function markPaid(planId: string, instId: string) {
    if (!user) return
    const plan = plans.find(p => p.id === planId)
    if (!plan) return
    const updated = plan.installments.map(i =>
      i.id === instId
        ? { ...i, paidAt: new Date().toISOString(), paidBy: user.uid }
        : i
    )
    await updateDoc(doc(db, 'studentPaymentPlans', planId), { installments: updated })
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, installments: updated } : p))
    showToast('Installment marked as paid ✓')
  }

  // ── Mark single installment unpaid ───────────────────────────────────────
  async function markUnpaid(planId: string, instId: string) {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return
    const updated = plan.installments.map(i =>
      i.id === instId
        ? { ...i, paidAt: undefined, paidBy: undefined }
        : i
    )
    await updateDoc(doc(db, 'studentPaymentPlans', planId), { installments: updated })
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, installments: updated } : p))
    showToast('Installment unmarked')
  }

  // ── Bulk mark selected as paid ───────────────────────────────────────────
  // selected keys are "planId::instId"
  async function bulkMarkPaid() {
    if (!user || selected.size === 0) return
    setMarking(true)
    try {
      const batch = writeBatch(db)
      const byPlan: Record<string, string[]> = {}
      selected.forEach(key => {
        const [planId, instId] = key.split('::')
        if (!byPlan[planId]) byPlan[planId] = []
        byPlan[planId].push(instId)
      })

      const now = new Date().toISOString()
      const updatedPlans = plans.map(plan => {
        if (!byPlan[plan.id]) return plan
        const updated = plan.installments.map(i =>
          byPlan[plan.id].includes(i.id) && !i.paidAt
            ? { ...i, paidAt: now, paidBy: user.uid }
            : i
        )
        batch.update(doc(db, 'studentPaymentPlans', plan.id), { installments: updated })
        return { ...plan, installments: updated }
      })

      await batch.commit()
      setPlans(updatedPlans)
      setSelected(new Set())
      showToast(`${selected.size} installment${selected.size > 1 ? 's' : ''} marked as paid ✓`)
    } finally {
      setMarking(false)
    }
  }

  function toggleSelect(planId: string, instId: string) {
    const key = `${planId}::${instId}`
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const unpaidSelected = Array.from(selected).filter(key => {
    const [planId, instId] = key.split('::')
    const plan = plans.find(p => p.id === planId)
    return plan?.installments.find(i => i.id === instId && !i.paidAt)
  })

  if (!user) return null

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
            Payment Tracker
          </h1>
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">
            Installment schedules — mark payments as received
          </p>
        </div>
        {unpaidSelected.length > 0 && (
          <button
            type="button"
            disabled={marking}
            onClick={() => void bulkMarkPaid()}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 shadow-sm"
          >
            <span className="ti ti-check" />
            Mark {unpaidSelected.length} as Paid
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Paid', count: stats.paid, amount: stats.paidAmount, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
          { label: 'Overdue', count: stats.overdue, amount: stats.overdueAmount, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
          { label: 'Pending', count: stats.pending, amount: stats.pendingAmount, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4`}>
            <p className={`text-xs font-bold uppercase tracking-wide ${s.color}`}>{s.label}</p>
            <p className={`mt-1 font-jakarta text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className={`text-xs font-medium ${s.color} opacity-70`}>{formatLKR(s.amount)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <span className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A7A]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student name or ID…"
            className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm dark:text-white outline-none focus:border-[#E8A020]"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'overdue', 'pending', 'paid'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition-all ${
                statusFilter === f
                  ? 'bg-[#E8A020] text-white'
                  : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Plans list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-credit-card-off text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">
            {search ? 'No students match your search' : 'No payment plans found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(plan => {
            const paidCount = plan.installments.filter(i => i.paidAt).length
            const total = plan.installments.length
            const isExpanded = expandedPlan === plan.id
            const overdueCount = plan.installments.filter(i => isOverdue(i.dueDate, i.paidAt)).length

            return (
              <div
                key={plan.id}
                className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden"
              >
                {/* Plan header */}
                <button
                  type="button"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#F5F7FB]/50 dark:hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30">
                      <span className="ti ti-user text-[#0B3D6B] dark:text-blue-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-jakarta font-bold text-[#0D1B2A] dark:text-white truncate">
                        {plan.studentName}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {plan.studentCode && (
                          <span className="text-xs text-[#5A6A7A] dark:text-white/40 font-mono">
                            {plan.studentCode}
                          </span>
                        )}
                        {plan.location && (
                          <span className="text-xs text-[#5A6A7A] dark:text-white/40 capitalize">
                            · {plan.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {overdueCount > 0 && (
                      <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
                        {overdueCount} overdue
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#0D1B2A] dark:text-white">
                        {paidCount}/{total} paid
                      </p>
                      <p className="text-xs text-[#5A6A7A] dark:text-white/40">
                        {formatLKR(plan.totalFee)}
                      </p>
                    </div>
                    {/* Progress bar */}
                    <div className="hidden sm:block w-20">
                      <div className="h-1.5 rounded-full bg-[#DDE3EC] dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${total > 0 ? (paidCount / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-[#5A6A7A] dark:text-white/40`} />
                  </div>
                </button>

                {/* Installments (expanded) */}
                {isExpanded && (
                  <div className="border-t border-[#DDE3EC] dark:border-white/[0.08]">
                    <div className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
                      {plan.installments.map((inst, idx) => {
                        const key = `${plan.id}::${inst.id}`
                        const isChecked = selected.has(key)
                        const overdue = isOverdue(inst.dueDate, inst.paidAt)

                        return (
                          <div
                            key={inst.id}
                            className={`flex items-center gap-3 px-5 py-3 transition-all ${
                              isChecked ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            {!inst.paidAt && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelect(plan.id, inst.id)}
                                className="h-4 w-4 rounded border-[#DDE3EC] accent-emerald-600 cursor-pointer"
                              />
                            )}
                            {inst.paidAt && (
                              <div className="h-4 w-4 flex items-center justify-center">
                                <span className="ti ti-check text-xs text-emerald-500" />
                              </div>
                            )}

                            {/* Number */}
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              inst.paidAt
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                : overdue
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : 'bg-[#0B3D6B]/10 dark:bg-white/10 text-[#0B3D6B] dark:text-white/60'
                            }`}>
                              {idx + 1}
                            </div>

                            {/* Label + due date */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#0D1B2A] dark:text-white">
                                {inst.label}
                              </p>
                              <p className="text-xs text-[#5A6A7A] dark:text-white/40">
                                Due: {inst.dueDate}
                                {inst.paidAt && (
                                  <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                                    · Paid: {inst.paidAt.slice(0, 10)}
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Amount */}
                            <p className="shrink-0 text-sm font-bold text-[#0D1B2A] dark:text-white">
                              {formatLKR(inst.amount)}
                            </p>

                            {/* Status badge */}
                            <StatusBadge installment={inst} />

                            {/* Action button */}
                            {inst.paidAt ? (
                              <button
                                type="button"
                                onClick={() => void markUnpaid(plan.id, inst.id)}
                                className="shrink-0 rounded-lg border border-[#DDE3EC] dark:border-white/20 px-2 py-1 text-[10px] text-[#5A6A7A] dark:text-white/40 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 transition-all"
                              >
                                Undo
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void markPaid(plan.id, inst.id)}
                                className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 transition-all"
                              >
                                Mark Paid
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
