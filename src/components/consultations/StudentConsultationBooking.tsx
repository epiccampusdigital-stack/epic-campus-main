'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'

type RoomType = 'it-lab' | 'main-classroom' | 'language-lab'
type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

const ROOMS: { value: RoomType; label: string; icon: string; capacity: string }[] = [
  { value: 'it-lab', label: 'IT Lab', icon: 'ti-device-desktop', capacity: '30 machines' },
  { value: 'main-classroom', label: 'Main Classroom', icon: 'ti-school', capacity: 'Full class' },
  { value: 'language-lab', label: 'Language Lab', icon: 'ti-headphones', capacity: 'Language practice' },
]

const STATUS_BADGE: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

interface RoomSlot {
  id: string
  date: string
  startTime: string
  endTime: string
  room: RoomType
  machineNumber?: number
  staffName: string
  isBooked: boolean
  bookedByStudentId?: string
  totalMachines?: number
  availableMachines?: number
}

interface RoomBooking {
  id: string
  slotId: string
  date: string
  startTime: string
  endTime: string
  room: RoomType
  machineNumber?: number
  staffName: string
  studentId: string
  studentName: string
  studentPhone?: string
  notes: string
  status: BookingStatus
  purpose: string
  createdAt: unknown
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function StudentConsultationBooking() {
  const { student } = useStudentPortal()
  const [slots, setSlots] = useState<RoomSlot[]>([])
  const [bookings, setBookings] = useState<RoomBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<RoomType | 'all'>('all')
  const [bookingSlot, setBookingSlot] = useState<RoomSlot | null>(null)
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [purpose, setPurpose] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const loadData = useCallback(async () => {
    if (!student) return
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)

      const [slotsSnap, bookingsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'roomSlots'),
            where('date', '>=', today),
            orderBy('date', 'asc'),
          ),
        ).catch(() => getDocs(collection(db, 'roomSlots'))),
        getDocs(
          query(
            collection(db, 'roomBookings'),
            where('studentId', '==', student.id),
          ),
        ),
      ])

      const allSlots = slotsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RoomSlot, 'id'>),
      }))

      const myBookings = bookingsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RoomBooking, 'id'>),
      }))

      const bookedSlotIds = new Set(
        myBookings
          .filter((b) => b.status !== 'cancelled')
          .map((b) => b.slotId),
      )

      setSlots(allSlots.filter((s) => !bookedSlotIds.has(s.id)))
      setBookings(myBookings.sort((a, b) => b.date.localeCompare(a.date)))
    } catch (err) {
      console.error('[RoomBooking]', err)
      setError('Failed to load booking data.')
    } finally {
      setLoading(false)
    }
  }, [student])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleConfirmBooking() {
    if (!student || !bookingSlot) return
    if (bookingSlot.room === 'it-lab' && !selectedMachine) {
      setError('Please select a machine number for the IT Lab.')
      return
    }
    if (!purpose.trim()) {
      setError('Please enter the purpose of your booking.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const bookingData = {
        slotId: bookingSlot.id,
        date: bookingSlot.date,
        startTime: bookingSlot.startTime,
        endTime: bookingSlot.endTime,
        room: bookingSlot.room,
        machineNumber: bookingSlot.room === 'it-lab' ? selectedMachine : null,
        staffName: bookingSlot.staffName,
        studentId: student.id,
        studentName: student.name,
        studentPhone: (student as any).mobile ?? '',
        notes: notes.trim(),
        purpose: purpose.trim(),
        status: 'pending' as BookingStatus,
        createdAt: serverTimestamp(),
      }
      await addDoc(collection(db, 'roomBookings'), bookingData)

      if (bookingSlot.room === 'it-lab' && bookingSlot.totalMachines) {
        const available = (bookingSlot.availableMachines ?? bookingSlot.totalMachines) - 1
        await updateDoc(doc(db, 'roomSlots', bookingSlot.id), {
          availableMachines: Math.max(0, available),
          isBooked: available <= 0,
        })
      } else {
        await updateDoc(doc(db, 'roomSlots', bookingSlot.id), { isBooked: true })
      }

      setBookingSlot(null)
      setSelectedMachine(null)
      setNotes('')
      setPurpose('')
      setSuccessMessage('Booking submitted! Staff will confirm shortly.')
      showToast('Booking submitted successfully')
      await loadData()
    } catch (err) {
      console.error('[RoomBooking confirm]', err)
      setError('Could not submit booking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancelBooking(bookingId: string) {
    setCancellingId(bookingId)
    try {
      await updateDoc(doc(db, 'roomBookings', bookingId), { status: 'cancelled' })
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)),
      )
      showToast('Booking cancelled')
    } catch (err) {
      console.error('[RoomBooking cancel]', err)
      showToast('Failed to cancel booking')
    } finally {
      setCancellingId(null)
    }
  }

  const filteredSlots = slots.filter(
    (s) => selectedRoom === 'all' || s.room === selectedRoom,
  )

  const groupedSlots = filteredSlots.reduce<Record<string, RoomSlot[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = []
    acc[s.date].push(s)
    return acc
  }, {})

  if (!student) return null

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[#DDE3EC] dark:bg-white/10" />
        <div className="h-32 rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-400">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Room filter */}
      <section>
        <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white mb-4">
          Available Slots
        </h2>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedRoom('all')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              selectedRoom === 'all'
                ? 'bg-[#E8A020] text-white'
                : 'border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] text-[#5A6A7A] dark:text-white/60'
            }`}
          >
            All Rooms
          </button>
          {ROOMS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setSelectedRoom(r.value)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                selectedRoom === r.value
                  ? 'bg-[#0B3D6B] text-white'
                  : 'border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] text-[#5A6A7A] dark:text-white/60'
              }`}
            >
              <span className={`ti ${r.icon} text-sm`} />
              {r.label}
            </button>
          ))}
        </div>

        {Object.keys(groupedSlots).length === 0 ? (
          <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-6 py-10 text-center">
            <span className="ti ti-calendar-off mb-2 block text-3xl text-[#94a3b8]" />
            <p className="text-sm text-[#5A6A7A] dark:text-white/50">
              No slots available right now. Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSlots).map(([date, daySlots]) => (
              <div key={date}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                  {formatDate(date)}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {daySlots.map((slot) => {
                    const room = ROOMS.find((r) => r.value === slot.room)
                    const isItLab = slot.room === 'it-lab'
                    const available = slot.availableMachines ?? slot.totalMachines ?? null
                    const isFull = isItLab && available !== null && available <= 0

                    return (
                      <div
                        key={slot.id}
                        className={`rounded-xl border p-4 ${
                          isFull
                            ? 'border-[#DDE3EC] dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] opacity-60'
                            : 'border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`ti ${room?.icon ?? 'ti-calendar'} text-[#0B3D6B] dark:text-[#E8A020]`} />
                              <p className="font-semibold text-sm text-[#0B3D6B] dark:text-white">
                                {room?.label ?? slot.room}
                              </p>
                            </div>
                            <p className="text-xs text-[#5A6A7A] dark:text-white/50">
                              {slot.startTime} — {slot.endTime}
                            </p>
                            {slot.staffName && (
                              <p className="text-xs text-[#5A6A7A] dark:text-white/40 mt-0.5">
                                {slot.staffName}
                              </p>
                            )}
                          </div>
                          {isItLab && available !== null && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              available > 5
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : available > 0
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {isFull ? 'Full' : `${available} free`}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isFull}
                          onClick={() => {
                            setBookingSlot(slot)
                            setSelectedMachine(null)
                            setNotes('')
                            setPurpose('')
                            setError('')
                            setSuccessMessage('')
                          }}
                          className="w-full rounded-xl bg-[#E8A020] py-2 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isFull ? 'Fully Booked' : 'Book'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My bookings */}
      {bookings.length > 0 && (
        <section>
          <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white mb-4">
            My Bookings
          </h2>
          <div className="space-y-3">
            {bookings.map((b) => {
              const room = ROOMS.find((r) => r.value === b.room)
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`ti ${room?.icon ?? 'ti-calendar'} text-[#0B3D6B] dark:text-[#E8A020]`} />
                        <p className="font-semibold text-sm text-[#0D1B2A] dark:text-white">
                          {room?.label ?? b.room}
                          {b.machineNumber ? ` — Machine #${b.machineNumber}` : ''}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGE[b.status]}`}>
                          {b.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#5A6A7A] dark:text-white/50">
                        {formatDate(b.date)} · {b.startTime} — {b.endTime}
                      </p>
                      {b.purpose && (
                        <p className="mt-1 text-xs text-[#5A6A7A] dark:text-white/40">
                          Purpose: {b.purpose}
                        </p>
                      )}
                    </div>
                    {b.status === 'pending' && (
                      <button
                        type="button"
                        disabled={cancellingId === b.id}
                        onClick={() => void handleCancelBooking(b.id)}
                        className="shrink-0 rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        {cancellingId === b.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Booking modal */}
      {bookingSlot && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => !submitting && setBookingSlot(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-[#0d1a2e] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white mb-1">
                Confirm Booking
              </h3>
              <p className="text-sm text-[#5A6A7A] dark:text-white/50 mb-4">
                {ROOMS.find((r) => r.value === bookingSlot.room)?.label} ·{' '}
                {formatDate(bookingSlot.date)} · {bookingSlot.startTime} — {bookingSlot.endTime}
              </p>

              {bookingSlot.room === 'it-lab' && (
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                    Select Machine Number *
                  </label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {Array.from({ length: bookingSlot.totalMachines ?? 30 }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSelectedMachine(num)}
                        className={`rounded-lg py-2 text-xs font-bold transition-all ${
                          selectedMachine === num
                            ? 'bg-[#0B3D6B] text-white'
                            : 'border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.06] text-[#0B3D6B] dark:text-white hover:border-[#E8A020]'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  {selectedMachine && (
                    <p className="mt-2 text-xs text-[#5A6A7A] dark:text-white/50">
                      Selected: Machine #{selectedMachine}
                    </p>
                  )}
                </div>
              )}

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                  Purpose *
                </label>
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Exam preparation, Language practice…"
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.06] px-3 py-2.5 text-sm dark:text-white"
                />
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional information…"
                  className="w-full resize-none rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.06] px-3 py-2 text-sm dark:text-white"
                />
              </div>

              {error && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setBookingSlot(null)}
                  className="flex-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 py-2.5 text-sm font-semibold text-[#5A6A7A] dark:text-white/60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleConfirmBooking()}
                  className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-60"
                >
                  {submitting ? 'Booking…' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
