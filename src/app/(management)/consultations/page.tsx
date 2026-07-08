'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import ConsultationSlotForm from '@/components/consultations/ConsultationSlotForm'
import ConsultationRequestsPanel from '@/components/consultations/ConsultationRequestsPanel'
import EmptyState from '@/components/ui/EmptyState'
import {
  BOOKING_STATUS_BADGE,
  deleteConsultationSlot,
  fetchConsultationBookings,
  fetchConsultationSlots,
  fetchStaffForConsultations,
  formatConsultationDate,
  formatTimeRange,
  rejectConsultationBooking,
  type ConsultationBooking,
  type ConsultationBookingStatus,
  type ConsultationSlot,
} from '@/lib/consultations/helpers'
import type { StaffMember } from '@/types'

type Tab = 'slots' | 'bookings' | 'requests'

export default function ConsultationsPage() {
  const [tab, setTab] = useState<Tab>('slots')
  const [slots, setSlots] = useState<ConsultationSlot[]>([])
  const [bookings, setBookings] = useState<ConsultationBooking[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ConsultationBookingStatus | ''>('')
  const [dateFilter, setDateFilter] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [slotList, bookingList, staffList] = await Promise.all([
        fetchConsultationSlots(),
        fetchConsultationBookings(),
        fetchStaffForConsultations(),
      ])
      setSlots(slotList)
      setBookings(bookingList)
      setStaff(staffList)
    } catch (err) {
      console.error('[ConsultationsPage]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false
      if (dateFilter && b.date !== dateFilter) return false
      return true
    })
  }, [bookings, statusFilter, dateFilter])

  async function handleDeleteSlot(slot: ConsultationSlot) {
    if (slot.isBooked) {
      toast.error('Cannot delete a booked slot.')
      return
    }
    if (!window.confirm('Delete this consultation slot?')) return
    setActionId(slot.id)
    try {
      await deleteConsultationSlot(slot.id)
      toast.success('Slot deleted')
      await loadData()
    } catch (err) {
      console.error('[ConsultationsPage]', err)
      toast.error('Failed to delete slot.')
    } finally {
      setActionId(null)
    }
  }

  async function handleApprove(booking: ConsultationBooking) {
    setActionId(booking.id)
    try {
      const res = await fetch('/api/consultations/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      })
      if (!res.ok) throw new Error('Approve failed')
      toast.success('Booking approved')
      await loadData()
    } catch (err) {
      console.error('[ConsultationsPage]', err)
      toast.error('Failed to approve booking.')
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(booking: ConsultationBooking) {
    if (!window.confirm(`Reject booking for ${booking.studentName}?`)) return
    setActionId(booking.id)
    try {
      await rejectConsultationBooking(booking)
      toast.success('Booking rejected')
      await loadData()
    } catch (err) {
      console.error('[ConsultationsPage]', err)
      toast.error('Failed to reject booking.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Consultations</h2>
          <p className="font-inter text-sm text-[#5A6A7A] dark:text-gray-400">
            Manage slots and bookings
          </p>
        </div>
        {tab === 'slots' && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
          >
            <span className="ti ti-plus" aria-hidden="true" />
            Add Slot
          </button>
        )}
      </div>

      <div className="flex gap-1 rounded-lg border border-[#DDE3EC] bg-white p-1">
        {(
          [
            ['slots', 'Slots'],
            ['bookings', 'Bookings'],
            ['requests', 'Student Requests'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-4 py-2 font-jakarta text-sm font-semibold transition-colors ${
              tab === key
                ? 'bg-[#0B3D6B] text-white'
                : 'text-[#5A6A7A] hover:bg-[#F5F7FB]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'slots' && (
        <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-700 dark:bg-gray-800">
          {loading ? (
            <div className="h-48 animate-pulse bg-[#DDE3EC]/40 dark:bg-gray-700" />
          ) : slots.length === 0 ? (
            <EmptyState
              icon="ti-calendar-event"
              title="No consultation slots yet"
              subtitle="Create available time slots for students to book one-on-one consultations."
              actionLabel="Add Slot"
              onAction={() => setFormOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm dark:text-white/80">
                <thead>
                  <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:border-gray-700 dark:bg-gray-900">
                    {['Date', 'Time', 'Staff', 'Status', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE3EC] dark:divide-white/10">
                  {slots.map((slot) => (
                    <tr key={slot.id}>
                      <td className="px-4 py-3">{formatConsultationDate(slot.date)}</td>
                      <td className="px-4 py-3 text-[#5A6A7A]">
                        {formatTimeRange(slot.startTime, slot.endTime)}
                      </td>
                      <td className="px-4 py-3">{slot.staffName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            slot.isBooked
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {slot.isBooked ? 'Booked' : 'Available'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!slot.isBooked ? (
                          <button
                            type="button"
                            disabled={actionId === slot.id}
                            onClick={() => handleDeleteSlot(slot)}
                            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        ) : (
                          <span className="text-xs text-[#5A6A7A]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'bookings' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ConsultationBookingStatus | '')
              }
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
            />
            {(statusFilter || dateFilter) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('')
                  setDateFilter('')
                }}
                className="text-sm font-semibold text-[#0B3D6B] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-700 dark:bg-gray-800">
            {loading ? (
              <div className="h-48 animate-pulse bg-[#DDE3EC]/40 dark:bg-gray-700" />
            ) : filteredBookings.length === 0 ? (
              <EmptyState
                icon="ti-calendar-check"
                title="No bookings found"
                subtitle="Adjust filters or wait for students to book consultation slots."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm dark:text-white/80">
                  <thead>
                    <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:border-white/10 dark:bg-gray-900">
                      {[
                        'Student',
                        'Date',
                        'Time',
                        'Staff',
                        'Status',
                        'Notes',
                        'Actions',
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDE3EC] dark:divide-white/10">
                    {filteredBookings.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">
                          {b.studentName}
                        </td>
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
                        <td className="max-w-[200px] truncate px-4 py-3 text-[#5A6A7A]">
                          {b.notes || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {b.status === 'pending' ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={actionId === b.id}
                                onClick={() => handleApprove(b)}
                                className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={actionId === b.id}
                                onClick={() => handleReject(b)}
                                className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[#5A6A7A]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'requests' && <ConsultationRequestsPanel />}

      <ConsultationSlotForm
        open={formOpen}
        staff={staff}
        onClose={() => setFormOpen(false)}
        onSaved={loadData}
      />
    </div>
  )
}
