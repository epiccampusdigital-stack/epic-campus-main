'use client'

import Link from 'next/link'
import { COURSE_MAP } from '@/lib/constants/courses'
import {
  STATUS_STYLES,
  getInitials,
  formatDate,
} from '@/lib/students/helpers'
import type { Student } from '@/types'

interface StudentTableProps {
  students: Student[]
  loading?: boolean
  onEdit: (student: Student) => void
}

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-[#DDE3EC]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-[#DDE3EC]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-[#DDE3EC]" />
            <div className="h-2 w-24 rounded bg-[#DDE3EC]" />
          </div>
          <div className="hidden h-6 w-20 rounded-full bg-[#DDE3EC] md:block" />
          <div className="hidden h-3 w-16 rounded bg-[#DDE3EC] sm:block" />
        </div>
      ))}
    </div>
  )
}

function Avatar({ student }: { student: Student }) {
  if (student.photoUrl) {
    return (
      <img
        src={student.photoUrl}
        alt={student.name}
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[#DDE3EC]"
      />
    )
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-bold text-white">
      {getInitials(student.name)}
    </div>
  )
}

export default function StudentTable({
  students,
  loading,
  onEdit,
}: StudentTableProps) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        <TableSkeleton />
      </div>
    )
  }

  if (students.length === 0) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
              <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
                Student
              </th>
              <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
                Course
              </th>
              <th className="hidden px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] sm:table-cell">
                Batch
              </th>
              <th className="hidden px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] md:table-cell">
                Phone
              </th>
              <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
                Status
              </th>
              <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDE3EC]">
            {students.map((student) => {
              const course = COURSE_MAP[student.courseId]
              return (
                <tr key={student.id} className="transition-colors hover:bg-[#F5F7FB]/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar student={student} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#0D1B2A]">
                          {student.name}
                        </p>
                        <p className="truncate text-xs text-[#5A6A7A]">
                          {student.studentCode}
                          {student.email ? ` · ${student.email}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE3EC] bg-white px-2.5 py-1 text-xs font-medium text-[#0B3D6B]">
                      <span>{course?.flag}</span>
                      <span className="max-w-[120px] truncate">{course?.label ?? student.courseId}</span>
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-[#5A6A7A] sm:table-cell">
                    {student.batchId || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-[#5A6A7A] md:table-cell">
                    {student.mobile || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[student.status]}`}
                    >
                      {student.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/students/${student.id}`}
                        className="rounded-lg p-2 text-[#0B3D6B] transition-colors hover:bg-[#0B3D6B]/10"
                        title="View profile"
                      >
                        <span className="ti ti-eye text-lg" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEdit(student)}
                        className="rounded-lg p-2 text-[#E8A020] transition-colors hover:bg-[#E8A020]/10"
                        title="Edit student"
                      >
                        <span className="ti ti-pencil text-lg" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StudentTableEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DDE3EC] bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0B3D6B]/10">
        <span className="ti ti-users text-3xl text-[#0B3D6B]" aria-hidden="true" />
      </div>
      <h3 className="font-jakarta text-lg font-bold text-[#0D1B2A]">No students yet</h3>
      <p className="mt-2 max-w-sm font-inter text-sm text-[#5A6A7A]">
        Add your first student to start managing enrollments, payments, and visa tracking.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942]"
      >
        <span className="ti ti-plus" aria-hidden="true" />
        Add Student
      </button>
    </div>
  )
}

export function StudentTableMeta({
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
        Showing {from}–{to} of {total} students
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] disabled:opacity-40 hover:bg-[#F5F7FB]"
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
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] disabled:opacity-40 hover:bg-[#F5F7FB]"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export { formatDate }
