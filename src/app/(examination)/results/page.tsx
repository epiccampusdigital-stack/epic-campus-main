'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import AttemptDetailPanel from '@/components/exam/AttemptDetailPanel'
import {
  fetchAllAttempts,
  fetchExamPapers,
  getGradeColor,
} from '@/lib/exam/helpers'
import { EXAM_ADMIN_ROLES } from '@/lib/constants/roles'
import { auth, db } from '@/lib/firebase/client'
import type { ExamAttempt, ExamPaper, Role } from '@/types'

export default function AdminResultsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [papers, setPapers] = useState<ExamPaper[]>([])
  const [paperFilter, setPaperFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<ExamAttempt | null>(null)

  const loadData = async () => {
    const [allAttempts, allPapers] = await Promise.all([
      fetchAllAttempts(),
      fetchExamPapers(),
    ])
    setAttempts(allAttempts)
    setPapers(allPapers)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace('/login')
        return
      }
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
      const role = snap.data()?.role as Role
      if (!EXAM_ADMIN_ROLES.includes(role)) {
        router.replace('/exams')
        return
      }
      setAuthorized(true)
      await loadData()
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  const filtered = useMemo(() => {
    return attempts.filter((a) => {
      if (paperFilter && a.paperId !== paperFilter) return false
      if (gradeFilter && a.grade !== gradeFilter) return false
      if (statusFilter === 'pending_speaking' && a.speakingScore != null) return false
      if (statusFilter === 'completed' && a.status !== 'completed') return false
      if (
        statusFilter &&
        !['pending_speaking', 'completed'].includes(statusFilter) &&
        a.markingStatus !== statusFilter
      ) {
        return false
      }
      return true
    })
  }, [attempts, gradeFilter, paperFilter, statusFilter])

  const paperTitle = (id: string) => papers.find((p) => p.id === id)?.title ?? id

  const handleExport = () => {
    const rows = filtered.map((a) => ({
      Student: a.studentName,
      Paper: a.paperCode,
      Date: new Date(a.startedAt).toLocaleDateString(),
      Reading: a.readingScore ?? '',
      Listening: a.listeningScore ?? '',
      Writing: a.writingScore ?? '',
      Speaking: a.speakingScore ?? 'Pending',
      Total: a.totalScore ?? '',
      Grade: a.grade ?? '',
      Status: a.markingStatus,
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Exam Results')
    XLSX.writeFile(wb, 'epic-campus-exam-results.xlsx')
  }

  if (loading || !authorized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
            Exam Results — Admin
          </h1>
          <p className="mt-1 text-sm text-[#5A6A7A]">
            All student attempts · filter, review, and export
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg bg-[#0B3D6B] px-4 py-2 text-sm font-bold text-white"
        >
          Export Excel
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={paperFilter}
          onChange={(e) => setPaperFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        >
          <option value="">All papers</option>
          {papers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.title}
            </option>
          ))}
        </select>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        >
          <option value="">All grades</option>
          {['S', 'A', 'B', 'C', 'D'].map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="completed">Completed</option>
          <option value="pending_speaking">Pending speaking review</option>
          <option value="partial">Partial marking</option>
          <option value="pending_review">Pending review</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
            <tr>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Student</th>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Paper</th>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Date</th>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">R</th>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">L</th>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">W</th>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">S</th>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Total</th>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Grade</th>
              <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const pendingSpeaking = a.speakingScore == null && a.status === 'completed'
              return (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`cursor-pointer border-b border-[#DDE3EC] hover:bg-[#F5F7FB] ${
                    pendingSpeaking ? 'bg-amber-50/60' : ''
                  }`}
                >
                  <td className="px-4 py-3">{a.studentName}</td>
                  <td className="px-4 py-3">{a.paperCode}</td>
                  <td className="px-4 py-3">
                    {new Date(a.startedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{a.readingScore ?? '—'}</td>
                  <td className="px-4 py-3">{a.listeningScore ?? '—'}</td>
                  <td className="px-4 py-3">{a.writingScore ?? '—'}</td>
                  <td className="px-4 py-3">
                    {a.speakingScore != null ? (
                      a.speakingScore
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">{a.totalScore ?? '—'}</td>
                  <td className="px-4 py-3">
                    {a.grade && (
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-bold ${getGradeColor(a.grade)}`}
                      >
                        {a.grade}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{a.markingStatus.replace('_', ' ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <AttemptDetailPanel
          attempt={selected}
          paperTitle={paperTitle(selected.paperId)}
          onClose={() => setSelected(null)}
          onUpdated={async () => {
            await loadData()
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
