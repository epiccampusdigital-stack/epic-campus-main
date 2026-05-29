'use client'

import {
  formatAttendanceDate,
  formatSessionTime,
  getStatusColor,
  getStatusLabel,
} from '@/lib/attendance/helpers'
import type { AttendanceRecord } from '@/types'

interface AttendanceTableProps {
  records: AttendanceRecord[]
  loading?: boolean
  onEdit: (record: AttendanceRecord) => void
}

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-[#DDE3EC]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-3 w-28 flex-1 rounded bg-[#DDE3EC]" />
          <div className="hidden h-3 w-20 rounded bg-[#DDE3EC] md:block" />
          <div className="h-3 w-16 rounded bg-[#DDE3EC]" />
          <div className="h-3 w-24 rounded bg-[#DDE3EC]" />
        </div>
      ))}
    </div>
  )
}

export default function AttendanceTable({
  records,
  loading,
  onEdit,
}: AttendanceTableProps) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        <TableSkeleton />
      </div>
    )
  }

  if (records.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
              {[
                'Student Name',
                'Course',
                'Batch',
                'Status',
                'Session Time',
                'Notes',
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
            {records.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-[#F5F7FB]/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-[#0D1B2A]">{r.studentName}</p>
                  {r.studentCode && (
                    <p className="text-xs text-[#5A6A7A]">{r.studentCode}</p>
                  )}
                </td>
                <td className="max-w-[160px] truncate px-4 py-3 text-[#5A6A7A]">
                  {r.courseName || '—'}
                </td>
                <td className="px-4 py-3 text-[#5A6A7A]">{r.batchName || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(r.status)}`}
                  >
                    {getStatusLabel(r.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#5A6A7A]">
                  {formatSessionTime(r.sessionStart, r.sessionEnd)}
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 text-[#5A6A7A]">
                  {r.notes || '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    className="rounded-lg p-2 text-[#E8A020] hover:bg-[#E8A020]/10"
                    title="Edit attendance"
                  >
                    <span className="ti ti-pencil text-lg" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AttendanceTableEmpty({ onMark }: { onMark: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DDE3EC] bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0B3D6B]/10">
        <span className="ti ti-calendar-check text-3xl text-[#0B3D6B]" aria-hidden="true" />
      </div>
      <h3 className="font-jakarta text-lg font-bold text-[#0D1B2A]">No attendance records</h3>
      <p className="mt-2 max-w-sm font-inter text-sm text-[#5A6A7A]">
        Mark attendance for a course batch to start tracking present, absent, and late
        students.
      </p>
      <button
        type="button"
        onClick={onMark}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
      >
        <span className="ti ti-plus" aria-hidden="true" />
        Mark Attendance
      </button>
    </div>
  )
}

export function AttendanceTableMeta({
  total,
  page,
  pageSize,
  onPageChange,
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="font-inter text-sm text-[#5A6A7A]">
        Showing {from}–{to} of {total} records
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-40"
        >
          Previous
        </button>
        <span className="font-inter text-sm text-[#5A6A7A]">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export { formatAttendanceDate }
