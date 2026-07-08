'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

type RequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed'

interface ConsultationRequest {
  id: string
  studentName: string
  studentCode?: string
  courseId?: string
  phone?: string
  date: string
  timeSlot: string
  purpose: string
  notes?: string
  status: RequestStatus
  createdAt?: unknown
  confirmedBy?: string
  confirmedAt?: unknown
  rejectedReason?: string
  rejectedAt?: unknown
}

type Tab = 'all' | 'pending' | 'confirmed' | 'rejected'

const COURSE_LABELS: Record<string, string> = {
  'japan-ssw': '🇯🇵 Japan SSW',
  'korea-d2d4': '🇰🇷 Korea',
  'china': '🇨🇳 China',
  'ielts': '📝 IELTS',
  'nvq-it': '🎓 NVQ IT',
  'nvq-hospitality': '🎓 NVQ Hospitality',
  'nvq-caregiving': '🎓 NVQ Caregiving',
  'nvq-construction': '🎓 NVQ Construction',
  'nvq-logistics': '🎓 NVQ Logistics',
}

// pending: amber · confirmed: green · rejected: red · completed: blue
const STATUS_BADGE: Record<RequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  cancelled: 'Rejected',
  completed: 'Completed',
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

/** Shared student-consultation-requests panel — rendered on the dedicated
 *  Consultation Requests page AND inside the Consultations page "Student Requests"
 *  tab, so reception only needs one place to work. */
export default function ConsultationRequestsPanel() {
  const { user } = useManagement()
  const [requests, setRequests] = useState<ConsultationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Reject-reason modal
  const [rejectTarget, setRejectTarget] = useState<ConsultationRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'consultationRequests'), orderBy('createdAt', 'desc'))
      ).catch(() => getDocs(collection(db, 'consultationRequests')))
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ConsultationRequest)))
    } catch (err) {
      console.error('[ConsultationRequests]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function confirmRequest(req: ConsultationRequest) {
    if (!user) return
    setSaving(req.id)
    try {
      const confirmedBy = user.displayName || user.email || 'Staff'
      await updateDoc(doc(db, 'consultationRequests', req.id), {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
        confirmedBy,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      })
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'confirmed', confirmedBy } : r))
      showToast('✅ Consultation confirmed')
      // Notify the student via WhatsApp — non-blocking so a messaging failure
      // never blocks the confirmation itself.
      void fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
        },
        body: JSON.stringify({
          phone: req.phone,
          message: `Your consultation request has been confirmed at EPIC Campus. We look forward to seeing you!`,
        }),
      }).catch(() => {})
    } catch (err) {
      console.error('[ConfirmRequest]', err)
      showToast('Failed to confirm')
    } finally {
      setSaving(null)
    }
  }

  async function submitReject() {
    if (!user || !rejectTarget) return
    const target = rejectTarget
    setSaving(target.id)
    try {
      const reason = rejectReason.trim()
      await updateDoc(doc(db, 'consultationRequests', target.id), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedReason: reason,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      })
      setRequests(prev => prev.map(r => r.id === target.id ? { ...r, status: 'rejected', rejectedReason: reason } : r))
      setRejectTarget(null)
      setRejectReason('')
      showToast('Consultation rejected')
    } catch (err) {
      console.error('[RejectRequest]', err)
      showToast('Failed to reject')
    } finally {
      setSaving(null)
    }
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function matchesTab(r: ConsultationRequest): boolean {
    if (tab === 'all') return true
    if (tab === 'rejected') return r.status === 'rejected' || r.status === 'cancelled'
    return r.status === tab
  }

  const filtered = requests.filter(matchesTab)
  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    confirmed: requests.filter(r => r.status === 'confirmed').length,
    rejected: requests.filter(r => r.status === 'rejected' || r.status === 'cancelled').length,
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-[#0B3D6B] px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', count: counts.pending, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
          { label: 'Confirmed', count: counts.confirmed, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
          { label: 'Rejected', count: counts.rejected, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4 text-center`}>
            <p className={`font-jakarta text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className={`text-xs font-bold ${s.color}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'confirmed', 'rejected'] as const).map(t => (
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

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-calendar-off text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">No {tab === 'all' ? '' : tab + ' '}requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const isRejected = req.status === 'rejected' || req.status === 'cancelled'
            const isExpanded = expanded.has(req.id)
            return (
              <div key={req.id} className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30">
                      <span className="ti ti-calendar-event text-[#0B3D6B] dark:text-blue-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">
                          {req.studentName}
                        </p>
                        {req.studentCode && (
                          <span className="font-mono text-xs text-[#5A6A7A] dark:text-white/40">
                            {req.studentCode}
                          </span>
                        )}
                        {req.courseId && (
                          <span className="text-xs text-[#5A6A7A] dark:text-white/40">
                            {COURSE_LABELS[req.courseId] ?? req.courseId}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#5A6A7A] dark:text-white/40">
                        <span className="flex items-center gap-1">
                          <span className="ti ti-calendar" />{req.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="ti ti-clock" />{req.timeSlot}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="ti ti-tag" />{req.purpose}
                        </span>
                      </div>
                      {req.notes && (
                        <p className="mt-1.5 text-xs text-[#5A6A7A] dark:text-white/40 italic">
                          &quot;{req.notes}&quot;
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-[#5A6A7A]/50 dark:text-white/20">
                        Requested: {formatDate(req.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>

                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving === req.id}
                          onClick={() => void confirmRequest(req)}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <span className="ti ti-check" />
                          Confirm
                        </button>
                        <button
                          type="button"
                          disabled={saving === req.id}
                          onClick={() => { setRejectTarget(req); setRejectReason('') }}
                          className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-800 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        >
                          <span className="ti ti-x" />
                          Reject
                        </button>
                      </div>
                    )}

                    {req.status === 'confirmed' && req.confirmedBy && (
                      <p className="text-[11px] text-[#5A6A7A] dark:text-white/40">
                        by {req.confirmedBy}
                      </p>
                    )}

                    {isRejected && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(req.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline"
                      >
                        <span className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
                        {isExpanded ? 'Hide reason' : 'View reason'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsed expandable rejection reason */}
                {isRejected && isExpanded && (
                  <div className="mt-3 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">Rejection reason</p>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      {req.rejectedReason?.trim() || 'No reason provided.'}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reject reason modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectTarget(null)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">
              Reject consultation
            </h2>
            <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
              {rejectTarget.studentName} · {rejectTarget.date} · {rejectTarget.timeSlot}
            </p>
            <label className="mt-4 mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
              Reason (shared with the record)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Slot no longer available — please rebook."
              className="w-full rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
            />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-xl border border-[#DDE3EC] dark:border-white/10 py-2.5 text-sm font-medium text-[#5A6A7A] dark:text-white/70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving === rejectTarget.id}
                onClick={() => void submitReject()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving === rejectTarget.id ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
