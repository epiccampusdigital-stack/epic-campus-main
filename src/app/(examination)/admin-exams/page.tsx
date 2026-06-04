'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import AttemptDetailPanel from '@/components/exam/AttemptDetailPanel'
import JsonImporter from '@/components/exam/JsonImporter'
import ListeningQuestionsEditor from '@/components/exam/ListeningQuestionsEditor'
import PaperForm from '@/components/exam/PaperForm'
import { EXAM_MANAGEMENT_ROLES } from '@/lib/constants/roles'
import {
  countPaperQuestions,
  deleteExamPaper,
  fetchAllAttempts,
  fetchExamPapers,
  getLevelBadgeColor,
  togglePaperStatus,
} from '@/lib/exam/helpers'
import { auth, db } from '@/lib/firebase/client'
import type { ExamAttempt, ExamPaper, ExamPaperStatus, Role } from '@/types'

type Tab = 'papers' | 'results' | 'import'

export default function AdminExamsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('papers')
  const [papers, setPapers] = useState<ExamPaper[]>([])
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [statusFilter, setStatusFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [paperFilter, setPaperFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [markingFilter, setMarkingFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editPaper, setEditPaper] = useState<ExamPaper | null>(null)
  const [audioPaper, setAudioPaper] = useState<ExamPaper | null>(null)
  const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null)

  const loadData = useCallback(async () => {
    const [allPapers, allAttempts] = await Promise.all([
      fetchExamPapers(),
      fetchAllAttempts(),
    ])
    setPapers(allPapers)
    setAttempts(allAttempts)
    const counts: Record<string, number> = {}
    await Promise.all(
      allPapers.map(async (p) => {
        counts[p.id] = await countPaperQuestions(p.id)
      }),
    )
    setQuestionCounts(counts)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace('/login')
        return
      }
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
      const role = snap.data()?.role as Role
      if (!EXAM_MANAGEMENT_ROLES.includes(role)) {
        router.replace('/exams')
        return
      }
      setAuthorized(true)
      try {
        await fetch('/api/exam/seed-papers')
      } catch {
        /* seed is best-effort */
      }
      await loadData()
      setLoading(false)
    })
    return () => unsubscribe()
  }, [loadData, router])

  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (levelFilter && p.level !== levelFilter) return false
      return true
    })
  }, [papers, statusFilter, levelFilter])

  const filteredAttempts = useMemo(() => {
    return attempts.filter((a) => {
      if (paperFilter && a.paperId !== paperFilter) return false
      if (gradeFilter && a.grade !== gradeFilter) return false
      if (markingFilter === 'pending_speaking' && a.speakingScore != null) return false
      if (markingFilter && markingFilter !== 'pending_speaking' && a.markingStatus !== markingFilter) {
        return false
      }
      return true
    })
  }, [attempts, gradeFilter, markingFilter, paperFilter])

  const paperTitle = (id: string) => papers.find((p) => p.id === id)?.title ?? id

  const handleToggleStatus = async (paperId: string) => {
    await togglePaperStatus(paperId)
    await loadData()
  }

  const handleDelete = async (paperId: string) => {
    if (!confirm('Delete this paper and all its questions?')) return
    await deleteExamPaper(paperId)
    await loadData()
  }

  const handleExport = () => {
    const rows = filteredAttempts.map((a) => ({
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

  const statusLabel = (status: ExamPaperStatus) =>
    status === 'active' ? 'Published' : 'Draft'

  if (loading || !authorized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Exam Administration</h1>
        <p className="mt-1 text-sm text-[#5A6A7A]">
          Manage papers, review results, and import JSON content
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-[#DDE3EC] bg-white p-1">
        {(
          [
            ['papers', 'Papers'],
            ['results', 'Results'],
            ['import', 'Import JSON'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              tab === key
                ? 'bg-[#0B3D6B] text-white'
                : 'text-[#5A6A7A] hover:bg-[#F5F7FB]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'papers' && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
              >
                <option value="">All status</option>
                <option value="active">Published</option>
                <option value="draft">Draft</option>
              </select>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
              >
                <option value="">All levels</option>
                {['A1', 'A2', 'A2-B1', 'B1', 'N5', 'N4'].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditPaper(null)
                setFormOpen(true)
              }}
              className="rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-bold text-[#0B3D6B]"
            >
              Create New Paper
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Code</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Level</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Title</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Status</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Questions</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPapers.map((p) => (
                  <tr key={p.id} className="border-b border-[#DDE3EC]">
                    <td className="px-4 py-3 font-mono">{p.code}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getLevelBadgeColor(p.level)}`}
                      >
                        {p.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">{p.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          p.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{questionCounts[p.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditPaper(p)
                            setFormOpen(true)
                          }}
                          className="text-xs font-semibold text-[#0B3D6B] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setAudioPaper(p)}
                          className="text-xs font-semibold text-[#0B3D6B] hover:underline"
                        >
                          Listening Audio
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p.id)}
                          className="text-xs font-semibold text-[#0B3D6B] hover:underline"
                        >
                          {p.status === 'active' ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'results' && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={paperFilter}
                onChange={(e) => setPaperFilter(e.target.value)}
                className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
              >
                <option value="">All papers</option>
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
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
                value={markingFilter}
                onChange={(e) => setMarkingFilter(e.target.value)}
                className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
              >
                <option value="">All marking status</option>
                <option value="complete">Complete</option>
                <option value="partial">Partial</option>
                <option value="pending_review">Pending review</option>
                <option value="pending_speaking">Pending speaking</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg bg-[#0B3D6B] px-4 py-2 text-sm font-bold text-white"
            >
              Export Excel
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Student</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Paper</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">R</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">L</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">W</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">S</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Total</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Grade</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Date</th>
                  <th className="px-4 py-3 font-semibold text-[#0B3D6B]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((a) => {
                  const pendingSpeaking = a.speakingScore == null && a.status === 'completed'
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedAttempt(a)}
                      className={`cursor-pointer border-b border-[#DDE3EC] hover:bg-[#F5F7FB] ${
                        pendingSpeaking ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      <td className="px-4 py-3">{a.studentName}</td>
                      <td className="px-4 py-3">{a.paperCode}</td>
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
                      <td className="px-4 py-3">{a.grade ?? '—'}</td>
                      <td className="px-4 py-3">
                        {new Date(a.startedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 capitalize">{a.markingStatus.replace('_', ' ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'import' && <JsonImporter onImported={loadData} />}

      <PaperForm
        open={formOpen}
        paper={editPaper}
        onClose={() => setFormOpen(false)}
        onSaved={loadData}
      />

      {audioPaper && (
        <ListeningQuestionsEditor
          paper={audioPaper}
          open={!!audioPaper}
          onClose={() => setAudioPaper(null)}
        />
      )}

      {selectedAttempt && (
        <AttemptDetailPanel
          attempt={selectedAttempt}
          paperTitle={paperTitle(selectedAttempt.paperId)}
          onClose={() => setSelectedAttempt(null)}
          onUpdated={async () => {
            await loadData()
            setSelectedAttempt(null)
          }}
        />
      )}
    </div>
  )
}
