'use client'

import { getGradeColor } from '@/lib/exam/helpers'

interface ResultCardProps {
  label: string
  score: number | null | undefined
  pending?: boolean
}

export default function ResultCard({ label, score, pending }: ResultCardProps) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-4">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
        {label}
      </p>
      {pending ? (
        <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
          Pending review
        </span>
      ) : (
        <>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">
            {score ?? 0}%
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F5F7FB]">
            <div
              className="h-full rounded-full bg-[#0B3D6B] transition-all"
              style={{ width: `${Math.min(100, score ?? 0)}%` }}
            />
          </div>
        </>
      )}
    </div>
  )
}

export function GradeBadge({ grade, size = 'lg' }: { grade: string; size?: 'lg' | 'sm' }) {
  const cls = getGradeColor(grade)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl border font-jakarta font-bold ${cls} ${
        size === 'lg' ? 'h-20 w-20 text-4xl' : 'h-10 w-10 text-lg'
      }`}
    >
      {grade}
    </span>
  )
}
