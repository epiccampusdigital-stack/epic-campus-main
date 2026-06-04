'use client'

import {
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_STYLES,
  privacyDisplayName,
} from '@/lib/partners/helpers'
import type { CandidateShortlist } from '@/types'

interface CandidateCardProps {
  candidate: CandidateShortlist
  acting?: boolean
  onShortlist: () => void
  onRequestInterview: () => void
  onReject: () => void
}

export default function CandidateCard({
  candidate,
  acting,
  onShortlist,
  onRequestInterview,
  onReject,
}: CandidateCardProps) {
  const displayName = privacyDisplayName(candidate.studentName)
  const canShortlist = candidate.status === 'viewing'
  const canRequest =
    candidate.status === 'shortlisted' || candidate.status === 'viewing'
  const canReject = candidate.status !== 'placed' && candidate.status !== 'rejected'

  return (
    <div className="flex flex-col rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">
            {displayName}
          </h3>
          <p className="text-xs text-[#5A6A7A]">
            {candidate.studentAge != null ? `${candidate.studentAge} yrs` : 'Age —'} ·{' '}
            {candidate.japaneseLevel ?? 'Level —'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${CANDIDATE_STATUS_STYLES[candidate.status]}`}
        >
          {CANDIDATE_STATUS_LABELS[candidate.status]}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase text-[#5A6A7A]">Exam scores</dt>
          <dd className="text-[#0D1B2A] dark:text-gray-200">
            {candidate.examScoreSummary || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[#5A6A7A]">Batch status</dt>
          <dd className="capitalize text-[#0D1B2A] dark:text-gray-200">
            {candidate.batchStatus ?? '—'}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {canShortlist && (
          <button
            type="button"
            disabled={acting}
            onClick={onShortlist}
            className="rounded-lg bg-[#0B3D6B] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Shortlist
          </button>
        )}
        {canRequest && candidate.status !== 'interview_requested' && (
          <button
            type="button"
            disabled={acting}
            onClick={onRequestInterview}
            className="rounded-lg bg-[#E8A020] px-3 py-2 text-xs font-bold text-[#0B3D6B] disabled:opacity-50"
          >
            Request Interview
          </button>
        )}
        {canReject && (
          <button
            type="button"
            disabled={acting}
            onClick={onReject}
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
          >
            Not Interested
          </button>
        )}
      </div>
    </div>
  )
}
