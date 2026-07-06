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
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

interface ConsultationRequest {
  id: string
  studentName: string
  studentCode?: string
  courseId?: string
  date: string
  timeSlot: string
  purpose: string
  notes?: string
  status: 'pending' | 'confirmed' | 'cancelled'
  createdAt?: unknown
}

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

export default function ConsultationRequestsPage() {
  const { user } = useManagement()
  const [requests, setRequests] = useState<ConsultationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'confirmed' | 'cancelled'>('pending')
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState('')

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

  async function updateStatus(id: string, status: 'confirmed' | 'cancelled') {
    if (!user) return
    setSaving(id)
    try {
      await updateDoc(doc(db, 'consultationRequests', id), {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      })
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      showToast(status === 'confirmed' ? '✅ Consultation confirmed' : 'Consultation cancelled')
    } catch (err) {
      console.error('[UpdateStatus]', err)
      showToast('Failed to update')
    } finally {
      setSaving(null)
    }
  }

  const filtered = requests.filter(r => r.status === tab)
  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    confirmed: requests.filter(r => r.status === 'confirmed').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length,
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-[#0B3D6B] px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          Consultation Requests
        </h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          Student booking requests — confirm or cancel
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', count: counts.pending, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
          { label: 'Confirmed', count: counts.confirmed, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
          { label: 'Cancelled', count: counts.cancelled, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4 text-center`}>
            <p className={`font-jakarta text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className={`text-xs font-bold ${s.color}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['pending', 'confirmed', 'cancelled'] as const).map(t => (
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
          {[1,2,3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-calendar-off text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">No {tab} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
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

                {req.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={saving === req.id}
                      onClick={() => void updateStatus(req.id, 'confirmed')}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <span className="ti ti-check" />
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={saving === req.id}
                      onClick={() => void updateStatus(req.id, 'cancelled')}
                      className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-800 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      <span className="ti ti-x" />
                      Cancel
                    </button>
                  </div>
                )}

                {req.status === 'confirmed' && (
                  <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    ✅ Confirmed
                  </span>
                )}

                {req.status === 'cancelled' && (
                  <span className="shrink-0 rounded-full bg-red-100 dark:bg-red-900/30 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-400">
                    Cancelled
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
