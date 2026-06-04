'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import CandidateCard from '@/components/company/CandidateCard'
import { useCompanyPortal } from '@/components/company/CompanyContext'
import {
  CANDIDATE_STATUS_LABELS,
  parseCandidateShortlist,
  privacyDisplayName,
  updateCandidateShortlist,
} from '@/lib/partners/helpers'
import type { CandidateShortlist, CandidateShortlistStatus } from '@/types'

export default function CompanyCandidatesPage() {
  const { company, refresh } = useCompanyPortal()
  const [candidates, setCandidates] = useState<CandidateShortlist[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<CandidateShortlistStatus | ''>('')
  const [levelFilter, setLevelFilter] = useState('')
  const [acting, setActing] = useState<string | null>(null)

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
        snap.docs.map((d) =>
          parseCandidateShortlist(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [company])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false
      if (levelFilter && !(c.japaneseLevel ?? '').toUpperCase().includes(levelFilter.toUpperCase())) {
        return false
      }
      return true
    })
  }, [candidates, statusFilter, levelFilter])

  async function handleShortlist(c: CandidateShortlist) {
    setActing(c.id)
    try {
      await updateCandidateShortlist(c.id, { status: 'shortlisted' })
      await load()
      refresh()
    } finally {
      setActing(null)
    }
  }

  async function handleRequestInterview(c: CandidateShortlist) {
    setActing(c.id)
    try {
      await updateCandidateShortlist(c.id, { status: 'interview_requested' })
      await fetch('/api/partners/interview-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateShortlistId: c.id,
          companyId: company!.id,
          companyName: company!.name,
          studentId: c.studentId,
          studentName: c.studentName,
        }),
      })
      await load()
      refresh()
    } finally {
      setActing(null)
    }
  }

  async function handleReject(c: CandidateShortlist) {
    if (!confirm('Mark this candidate as not interested?')) return
    setActing(c.id)
    try {
      await updateCandidateShortlist(c.id, { status: 'rejected' })
      await load()
      refresh()
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Candidates</h2>
        <p className="text-sm text-[#5A6A7A]">
          Review assigned students — names are shown with privacy formatting
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as CandidateShortlistStatus | '')
          }
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {Object.entries(CANDIDATE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm"
        >
          <option value="">All levels</option>
          <option value="N5">N5</option>
          <option value="N4">N4</option>
          <option value="N3">N3</option>
          <option value="JFT">JFT</option>
          <option value="JLPT">JLPT</option>
        </select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-[#DDE3EC]/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#DDE3EC] px-6 py-16 text-center text-sm text-[#5A6A7A]">
          No candidates match your filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={{
                ...c,
                studentName: privacyDisplayName(c.studentName),
              }}
              acting={acting === c.id}
              onShortlist={() => void handleShortlist(c)}
              onRequestInterview={() => void handleRequestInterview(c)}
              onReject={() => void handleReject(c)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
