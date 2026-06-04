'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BOOKING_STATUS_BADGE,
  createConsultationBooking,
  fetchConsultationBookings,
  fetchConsultationSlots,
  formatConsultationDate,
  formatTimeRange,
  type ConsultationBooking,
  type ConsultationSlot,
} from '@/lib/consultations/helpers'
import { useStudentPortal } from '@/components/student/StudentContext'

export default function StudentConsultationBooking() {
  const { student } = useStudentPortal()
  const [slots, setSlots] = useState<ConsultationSlot[]>([])
  const [bookings, setBookings] = useState<ConsultationBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [bookingSlot, setBookingSlot] = useState<ConsultationSlot | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!student) return
    setLoading(true)
    try {
      const [allSlots, allBookings] = await Promise.all([
        fetchConsultationSlots(),
        fetchConsultationBookings(),
      ])
      const today = new Date().toISOString().slice(0, 10)
      setSlots(
        allSlots.filter((s) => !s.isBooked && s.date >= today),
      )
      setBookings(
        allBookings
          .filter((b) => b.studentId === student.id)
          .sort((a, b) => b.date.localeCompare(a.date)),
      )
    } catch (err) {
      console.error('[StudentConsultationBooking]', err)
      setError('Failed to load consultation data.')
    } finally {
      setLoading(false)
    }
  }, [student])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleConfirmBooking() {
    if (!student || !bookingSlot) return
    setSubmitting(true)
    setError('')
    try {
      await createConsultationBooking({
        slot: bookingSlot,
        studentId: student.id,
        studentName: student.name,
        studentPhone: student.mobile,
        notes,
      })
      setSuccessMessage("Booking request sent! We'll confirm shortly.")
      setBookingSlot(null)
      setNotes('')
      await loadData()
    } catch (err) {
      console.error('[StudentConsultationBooking]', err)
      setError('Could not submit booking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!student) return null

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[#DDE3EC]" />
        <div className="h-32 rounded-xl bg-[#DDE3EC]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Available Slots</h2>
        {slots.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#DDE3EC] bg-white px-6 py-10 text-center">
            <span className="ti ti-calendar-off mb-2 block text-3xl text-[#94a3b8]" />
            <p className="font-inter text-sm text-[#5A6A7A]">
              No slots available right now. Check back soon.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="rounded-xl border border-[#DDE3EC] bg-white p-5 shadow-sm"
              >
                <p className="font-jakarta font-semibold text-[#0B3D6B]">
                  {slot.staffName}
                </p>
                <p className="mt-2 text-sm text-[#5A6A7A]">
                  {formatConsultationDate(slot.date)}
                </p>
                <p className="text-sm font-medium text-[#0B3D6B]">
                  {formatTimeRange(slot.startTime, slot.endTime)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setBookingSlot(slot)
                    setNotes('')
                    setSuccessMessage('')
                  }}
                  className="mt-4 w-full rounded-full bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
                >
                  Book
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {bookings.length > 0 && (
        <section>
          <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">My Bookings</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                    {['Date', 'Time', 'Staff', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE3EC]">
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3">{formatConsultationDate(b.date)}</td>
                      <td className="px-4 py-3 text-[#5A6A7A]">
                        {formatTimeRange(b.startTime, b.endTime)}
                      </td>
                      <td className="px-4 py-3">{b.staffName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${BOOKING_STATUS_BADGE[b.status]}`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {bookingSlot && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0D1B2A]/40"
            onClick={() => !submitting && setBookingSlot(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#DDE3EC] bg-white p-6 shadow-xl">
              <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B]">
                Confirm Booking
              </h3>
              <p className="mt-2 text-sm text-[#5A6A7A]">
                {bookingSlot.staffName} · {formatConsultationDate(bookingSlot.date)} ·{' '}
                {formatTimeRange(bookingSlot.startTime, bookingSlot.endTime)}
              </p>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anything you'd like us to know…"
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setBookingSlot(null)}
                  className="flex-1 rounded-lg border border-[#DDE3EC] py-2.5 text-sm font-semibold text-[#0B3D6B]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmBooking}
                  className="flex-1 rounded-full bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
