'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useCompanyPortal } from '@/components/company/CompanyContext'
import {
  CANDIDATE_STATUS_LABELS,
  parseCandidateShortlist,
  privacyDisplayName,
} from '@/lib/partners/helpers'
import type { CandidateShortlist, CandidateShortlistStatus } from '@/types'

export default function CompanyDashboardPage() {
  const { company } = useCompanyPortal()
  const [candidates, setCandidates] = useState<CandidateShortlist[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!company) return
    setLoading(true)
    try {
      const snap = await getDocs(
        query(
          collection(db, 'candidateShortlists'),
          where('companyId', '==', company.id),
        ),
      )
      setCandidates(
        snap.docs
          .map((d) => parseCandidateShortlist(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      )
    } finally {
      setLoading(false)
    }
  }, [company])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const count = (s: CandidateShortlistStatus) =>
      candidates.filter((c) => c.status === s).length
    return {
      viewing: count('viewing'),
      shortlisted: count('shortlisted'),
      interviews:
        count('interview_requested') + count('interview_confirmed'),
      placed: count('placed'),
    }
  }, [candidates])

  const recent = candidates.slice(0, 8)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">
          Welcome, {company?.name}
        </h2>
        <p className="text-sm text-[#5A6A7A]">Japanese partner candidate pipeline</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Viewing', value: stats.viewing },
          { label: 'Shortlisted', value: stats.shortlisted },
          { label: 'Interviews', value: stats.interviews },
          { label: 'Placed', value: stats.placed },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[#DDE3EC] border-l-[3px] border-l-[#E8A020] bg-white p-4"
          >
            <p className="text-xs uppercase text-[#5A6A7A]">{s.label}</p>
            <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">
              {loading ? '…' : s.value}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-[#DDE3EC] bg-white">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-5 py-4">
          <h3 className="font-jakarta font-bold text-[#0B3D6B]">Recent activity</h3>
          <Link
            href="/company/candidates"
            className="text-sm font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
          >
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="h-32 animate-pulse bg-[#DDE3EC]/30" />
        ) : recent.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#5A6A7A]">No candidates assigned yet.</p>
        ) : (
          <ul className="divide-y divide-[#DDE3EC]">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-[#0D1B2A]">
                    {privacyDisplayName(c.studentName)}
                  </p>
                  <p className="text-xs text-[#5A6A7A]">
                    {CANDIDATE_STATUS_LABELS[c.status]} · {c.updatedAt.slice(0, 10)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
