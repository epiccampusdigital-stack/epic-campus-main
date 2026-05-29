'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import {
  formatSessionDate,
  formatSessionTime,
  isConsultationSlotAvailable,
  parseSession,
} from '@/lib/schedule/helpers'
import type { ScheduleSession } from '@/types'

export default function ConsultationBooking() {
  const { student, user } = useStudentPortal()
  const [slots, setSlots] = useState<ScheduleSession[]>([])
  const [myBookings, setMyBookings] = useState<ScheduleSession[]>([])
  const [loading, setLoading] = useState(true)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const loadSlots = useCallback(async () => {
    if (!student) return
    setLoading(true)
    try {
      const [openSnap, mineSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'schedule'),
            where('type', '==', 'consultation'),
            where('status', '==', 'scheduled'),
          ),
        ).catch(() => ({ docs: [] })),
        getDocs(
          query(
            collection(db, 'schedule'),
            where('type', '==', 'consultation'),
            where('studentId', '==', student.id),
          ),
        ).catch(() => ({ docs: [] })),
      ])

      const all = openSnap.docs.map((d) =>
        parseSession(d.id, d.data() as Record<string, unknown>),
      )
      setSlots(all.filter(isConsultationSlotAvailable))
      setMyBookings(
        mineSnap.docs
          .map((d) => parseSession(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => a.date.localeCompare(b.date)),
      )
    } catch (err) {
      console.error('[ConsultationBooking]', err)
    } finally {
      setLoading(false)
    }
  }, [student])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  const courseSlots = useMemo(() => {
    if (!student) return []
    return slots.filter((s) => s.courseId === student.courseId)
  }, [slots, student])

  async function handleBook(slot: ScheduleSession) {
    if (!student || !user) return
    setBookingId(slot.id)
    setMessage('')
    try {
      await updateDoc(doc(db, 'schedule', slot.id), {
        studentId: student.id,
        studentName: student.name,
        bookingStatus: 'pending',
      })
      setMessage('Booking request submitted. Staff will confirm shortly.')
      await loadSlots()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to book slot')
    } finally {
      setBookingId(null)
    }
  }

  if (!student) return null

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[#DDE3EC]" />
        <div className="h-24 rounded-xl bg-[#DDE3EC]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className="rounded-lg border border-[#E8A020]/30 bg-[#E8A020]/10 px-4 py-3 text-sm text-[#0B3D6B]">
          {message}
        </div>
      )}

      <section>
        <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">
          Available Consultation Slots
        </h2>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
          Book a one-on-one consultation with your course advisor.
        </p>

        {courseSlots.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#DDE3EC] bg-white px-6 py-10 text-center">
            <p className="font-inter text-sm text-[#5A6A7A]">
              No open slots available right now. Check back later.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courseSlots.map((slot) => (
              <div
                key={slot.id}
                className="rounded-xl border border-[#DDE3EC] bg-white p-4"
              >
                <p className="font-jakarta text-sm font-bold text-[#0B3D6B]">
                  {formatSessionDate(slot.date)}
                </p>
                <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
                  {formatSessionTime(slot.startTime, slot.endTime)}
                </p>
                <p className="mt-2 font-inter text-xs text-[#5A6A7A]">
                  With {slot.staffName}
                </p>
                {slot.location && (
                  <p className="mt-1 truncate font-inter text-xs text-[#5A6A7A]">
                    {slot.location}
                  </p>
                )}
                <button
                  type="button"
                  disabled={bookingId === slot.id}
                  onClick={() => handleBook(slot)}
                  className="mt-4 w-full rounded-lg bg-[#E8A020] py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
                >
                  {bookingId === slot.id ? 'Booking…' : 'Book'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {myBookings.length > 0 && (
        <section>
          <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">
            My Consultations
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  {['Date', 'Time', 'Staff', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-jakarta text-xs font-semibold uppercase text-[#5A6A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {myBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">{formatSessionDate(b.date)}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {formatSessionTime(b.startTime, b.endTime)}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{b.staffName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#E8A020]/15 px-2 py-0.5 text-xs font-medium text-[#0B3D6B]">
                        {b.bookingStatus ?? b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
