'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import {
  fetchAllAttempts,
  fetchExamPapers,
  getGradeColor,
  updateSpeakingScore,
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
  const [speakingInput, setSpeakingInput] = useState('')
  const [saving, setSaving] = useState(false)

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
      const [allAttempts, allPapers] = await Promise.all([
        fetchAllAttempts(),
        fetchExamPapers(),
      ])
      setAttempts(allAttempts)
      setPapers(allPapers)
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
      return true
    })
  }, [attempts, gradeFilter, paperFilter, statusFilter])

  const paperTitle = (id: string) =>
    papers.find((p) => p.id === id)?.title ?? id

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
      Status: a.status,
    }))
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, sheet, 'Exam Results')
    XLSX.writeFile(wb, 'epic-campus-exam-results.xlsx')
  }

  const handleSaveSpeaking = async () => {
    if (!selected || saving) return
    const score = Number(speakingInput)
    if (Number.isNaN(score) || score < 0 || score > 100) return
    setSaving(true)
    try {
      await updateSpeakingScore(selected.id, score)
      const updated = await fetchAllAttempts()
      setAttempts(updated)
      setSelected({ ...selected, speakingScore: score })
    } finally {
      setSaving(false)
    }
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
            All student attempts · filter and export
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
                  onClick={() => {
                    setSelected(a)
                    setSpeakingInput(a.speakingScore != null ? String(a.speakingScore) : '')
                  }}
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
                      <span className="text-amber-700">Pending</span>
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
                  <td className="px-4 py-3 capitalize">{a.status.replace('_', ' ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="mt-6 rounded-xl border border-[#DDE3EC] bg-white p-6">
          <h2 className="font-jakarta font-bold text-[#0B3D6B]">Attempt detail</h2>
          <p className="mt-1 text-sm text-[#5A6A7A]">
            {selected.studentName} · {paperTitle(selected.paperId)} ·{' '}
            {new Date(selected.startedAt).toLocaleString()}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-[#5A6A7A]">Reading</p>
              <p className="font-bold">{selected.readingScore ?? '—'}%</p>
            </div>
            <div>
              <p className="text-xs text-[#5A6A7A]">Listening</p>
              <p className="font-bold">{selected.listeningScore ?? '—'}%</p>
            </div>
            <div>
              <p className="text-xs text-[#5A6A7A]">Writing</p>
              <p className="font-bold">{selected.writingScore ?? '—'}%</p>
            </div>
            <div>
              <p className="text-xs text-[#5A6A7A]">Speaking</p>
              <p className="font-bold">
                {selected.speakingScore != null ? `${selected.speakingScore}%` : 'Pending'}
              </p>
            </div>
          </div>
          {selected.speakingScore == null && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-medium text-[#5A6A7A]">
                  Mark speaking score (0–100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={speakingInput}
                  onChange={(e) => setSpeakingInput(e.target.value)}
                  className="mt-1 block w-32 rounded-lg border border-[#DDE3EC] px-3 py-2"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveSpeaking}
                className="rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save speaking score'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
