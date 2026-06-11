'use client'

import {
  formatContactDate,
  getCourseLabel,
  getRecommendedPathLabel,
  getSourceLabel,
  getStatusColor,
  getStatusLabel,
} from '@/lib/crm/helpers'
import type { Lead } from '@/types'

const PAGE_SIZE = 10

interface LeadTableProps {
  leads: Lead[]
  loading?: boolean
  page: number
  onPageChange: (page: number) => void
  onEdit: (lead: Lead) => void
}

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-[#DDE3EC]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4">
          <div className="h-3 w-32 flex-1 rounded bg-[#DDE3EC]" />
          <div className="h-3 w-20 rounded bg-[#DDE3EC]" />
        </div>
      ))}
    </div>
  )
}

export default function LeadTable({
  leads,
  loading,
  page,
  onPageChange,
  onEdit,
}: LeadTableProps) {
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE))
  const pageItems = leads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        <TableSkeleton />
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-[#DDE3EC] bg-white px-6 py-16 text-center">
        <span className="ti ti-users text-4xl text-[#DDE3EC]" aria-hidden="true" />
        <p className="mt-3 font-jakarta text-base font-semibold text-[#0B3D6B]">
          No leads found
        </p>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
          Adjust filters or add a new lead.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                {[
                  'Name',
                  'Phone',
                  'Email',
                  'Course Interest',
                  'Source',
                  'Agent',
                  'Status',
                  'Last Contact',
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
              {pageItems.map((lead) => (
                <tr
                  key={lead.id}
                  className="transition-colors hover:bg-[#F5F7FB]/60"
                >
                  <td className="px-4 py-3 font-medium text-[#0D1B2A]">
                    <div className="flex flex-wrap items-center gap-2">
                      {lead.name}
                      {lead.source === 'destination-picker' && (
                        <span className="rounded-full border border-[#E8A020]/40 bg-[#E8A020]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0B3D6B]">
                          Quiz Lead
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#5A6A7A]">{lead.phone}</td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-[#5A6A7A]">
                    {lead.email || '—'}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3 text-[#5A6A7A]">
                    <div>
                      {getCourseLabel(lead.courseId)}
                      {lead.source === 'destination-picker' && lead.recommendedPath && (
                        <p className="mt-0.5 text-[10px] font-semibold text-[#E8A020]">
                          → {getRecommendedPathLabel(lead.recommendedPath)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#5A6A7A]">
                    {getSourceLabel(lead.source)}
                  </td>
                  <td className="px-4 py-3 text-[#5A6A7A]">
                    {lead.agentName || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(lead.status)}`}
                    >
                      {getStatusLabel(lead.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#5A6A7A]">
                    {formatContactDate(lead.lastContact)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onEdit(lead)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/10"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-inter text-sm text-[#5A6A7A]">
          Showing {(page - 1) * PAGE_SIZE + 1}–
          {Math.min(page * PAGE_SIZE, leads.length)} of {leads.length}
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
