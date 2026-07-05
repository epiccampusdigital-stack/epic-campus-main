'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseExamAttempt } from '@/lib/student/portal'
import CompletionCertificate from '@/components/student/CompletionCertificate'
import EmptyState from '@/components/ui/EmptyState'
import TableSkeleton from '@/components/ui/TableSkeleton'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { ParsedExamAttempt } from '@/lib/student/portal'

const ResultsChart = dynamic(
  () => import('@/components/student/ResultsChart'),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-[#DDE3EC] dark:bg-white/10" />,
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
  const { student, user } = useStudentPortal()
  const [attempts, setAttempts] = useState<ParsedExamAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [certLoading, setCertLoading] = useState(false)
  const [certNumber, setCertNumber] = useState<string | null>(null)

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
              const examSnap = await getDoc(
                doc(db, 'examPapers', String(data.examId)),
              ).catch(() => null)
              if (examSnap?.exists()) {
                examTitle = String(examSnap.data()?.title ?? examTitle)
              } else {
                const legacySnap = await getDoc(doc(db, 'exams', String(data.examId))).catch(
                  () => null,
                )
                if (legacySnap?.exists()) {
                  examTitle = String(legacySnap.data()?.title ?? examTitle)
                }
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

  async function downloadCertificate() {
    if (!user) return
    setCertLoading(true)
    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: user.uid }),
      })
      const data = await res.json() as { success?: boolean; pdfBase64?: string; certificateNumber?: string; error?: string }
      if (data.pdfBase64) {
        const bytes = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `EPIC-Certificate-${data.certificateNumber ?? 'certificate'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setCertNumber(data.certificateNumber ?? null)
      } else {
        alert(data.error ?? 'Could not generate certificate')
      }
    } catch (err) {
      console.error('[DownloadCert]', err)
    } finally {
      setCertLoading(false)
    }
  }

  if (!student) return null

  function getGradeDarkClasses(grade: string): string {
    switch (grade) {
      case 'S':
        return 'dark:bg-emerald-900/40 dark:text-emerald-300'
      case 'A':
        return 'dark:bg-blue-900/40 dark:text-blue-300'
      case 'B':
        return 'dark:bg-amber-900/40 dark:text-amber-300'
      case 'C':
        return 'dark:bg-orange-900/40 dark:text-orange-300'
      case 'D':
        return 'dark:bg-red-900/40 dark:text-red-300'
      default:
        return ''
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">My Exam Results</h2>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">Track your progress across attempts</p>
      </div>

      <CompletionCertificate student={student} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
          <p className="text-xs uppercase text-[#5A6A7A] dark:text-white/50">Average Score</p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">
            {loading ? '…' : summary.avg || '—'}
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
          <p className="text-xs uppercase text-[#5A6A7A] dark:text-white/50">Best Score</p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">
            {loading ? '…' : summary.best || '—'}
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
          <p className="text-xs uppercase text-[#5A6A7A] dark:text-white/50">Latest Grade</p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#E8A020]">
            {loading ? '…' : summary.latest}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
        <h3 className="mb-4 font-jakarta font-bold text-[#0B3D6B] dark:text-[#E8A020]">Score Progress</h3>
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
            className={`rounded-full px-3 py-1 text-xs font-semibold ${g.color} ${getGradeDarkClasses(
              g.grade,
            )}`}
          >
            {g.grade} ({g.range})
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04]">
        {loading ? (
          <TableSkeleton rows={5} />
        ) : attempts.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon="ti-certificate"
              title="No exam results yet"
              subtitle="No exam results yet. Start your first exam to see results here."
            />
            <div className="mt-4 text-center">
              <Link
                href="/exams"
                className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
              >
                <span className="ti ti-writing" aria-hidden="true" />
                Take Exam
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.03]">
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
                      className="px-3 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
                {attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F5F7FB]/40 dark:hover:bg-white/[0.03]">
                    <td className="px-3 py-3 font-medium text-[#0D1B2A] dark:text-white">{a.exam}</td>
                    <td className="px-3 py-3 text-[#5A6A7A] dark:text-white/50">{a.date || '—'}</td>
                    <td className="px-3 py-3 dark:text-white">{a.reading ?? '—'}</td>
                    <td className="px-3 py-3 dark:text-white">{a.listening ?? '—'}</td>
                    <td className="px-3 py-3 dark:text-white">{a.writing ?? '—'}</td>
                    <td className="px-3 py-3 dark:text-white">{a.speaking ?? '—'}</td>
                    <td className="px-3 py-3 font-semibold dark:text-white">{a.total || '—'}</td>
                    <td className="px-3 py-3 font-bold text-[#E8A020]">{a.grade}</td>
                    <td className="px-3 py-3 capitalize dark:text-white">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8A020]/10">
            <span className="ti ti-certificate text-[#E8A020] text-xl" />
          </div>
          <div>
            <p className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Course Certificate</p>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50">Download your completion certificate</p>
          </div>
        </div>
        {certNumber && (
          <div className="mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 px-4 py-2">
            <p className="text-xs font-bold text-emerald-700">Certificate: {certNumber}</p>
          </div>
        )}
        <button
          type="button"
          disabled={certLoading}
          onClick={() => void downloadCertificate()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B] disabled:opacity-40"
        >
          {certLoading
            ? <><span className="ti ti-loader animate-spin" /> Generating...</>
            : <><span className="ti ti-download" /> Download Certificate</>
          }
        </button>
      </div>
    </div>
  )
}
