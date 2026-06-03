'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseExamAttempt } from '@/lib/student/portal'
import CompletionCertificate from '@/components/student/CompletionCertificate'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { ParsedExamAttempt } from '@/lib/student/portal'

const ResultsChart = dynamic(
  () => import('@/components/student/ResultsChart'),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-[#DDE3EC]" />,
  },
)

const GRADE_LEGEND = [
  { grade: 'S', range: '90+', color: 'bg-emerald-100 text-emerald-800' },
  { grade: 'A', range: '80+', color: 'bg-blue-100 text-blue-800' },
  { grade: 'B', range: '70+', color: 'bg-amber-100 text-amber-800' },
  { grade: 'C', range: '60+', color: 'bg-orange-100 text-orange-800' },
  { grade: 'D', range: '<60', color: 'bg-red-100 text-red-800' },
]

export default function MyResultsPage() {
  const { student } = useStudentPortal()
  const [attempts, setAttempts] = useState<ParsedExamAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return

    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'examResults'), where('studentId', '==', student!.id)),
        )

        const parsed = await Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data() as Record<string, unknown>
            let examTitle = String(data.examTitle ?? '')
            if (data.examId) {
              const examSnap = await getDoc(doc(db, 'exams', String(data.examId))).catch(
                () => null,
              )
              if (examSnap?.exists()) {
                examTitle = String(examSnap.data()?.title ?? examTitle)
              }
            }
            return parseExamAttempt(d.id, data, examTitle || undefined)
          }),
        )

        setAttempts(parsed.sort((a, b) => b.date.localeCompare(a.date)))
      } catch (err) {
        console.error('[MyResults]', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [student])

  const summary = useMemo(() => {
    if (attempts.length === 0) return { avg: 0, best: 0, latest: '—' }
    const totals = attempts.map((a) => a.total)
    const avg = totals.reduce((s, t) => s + t, 0) / totals.length
    return {
      avg: Math.round(avg),
      best: Math.max(...totals),
      latest: attempts[0]?.grade ?? '—',
    }
  }, [attempts])

  if (!student) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">My Exam Results</h2>
        <p className="text-sm text-[#5A6A7A]">Track your progress across attempts</p>
      </div>

      <CompletionCertificate student={student} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <p className="text-xs uppercase text-[#5A6A7A]">Average Score</p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">
            {loading ? '…' : summary.avg || '—'}
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <p className="text-xs uppercase text-[#5A6A7A]">Best Score</p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">
            {loading ? '…' : summary.best || '—'}
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <p className="text-xs uppercase text-[#5A6A7A]">Latest Grade</p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#E8A020]">
            {loading ? '…' : summary.latest}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="mb-4 font-jakarta font-bold text-[#0B3D6B]">Score Progress</h3>
        <ResultsChart
          data={attempts
            .slice()
            .reverse()
            .map((a, i) => ({
              attempt: `#${i + 1}`,
              score: a.total,
              label: a.exam,
            }))}
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {GRADE_LEGEND.map((g) => (
          <span
            key={g.grade}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${g.color}`}
          >
            {g.grade} ({g.range})
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        {loading ? (
          <div className="h-40 animate-pulse bg-[#DDE3EC]/40" />
        ) : attempts.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#5A6A7A]">No exam results yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  {[
                    'Exam',
                    'Date',
                    'Reading',
                    'Listening',
                    'Writing',
                    'Speaking',
                    'Total',
                    'Grade',
                    'Status',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-3 font-medium text-[#0D1B2A]">{a.exam}</td>
                    <td className="px-3 py-3 text-[#5A6A7A]">{a.date || '—'}</td>
                    <td className="px-3 py-3">{a.reading ?? '—'}</td>
                    <td className="px-3 py-3">{a.listening ?? '—'}</td>
                    <td className="px-3 py-3">{a.writing ?? '—'}</td>
                    <td className="px-3 py-3">{a.speaking ?? '—'}</td>
                    <td className="px-3 py-3 font-semibold">{a.total || '—'}</td>
                    <td className="px-3 py-3 font-bold text-[#E8A020]">{a.grade}</td>
                    <td className="px-3 py-3 capitalize">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
