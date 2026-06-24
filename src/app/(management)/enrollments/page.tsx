'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

interface Enrollment {
  id: string
  studentName: string
  email: string
  phone: string
  courseId: string
  location: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt?: unknown
  notes?: string
  agentId?: string
  totalFee?: number
  paymentPlan?: string
}

interface PaymentPlanForm {
  totalFee: string
  installments: { label: string; amount: string; dueDate: string }[]
}

const COURSE_LABELS: Record<string, string> = {
  'japan-ssw': '🇯🇵 Japan SSW',
  'korea': '🇰🇷 Korea',
  'china': '🇨🇳 China',
  'ielts': '📝 IELTS',
  'nvq': '🎓 NVQ',
}

function formatDate(val: unknown): string {
  if (!val) return '—'
  try {
    if (typeof val === 'object' && val !== null && 'toDate' in val) {
      return (val as { toDate: () => Date }).toDate().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    }
    return new Date(String(val)).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return '—' }
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const inputClass = 'w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]'

export default function EnrollmentsPage() {
  const { user } = useManagement()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [search, setSearch] = useState('')
  const [approveModal, setApproveModal] = useState<Enrollment | null>(null)
  const [rejectModal, setRejectModal] = useState<Enrollment | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [planForm, setPlanForm] = useState<PaymentPlanForm>({
    totalFee: '',
    installments: [
      { label: 'Registration Fee', amount: '25000', dueDate: '' },
      { label: 'First Instalment', amount: '', dueDate: '' },
      { label: 'Second Instalment', amount: '', dueDate: '' },
    ],
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'enrollments'), orderBy('createdAt', 'desc'))
      ).catch(() => getDocs(collection(db, 'enrollments')))
      setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)))
    } catch (err) {
      console.error('[Enrollments]', err)
      setEnrollments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Approve enrollment + create payment plan ───────────────────────────────
  async function handleApprove() {
    if (!user || !approveModal) return
    setSaving(true)
    try {
      const batch = writeBatch(db)

      // Update enrollment status
      batch.update(doc(db, 'enrollments', approveModal.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
      })

      // Create student record
      const studentRef = doc(collection(db, 'students'))
      batch.set(studentRef, {
        name: approveModal.studentName,
        email: approveModal.email,
        phone: approveModal.phone,
        courseId: approveModal.courseId,
        location: approveModal.location,
        status: 'active',
        enrollmentId: approveModal.id,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      })

      // Create payment plan if fee entered
      if (planForm.totalFee) {
        const planRef = doc(collection(db, 'studentPaymentPlans'))
        batch.set(planRef, {
          studentId: studentRef.id,
          studentName: approveModal.studentName,
          courseId: approveModal.courseId,
          location: approveModal.location,
          totalFee: Number(planForm.totalFee),
          currency: 'LKR',
          installments: planForm.installments
            .filter(i => i.label && i.amount)
            .map((i, idx) => ({
              id: `inst_${idx + 1}`,
              label: i.label,
              amount: Number(i.amount),
              dueDate: i.dueDate,
            })),
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        })
      }

      await batch.commit()
      setEnrollments(prev => prev.map(e =>
        e.id === approveModal.id ? { ...e, status: 'approved' } : e
      ))
      setApproveModal(null)
      setPlanForm({ totalFee: '', installments: [
        { label: 'Registration Fee', amount: '25000', dueDate: '' },
        { label: 'First Instalment', amount: '', dueDate: '' },
        { label: 'Second Instalment', amount: '', dueDate: '' },
      ]})
      showToast(`✅ ${approveModal.studentName} approved and added to students`)
    } catch (err) {
      console.error('[Approve]', err)
      showToast('Failed to approve — try again')
    } finally {
      setSaving(false)
    }
  }

  // ── Reject enrollment ──────────────────────────────────────────────────────
  async function handleReject() {
    if (!user || !rejectModal) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'enrollments', rejectModal.id), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user.uid,
        rejectionReason: rejectReason,
      })
      setEnrollments(prev => prev.map(e =>
        e.id === rejectModal.id ? { ...e, status: 'rejected' } : e
      ))
      setRejectModal(null)
      setRejectReason('')
      showToast(`Enrollment rejected`)
    } catch (err) {
      console.error('[Reject]', err)
      showToast('Failed to reject — try again')
    } finally {
      setSaving(false)
    }
  }

  const filtered = enrollments.filter(e => {
    const matchTab = e.status === tab
    const q = search.trim().toLowerCase()
    const matchSearch = !q || e.studentName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const counts = {
    pending: enrollments.filter(e => e.status === 'pending').length,
    approved: enrollments.filter(e => e.status === 'approved').length,
    rejected: enrollments.filter(e => e.status === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-[#0B3D6B] px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Enrollments</h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">Review and approve student enrollment requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', count: counts.pending, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
          { label: 'Approved', count: counts.approved, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
          { label: 'Rejected', count: counts.rejected, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4 text-center`}>
            <p className={`font-jakarta text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className={`text-xs font-bold ${s.color}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['pending', 'approved', 'rejected'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${
                tab === t
                  ? 'bg-[#E8A020] text-white'
                  : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
              }`}
            >
              {t} ({counts[t]})
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <span className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A7A]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm dark:text-white outline-none focus:border-[#E8A020]"
          />
        </div>
      </div>

      {/* Enrollment list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-inbox text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">
            No {tab} enrollments{search ? ' matching your search' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(enrollment => (
            <div
              key={enrollment.id}
              className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30 font-bold text-[#0B3D6B] dark:text-blue-300">
                  {getInitials(enrollment.studentName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">
                      {enrollment.studentName}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                      enrollment.status === 'pending'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : enrollment.status === 'approved'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {enrollment.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#5A6A7A] dark:text-white/40">
                    <span className="flex items-center gap-1"><span className="ti ti-mail" />{enrollment.email}</span>
                    {enrollment.phone && <span className="flex items-center gap-1"><span className="ti ti-phone" />{enrollment.phone}</span>}
                    <span className="flex items-center gap-1"><span className="ti ti-book" />{COURSE_LABELS[enrollment.courseId] ?? enrollment.courseId}</span>
                    {enrollment.location && <span className="flex items-center gap-1"><span className="ti ti-map-pin" />{enrollment.location}</span>}
                    <span className="flex items-center gap-1"><span className="ti ti-calendar" />{formatDate(enrollment.createdAt)}</span>
                  </div>
                  {enrollment.notes && (
                    <p className="mt-1.5 text-xs text-[#5A6A7A] dark:text-white/40 italic">{enrollment.notes}</p>
                  )}
                </div>

                {/* Action buttons — only on pending */}
                {enrollment.status === 'pending' && (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setApproveModal(enrollment)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <span className="ti ti-check" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectModal(enrollment)}
                      className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-800 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <span className="ti ti-x" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Approve modal with payment plan ────────────────────────────────── */}
      {approveModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setApproveModal(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white dark:bg-[#0d1a2e] shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/[0.08] px-5 py-4">
              <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Approve Enrollment</h2>
              <button type="button" onClick={() => setApproveModal(null)}>
                <span className="ti ti-x text-lg text-[#5A6A7A]" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-5">
              {/* Student info */}
              <div className="rounded-xl bg-[#F5F7FB] dark:bg-white/[0.04] p-4">
                <p className="font-bold text-[#0B3D6B] dark:text-white">{approveModal.studentName}</p>
                <p className="text-xs text-[#5A6A7A] dark:text-white/50 mt-0.5">
                  {approveModal.email} · {COURSE_LABELS[approveModal.courseId] ?? approveModal.courseId}
                </p>
              </div>

              {/* Payment plan */}
              <div>
                <h3 className="font-jakarta font-bold text-[#0D1B2A] dark:text-white mb-3">
                  Set Payment Plan
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                      Total Course Fee (LKR)
                    </label>
                    <input
                      type="number"
                      value={planForm.totalFee}
                      onChange={e => setPlanForm(f => ({ ...f, totalFee: e.target.value }))}
                      placeholder="e.g. 120000"
                      className={inputClass}
                    />
                  </div>

                  <p className="text-xs font-bold text-[#5A6A7A] dark:text-white/50 uppercase tracking-wide">
                    Installments
                  </p>
                  {planForm.installments.map((inst, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={inst.label}
                        onChange={e => setPlanForm(f => ({
                          ...f,
                          installments: f.installments.map((x, j) => j === i ? { ...x, label: e.target.value } : x)
                        }))}
                        placeholder="Label"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        value={inst.amount}
                        onChange={e => setPlanForm(f => ({
                          ...f,
                          installments: f.installments.map((x, j) => j === i ? { ...x, amount: e.target.value } : x)
                        }))}
                        placeholder="Amount"
                        className={inputClass}
                      />
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={e => setPlanForm(f => ({
                          ...f,
                          installments: f.installments.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x)
                        }))}
                        className={inputClass}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setPlanForm(f => ({
                      ...f,
                      installments: [...f.installments, { label: '', amount: '', dueDate: '' }]
                    }))}
                    className="text-xs font-semibold text-[#0B3D6B] dark:text-blue-300 hover:underline"
                  >
                    + Add installment
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-[#DDE3EC] dark:border-white/[0.08] p-5 space-y-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleApprove()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-jakarta font-bold text-white disabled:opacity-50 hover:bg-emerald-700"
              >
                {saving ? <span className="ti ti-loader animate-spin" /> : <span className="ti ti-check" />}
                {saving ? 'Approving...' : 'Approve & Create Student'}
              </button>
              <button
                type="button"
                onClick={() => setApproveModal(null)}
                className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 py-3 text-sm font-semibold text-[#5A6A7A] dark:text-white/60"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Reject modal ───────────────────────────────────────────────────── */}
      {rejectModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#0d1a2e] p-6 shadow-2xl">
            <h2 className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">Reject Enrollment</h2>
            <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
              Rejecting {rejectModal.studentName}&apos;s enrollment
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Incomplete documents, wrong course..."
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="flex-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 py-2.5 text-sm font-semibold text-[#5A6A7A]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleReject()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-red-700"
              >
                {saving ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
