'use client'

import {
  formatJoinDate,
  getInitials,
  getRoleColor,
  getRoleLabel,
  getStatusColor,
  getStatusLabel,
} from '@/lib/staff/helpers'
import type { StaffMember } from '@/types'

interface StaffTableProps {
  staff: StaffMember[]
  loading?: boolean
  onView: (member: StaffMember) => void
  onEdit: (member: StaffMember) => void
  onApprove: (member: StaffMember) => void
  approvingId?: string | null
}

function Avatar({ member }: { member: StaffMember }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0B3D6B] text-sm font-bold text-white">
      {member.photoUrl ? (
        <img src={member.photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(member.displayName)
      )}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-[#DDE3EC]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-10 w-10 rounded-full bg-[#DDE3EC]" />
          <div className="h-3 w-32 flex-1 rounded bg-[#DDE3EC]" />
          <div className="hidden h-3 w-20 rounded bg-[#DDE3EC] md:block" />
          <div className="h-3 w-24 rounded bg-[#DDE3EC]" />
        </div>
      ))}
    </div>
  )
}

export function PendingStaffBanner({
  pending,
  onApprove,
  approvingId,
}: {
  pending: StaffMember[]
  onApprove: (member: StaffMember) => void
  approvingId?: string | null
}) {
  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="ti ti-alert-circle text-lg text-amber-700" aria-hidden="true" />
        <h3 className="font-jakarta text-sm font-bold text-amber-900">
          Pending approval ({pending.length})
        </h3>
      </div>
      <div className="space-y-2">
        {pending.map((member) => (
          <div
            key={member.id}
            className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <Avatar member={member} />
              <div>
                <p className="font-jakarta font-semibold text-[#0D1B2A] dark:text-white">
                  {member.displayName}
                </p>
                <p className="text-xs text-[#5A6A7A]">
                  {getRoleLabel(member.role)} · {member.email || member.phone}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onApprove(member)}
              disabled={approvingId === member.id}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
            >
              <span className="ti ti-check" aria-hidden="true" />
              {approvingId === member.id ? 'Approving…' : 'Approve'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StaffTable({
  staff,
  loading,
  onView,
  onEdit,
  onApprove,
  approvingId,
}: StaffTableProps) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        <TableSkeleton />
      </div>
    )
  }

  if (staff.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1024px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
              {[
                'Avatar',
                'Name',
                'Role',
                'Email',
                'Phone',
                'Status',
                'Join Date',
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
            {staff.map((member) => (
              <tr key={member.id} className="transition-colors hover:bg-[#F5F7FB]/60">
                <td className="px-4 py-3">
                  <Avatar member={member} />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-[#0D1B2A] dark:text-white">
                    {member.displayName}
                  </p>
                  {member.nic && (
                    <p className="text-xs text-[#5A6A7A]">{member.nic}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRoleColor(member.role)}`}
                  >
                    {getRoleLabel(member.role)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#5A6A7A]">{member.email || '—'}</td>
                <td className="px-4 py-3 text-[#5A6A7A]">{member.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(member.status)}`}
                  >
                    {getStatusLabel(member.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#5A6A7A]">
                  {member.startDate ? formatJoinDate(member.startDate) : formatJoinDate(member.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onView(member)}
                      className="rounded-lg p-2 text-[#0B3D6B] hover:bg-[#0B3D6B]/10"
                      title="View staff"
                    >
                      <span className="ti ti-eye text-lg" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(member)}
                      className="rounded-lg p-2 text-[#E8A020] hover:bg-[#E8A020]/10"
                      title="Edit staff"
                    >
                      <span className="ti ti-pencil text-lg" aria-hidden="true" />
                    </button>
                    {member.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => onApprove(member)}
                        disabled={approvingId === member.id}
                        className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                        title="Approve staff"
                      >
                        <span className="ti ti-check text-lg" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StaffTableEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DDE3EC] bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0B3D6B]/10">
        <span className="ti ti-id-badge text-3xl text-[#0B3D6B]" aria-hidden="true" />
      </div>
      <h3 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">
        No staff members yet
      </h3>
      <p className="mt-2 max-w-sm font-inter text-sm text-[#5A6A7A]">
        Invite team members and manage roles, access, and payroll details.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
      >
        <span className="ti ti-plus" aria-hidden="true" />
        Invite / Add Staff
      </button>
    </div>
  )
}

export function StaffTableMeta({
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
        Showing {from}–{to} of {total} staff
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
