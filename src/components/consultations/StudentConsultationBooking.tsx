'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'

interface BookingRequest {
  id: string
  date: string
  timeSlot: string
  purpose: string
  notes?: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'rejected'
  rejectedReason?: string
}

const TIME_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM',
  '2:00 PM', '3:00 PM', '4:00 PM',
]

const PURPOSES = [
  'General Inquiry',
  'Visa Discussion',
  'Course Progress',
  'Payment',
  'Other',
]

const inputClass = 'w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-3 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020] transition-all'

export default function StudentConsultationBooking() {
  const { student, user } = useStudentPortal()
  const today = new Date().toISOString().slice(0, 10)

  const [date, setDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [bookings, setBookings] = useState<BookingRequest[]>([])
  const [loadingBookings, setLoadingBookings] = useState(true)

  const loadBookings = useCallback(async () => {
    if (!user) return
    setLoadingBookings(true)
    try {
      const snap = await getDocs(
        query(
          collection(db, 'consultationRequests'),
          where('studentId', '==', user.uid),
          orderBy('createdAt', 'desc'),
        )
      ).catch(() =>
        getDocs(query(
          collection(db, 'consultationRequests'),
          where('studentId', '==', user.uid),
        ))
      )
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as BookingRequest)))
    } catch (err) {
      console.error('[ConsultationBooking]', err)
    } finally {
      setLoadingBookings(false)
    }
  }, [user])

  useEffect(() => { void loadBookings() }, [loadBookings])

  async function handleSubmit() {
    if (!user || !date || !timeSlot || !purpose) return
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'consultationRequests'), {
        studentId: user.uid,
        studentName: student?.name ?? user.displayName ?? 'Student',
        studentCode: student?.studentCode ?? '',
        courseId: student?.courseId ?? '',
        date,
        timeSlot,
        purpose,
        notes: notes.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      setSuccess(`Your consultation has been requested for ${date} at ${timeSlot}. Reception will confirm shortly.`)
      setDate('')
      setTimeSlot('')
      setPurpose('')
      setNotes('')
      void loadBookings()
    } catch (err) {
      console.error('[SubmitBooking]', err)
    } finally {
      setSubmitting(false)
    }
  }

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
    confirmed: { label: 'Confirmed', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
    rejected: { label: 'Booking Rejected', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
  }

  return (
    <div className="space-y-6">
      {/* Booking form */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30">
            <span className="ti ti-calendar-plus text-[#0B3D6B] dark:text-blue-300" />
          </div>
          <div>
            <p className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">Book a Session</p>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50">Reception will confirm your slot</p>
          </div>
        </div>

        {success && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            ✅ {success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#5A6A7A] dark:text-white/50">
              Date *
            </label>
            <input
              type="date"
              min={today}
              value={date}
              onChange={e => { setDate(e.target.value); setSuccess('') }}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#5A6A7A] dark:text-white/50">
              Time Slot *
            </label>
            <select
              value={timeSlot}
              onChange={e => setTimeSlot(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a time...</option>
              {TIME_SLOTS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#5A6A7A] dark:text-white/50">
            Purpose *
          </label>
          <select
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            className={inputClass}
          >
            <option value="">What is this about?</option>
            {PURPOSES.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#5A6A7A] dark:text-white/50">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any specific questions or things to discuss..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <button
          type="button"
          disabled={!date || !timeSlot || !purpose || submitting}
          onClick={() => void handleSubmit()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B3D6B] py-3.5 text-sm font-bold text-white disabled:opacity-40 hover:bg-[#1A6BAD] transition-all"
        >
          {submitting ? (
            <><span className="ti ti-loader animate-spin" /> Booking...</>
          ) : (
            <><span className="ti ti-calendar-check" /> Request Consultation</>
          )}
        </button>
      </div>

      {/* My bookings */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/50">
          My Bookings
        </p>
        {loadingBookings ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />)}
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-10 text-center">
            <span className="ti ti-calendar-off text-3xl text-[#DDE3EC] dark:text-white/20" />
            <p className="mt-2 text-sm text-[#5A6A7A] dark:text-white/50">No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map(b => {
              const cfg = statusConfig[b.status] ?? statusConfig.pending
              return (
                <div key={b.id} className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30">
                      <span className="ti ti-calendar text-[#0B3D6B] dark:text-blue-300 text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">
                        {b.date} at {b.timeSlot}
                      </p>
                      <p className="text-xs text-[#5A6A7A] dark:text-white/40">{b.purpose}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  {b.rejectedReason && (
                    <p className="text-sm text-red-500 mt-1">
                      Reason: {b.rejectedReason}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
