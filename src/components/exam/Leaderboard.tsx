'use client'

import { useEffect, useState } from 'react'
import { fetchLeaderboard, getGradeColor, type LeaderboardEntry } from '@/lib/exam/helpers'

const TROPHIES = ['🥇', '🥈', '🥉']

interface LeaderboardProps {
  paperId: string
  currentStudentId?: string
  title?: string
}

export default function Leaderboard({
  paperId,
  currentStudentId,
  title = 'Leaderboard',
}: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const data = await fetchLeaderboard(paperId, 10, currentStudentId)
      if (!cancelled) {
        setEntries(data)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paperId, currentStudentId])

  if (loading) {
    return (
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <p className="text-sm text-[#5A6A7A]">Loading leaderboard…</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="font-jakarta font-bold text-[#0B3D6B]">{title}</h3>
        <p className="mt-2 text-sm text-[#5A6A7A]">No completed attempts yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
      <h3 className="font-jakarta font-bold text-[#0B3D6B]">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#DDE3EC] text-xs text-[#5A6A7A]">
              <th className="pb-2 pr-3">Rank</th>
              <th className="pb-2 pr-3">Student</th>
              <th className="pb-2 pr-3">Score</th>
              <th className="pb-2 pr-3">Grade</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.attemptId}
                className={`border-b border-[#DDE3EC]/60 ${
                  e.isCurrentStudent ? 'bg-[#E8A020]/10 font-semibold' : ''
                }`}
              >
                <td className="py-2.5 pr-3">
                  {e.rank <= 3 ? TROPHIES[e.rank - 1] : `#${e.rank}`}
                </td>
                <td className="py-2.5 pr-3">{e.studentName}</td>
                <td className="py-2.5 pr-3">{e.totalScore}%</td>
                <td className="py-2.5 pr-3">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-xs font-bold ${getGradeColor(e.grade)}`}
                  >
                    {e.grade}
                  </span>
                </td>
                <td className="py-2.5 text-[#5A6A7A]">
                  {new Date(e.date).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
