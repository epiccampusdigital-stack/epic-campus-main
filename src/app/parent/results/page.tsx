'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseExamAttempt } from '@/lib/student/portal'
import { isExamPassed } from '@/lib/parent/helpers'
import { useParentPortal } from '@/components/parent/ParentContext'
import type { ParsedExamAttempt } from '@/lib/student/portal'

export default function ParentResultsPage() {
  const { student } = useParentPortal()
  const [attempts, setAttempts] = useState<ParsedExamAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'examResults'), where('studentId', '==', student.id)),
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
            return parseExamAttempt(d.id, data, examTitle || 'Exam paper')
          }),
        )

        setAttempts(parsed.sort((a, b) => b.date.localeCompare(a.date)))
      } catch (err) {
        console.error('[ParentResults]', err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [student.id])

  const progress = useMemo(() => {
    if (attempts.length === 0) return 0
    const passed = attempts.filter((a) => isExamPassed(a.status)).length
    return Math.round((passed / attempts.length) * 100)
  }, [attempts])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Exam Results</h2>
        <p className="text-sm text-[#5A6A7A]">Read-only view of {student.name}&apos;s results</p>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-[#5A6A7A]">Overall progress</p>
          <p className="font-jakarta text-lg font-bold text-[#0B3D6B]">
            {loading ? '…' : `${progress}%`}
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#F5F7FB]">
          <div
            className="h-full rounded-full bg-[#E8A020] transition-all"
            style={{ width: loading ? '0%' : `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#5A6A7A]">
          {loading
            ? 'Loading…'
            : `${attempts.filter((a) => isExamPassed(a.status)).length} of ${attempts.length} papers passed`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        {loading ? (
          <p className="px-6 py-12 text-center text-sm text-[#5A6A7A]">Loading…</p>
        ) : attempts.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#5A6A7A]">
            No exam results recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  {['Paper', 'Score', 'Status', 'Date'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-[#0D1B2A]">{a.exam}</td>
                    <td className="px-4 py-3 text-[#0B3D6B]">
                      {a.total > 0 ? a.total : a.grade}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          isExamPassed(a.status)
                            ? 'bg-emerald-50 text-emerald-700'
                            : a.status === 'fail'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {a.status === 'pass'
                          ? 'Pass'
                          : a.status === 'fail'
                            ? 'Fail'
                            : a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{a.date || '—'}</td>
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
