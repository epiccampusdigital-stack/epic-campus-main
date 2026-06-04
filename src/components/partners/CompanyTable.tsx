'use client'

import Link from 'next/link'
import { formatPartnerFee } from '@/lib/partners/helpers'
import type { CandidateShortlist, PartnerCompany } from '@/types'

interface CompanyTableProps {
  placements: CandidateShortlist[]
  companies: PartnerCompany[]
  loading?: boolean
  onMarkFeePaid: (candidate: CandidateShortlist) => void
}

export default function CompanyTable({
  placements,
  companies,
  loading,
  onMarkFeePaid,
}: CompanyTableProps) {
  const companyMap = new Map(companies.map((c) => [c.id, c]))

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-xl bg-[#DDE3EC]/60 dark:bg-gray-700" />
    )
  }

  if (placements.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#DDE3EC] px-6 py-12 text-center text-sm text-[#5A6A7A] dark:border-gray-600">
        No confirmed placements yet.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:border-gray-700 dark:bg-gray-900">
              {['Student', 'Company', 'Industry', 'Placed Date', 'Fee Amount', 'Fee Paid', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDE3EC] dark:divide-gray-700">
            {placements.map((p) => {
              const co = companyMap.get(p.companyId)
              const currency = co?.placementFeeCurrency ?? 'LKR'
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">
                    {p.studentName}
                  </td>
                  <td className="px-4 py-3">{p.companyName}</td>
                  <td className="px-4 py-3 text-[#5A6A7A]">{co?.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-[#5A6A7A]">
                    {p.placedAt ? p.placedAt.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0B3D6B] dark:text-white">
                    {formatPartnerFee(p.placementFee, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.feePaid
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {p.feePaid ? 'Paid' : 'Outstanding'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/students/${p.studentId}`}
                        className="text-xs font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
                      >
                        View
                      </Link>
                      {!p.feePaid && (
                        <button
                          type="button"
                          onClick={() => onMarkFeePaid(p)}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Mark paid
                        </button>
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
  )
}

export function PlacementSummaryCards({
  totalPlaced,
  feesCollected,
  feesOutstanding,
}: {
  totalPlaced: number
  feesCollected: number
  feesOutstanding: number
}) {
  const cards = [
    { label: 'Total placed', value: String(totalPlaced) },
    { label: 'Fees collected', value: String(feesCollected) },
    { label: 'Fees outstanding', value: String(feesOutstanding) },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-[#DDE3EC] border-l-[3px] border-l-[#E8A020] bg-white p-5 dark:bg-gray-800"
        >
          <p className="text-xs uppercase text-[#5A6A7A]">{c.label}</p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">
            {c.value}
          </p>
        </div>
      ))}
    </div>
  )
}
