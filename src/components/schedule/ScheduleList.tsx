'use client'

import { useMemo } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  countStudentsLabel,
  formatSessionDate,
  formatSessionTime,
  getBookingStatusLabel,
  getSessionTypeLabel,
  getStatusColor,
  getStatusLabel,
  isPastSession,
} from '@/lib/schedule/helpers'
import type { ScheduleSession, SessionType, Student } from '@/types'

const PAGE_SIZE = 10

interface ScheduleListProps {
  sessions: ScheduleSession[]
  students: Student[]
  loading?: boolean
  page: number
  onPageChange: (page: number) => void
  typeFilter: SessionType | ''
  courseFilter: string
  dateFrom: string
  dateTo: string
  onEdit: (session: ScheduleSession) => void
  onRefresh: () => void
}

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-[#DDE3EC]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-3 w-24 flex-1 rounded bg-[#DDE3EC]" />
          <div className="h-3 w-16 rounded bg-[#DDE3EC]" />
          <div className="hidden h-3 w-20 rounded bg-[#DDE3EC] md:block" />
        </div>
      ))}
    </div>
  )
}

export default function ScheduleList({
  sessions,
  students,
  loading,
  page,
  onPageChange,
  typeFilter,
  courseFilter,
  dateFrom,
  dateTo,
  onEdit,
  onRefresh,
}: ScheduleListProps) {
  const batchCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of students) {
      if (s.batchId) counts[s.batchId] = (counts[s.batchId] ?? 0) + 1
    }
    return counts
  }, [students])

  const filtered = useMemo(() => {
    return sessions
      .filter((s) => {
        if (typeFilter && s.type !== typeFilter) return false
        if (courseFilter && s.courseId !== courseFilter) return false
        if (dateFrom && s.date < dateFrom) return false
        if (dateTo && s.date > dateTo) return false
        return true
      })
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date)
        if (dateCmp !== 0) return dateCmp
        return a.startTime.localeCompare(b.startTime)
      })
  }, [sessions, typeFilter, courseFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleCancel(session: ScheduleSession) {
    if (!confirm('Cancel this session?')) return
    await updateDoc(doc(db, 'schedule', session.id), { status: 'cancelled' })
    onRefresh()
  }

  async function handleBookingAction(
    session: ScheduleSession,
    action: 'approved' | 'declined',
  ) {
    const payload =
      action === 'approved'
        ? { bookingStatus: 'approved' as const }
        : {
            bookingStatus: 'declined' as const,
            studentId: '',
            studentName: '',
          }
    await updateDoc(doc(db, 'schedule', session.id), payload)
    onRefresh()
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        <TableSkeleton />
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-[#DDE3EC] bg-white px-6 py-16 text-center">
        <span className="ti ti-calendar-off text-4xl text-[#DDE3EC]" aria-hidden="true" />
        <p className="mt-3 font-jakarta text-base font-semibold text-[#0B3D6B]">
          No sessions found
        </p>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
          Adjust filters or add a new session.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                {[
                  'Date',
                  'Time',
                  'Type',
                  'Course',
                  'Staff',
                  'Students',
                  'Location',
                  'Status',
                  'Actions',
                ].map((h) => (
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
              {pageItems.map((s) => {
                const past = isPastSession(s)
                const studentLabel = countStudentsLabel(s, batchCounts)

                return (
                  <tr
                    key={s.id}
                    className={`transition-colors hover:bg-[#F5F7FB]/60 ${
                      past ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-[#0D1B2A]">
                      {formatSessionDate(s.date)}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {formatSessionTime(s.startTime, s.endTime)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#0B3D6B]">
                        {getSessionTypeLabel(s.type)}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-[#5A6A7A]">
                      {s.courseName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{s.staffName || '—'}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{studentLabel}</td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-[#5A6A7A]">
                      {s.location || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(s.status)}`}
                        >
                          {getStatusLabel(s.status)}
                        </span>
                        {s.bookingStatus === 'pending' && (
                          <span className="text-[10px] font-medium text-[#E8A020]">
                            {getBookingStatusLabel('pending')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {s.bookingStatus === 'pending' && s.status === 'scheduled' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleBookingAction(s, 'approved')}
                              className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBookingAction(s, 'declined')}
                              className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {s.status !== 'cancelled' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEdit(s)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/10"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(s)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-inter text-sm text-[#5A6A7A]">
          Showing {(page - 1) * PAGE_SIZE + 1}–
          {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-sm text-[#5A6A7A] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="flex items-center px-2 font-inter text-sm text-[#5A6A7A]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-sm text-[#5A6A7A] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
