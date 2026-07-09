'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

interface ExamAttempt {
  id: string
  studentId: string
  studentName: string
  studentCode?: string
  paperId: string
  paperTitle: string
  score: number
  totalQuestions: number
  percentage: number
  timeTaken?: number
  completedAt: unknown
  status: string
  // Map of questionId → chosen option index, written by the MCQ exam engine.
  answers?: Record<string, number>
}

interface ExamPaper {
  id: string
  title: string
  categoryId?: string
  passMark?: number
}

interface QDoc {
  id: string
  questionText?: string
  questionTextJP?: string
  options: { index: number; text: string }[]
  correctIndex: number
  order?: number
}

// Only these roles may view teacher exam results.
const RESULT_ROLES = ['admin', 'owner', 'teacher', 'examCoordinator']

function formatDate(val: unknown): string {
  if (!val) return '—'
  try {
    if (typeof val === 'object' && val !== null && 'toDate' in val) {
      return (val as { toDate: () => Date }).toDate().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    }
    return new Date(String(val)).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  } catch { return '—' }
}

function formatTime(seconds?: number): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function optionLetter(index: number): string {
  return index >= 1 && index <= 26 ? String.fromCharCode(64 + index) : String(index)
}

// ── LEVEL 2 — per-student, question-by-question review (MCQ attempts) ──
function AttemptQuestionReview({
  attempt,
  paper,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  attempt: ExamAttempt
  paper?: ExamPaper
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  const [questions, setQuestions] = useState<QDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDocs(
      query(collection(db, 'examQuestions'), where('paperId', '==', attempt.paperId), orderBy('order', 'asc')),
    )
      .catch(() => getDocs(query(collection(db, 'examQuestions'), where('paperId', '==', attempt.paperId))))
      .then(snap => {
        if (cancelled) return
        setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as QDoc)))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [attempt.paperId, attempt.id])

  const answers = attempt.answers ?? {}
  let correct = 0, wrong = 0, skipped = 0
  for (const q of questions) {
    const a = answers[q.id]
    if (a === undefined) skipped++
    else if (Number(a) === Number(q.correctIndex)) correct++
    else wrong++
  }
  const passMark = paper?.passMark ?? 80
  const passed = attempt.percentage >= passMark

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#0d1a2e] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#DDE3EC] dark:border-white/[0.08] px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">{attempt.studentName}</h2>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                passed
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {passed ? '✓ Passed' : '✗ Failed'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/50">
              {attempt.paperTitle} · {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)
              {attempt.studentCode ? ` · ${attempt.studentCode}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-2xl leading-none text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50">×</button>
        </div>

        {/* Body — question-by-question */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />)}</div>
          ) : questions.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#5A6A7A] dark:text-white/50">No questions found for this paper.</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => {
                const studentAns = answers[q.id]
                const isSkipped = studentAns === undefined
                const isCorrect = !isSkipped && Number(studentAns) === Number(q.correctIndex)
                const chosenOpt = q.options.find(o => o.index === studentAns)
                const correctOpt = q.options.find(o => o.index === q.correctIndex)
                return (
                  <div key={q.id} className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">
                        <span className="text-[#5A6A7A] dark:text-white/50">Q{i + 1}.</span> {q.questionText ?? q.questionTextJP ?? '—'}
                      </p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isSkipped
                          ? 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-white/60'
                          : isCorrect
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {isSkipped ? 'SKIPPED' : isCorrect ? 'CORRECT' : 'WRONG'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {q.options.map(opt => {
                        const isCorrectOption = opt.index === q.correctIndex
                        const isChosenWrong = !isSkipped && opt.index === studentAns && !isCorrectOption
                        return (
                          <div key={opt.index} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            isCorrectOption
                              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                              : isChosenWrong
                              ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                              : 'border-[#DDE3EC] dark:border-white/[0.08]'
                          }`}>
                            <span className="font-bold text-[#5A6A7A] dark:text-white/60">{optionLetter(opt.index)}</span>
                            <span className="flex-1 text-[#0D1B2A] dark:text-white/90">{opt.text}</span>
                            {isCorrectOption && <span className="ti ti-check text-emerald-600 dark:text-emerald-400" />}
                            {isChosenWrong && <span className="ti ti-x text-red-600 dark:text-red-400" />}
                          </div>
                        )
                      })}
                    </div>
                    {!isSkipped && !isCorrect && (
                      <div className="mt-2 space-y-0.5 text-xs">
                        <p className="text-red-600 dark:text-red-400">Student answered: Option {optionLetter(Number(studentAns))} ({chosenOpt?.text ?? '—'})</p>
                        <p className="text-emerald-700 dark:text-emerald-400">Correct answer:&nbsp;&nbsp; Option {optionLetter(q.correctIndex)} ({correctOpt?.text ?? '—'})</p>
                      </div>
                    )}
                    {isSkipped && (
                      <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">Correct answer: Option {optionLetter(q.correctIndex)} ({correctOpt?.text ?? '—'})</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer — summary + student navigation */}
        <div className="border-t border-[#DDE3EC] dark:border-white/[0.08] px-5 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
            <span className="text-emerald-700 dark:text-emerald-400">Correct: {correct}</span>
            <span className="text-red-600 dark:text-red-400">Wrong: {wrong}</span>
            <span className="text-[#5A6A7A] dark:text-white/60">Skipped: {skipped}</span>
            <span className="text-[#0B3D6B] dark:text-[#E8A020]">Score: {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button type="button" disabled={!hasPrev} onClick={onPrev}
              className="flex items-center gap-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 disabled:opacity-40">
              <span className="ti ti-arrow-left" /> Previous Student
            </button>
            <button type="button" disabled={!hasNext} onClick={onNext}
              className="flex items-center gap-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 disabled:opacity-40">
              Next Student <span className="ti ti-arrow-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExamResultsPage() {
  const { user, hasRole } = useManagement()
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [papers, setPapers] = useState<ExamPaper[]>([])
  const [loading, setLoading] = useState(true)
  const [paperFilter, setPaperFilter] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all')
  // Index (into `filtered`) of the attempt whose detail modal is open, or null.
  const [detailIndex, setDetailIndex] = useState<number | null>(null)

  // Pre-filter to a paper when arrived via ?paper=<id> (e.g. from the exam manager).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('paper')
    if (p) setPaperFilter(p)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [attSnap, paperSnap] = await Promise.all([
        getDocs(query(collection(db, 'examAttempts'), orderBy('completedAt', 'desc'))).catch(() =>
          getDocs(collection(db, 'examAttempts'))
        ),
        getDocs(collection(db, 'examPapers')),
      ])
      setAttempts(attSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt)))
      setPapers(paperSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamPaper)))
    } catch (err) {
      console.error('[ExamResults]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = attempts.filter(a => {
    if (paperFilter && a.paperId !== paperFilter) return false
    if (search && !a.studentName.toLowerCase().includes(search.toLowerCase()) &&
        !a.studentCode?.toLowerCase().includes(search.toLowerCase())) return false
    const paper = papers.find(p => p.id === a.paperId)
    const passMark = paper?.passMark ?? 80
    if (statusFilter === 'passed' && a.percentage < passMark) return false
    if (statusFilter === 'failed' && a.percentage >= passMark) return false
    return true
  })

  const passMarkOf = (a: ExamAttempt) => papers.find(p => p.id === a.paperId)?.passMark ?? 80
  const totalAttempts = filtered.length
  const passedCount = filtered.filter(a => a.percentage >= passMarkOf(a)).length
  const avgScore = totalAttempts > 0
    ? Math.round(filtered.reduce((s, a) => s + a.percentage, 0) / totalAttempts)
    : 0
  const highest = totalAttempts > 0 ? Math.max(...filtered.map(a => a.percentage)) : 0
  const lowest = totalAttempts > 0 ? Math.min(...filtered.map(a => a.percentage)) : 0
  const passRate = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0

  if (!user) return null
  const allowed = RESULT_ROLES.some(r => hasRole(r as never))
  if (!allowed) {
    return (
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
        <span className="ti ti-lock text-4xl text-[#DDE3EC] dark:text-white/20" />
        <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">You don&apos;t have access to exam results.</p>
      </div>
    )
  }

  const stats = [
    { label: 'Total Attempts', value: String(totalAttempts), cls: 'text-[#0B3D6B] dark:text-white' },
    { label: 'Average', value: `${avgScore}%`, cls: 'text-[#E8A020]' },
    { label: 'Highest', value: `${highest}%`, cls: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Lowest', value: `${lowest}%`, cls: 'text-red-600 dark:text-red-400' },
    { label: 'Pass Rate', value: `${passRate}%`, cls: 'text-[#0B3D6B] dark:text-white' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Exam Results</h1>
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">
            {paperFilter
              ? `Attempts for ${papers.find(p => p.id === paperFilter)?.title ?? 'selected paper'}`
              : 'All student exam attempts and scores'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 hover:border-[#0B3D6B]"
        >
          <span className="ti ti-refresh" /> Refresh
        </button>
      </div>

      {/* Stats — average / highest / lowest / pass rate / count */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(s => (
          <div key={s.label} className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4 text-center">
            <p className={`font-jakarta text-2xl font-black ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search student name or code..."
          className="min-w-48 flex-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-4 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
        />
        <select
          value={paperFilter}
          onChange={e => setPaperFilter(e.target.value)}
          className="rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none"
        >
          <option value="">All Papers</option>
          {papers.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <div className="flex gap-2">
          {(['all', 'passed', 'failed'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl px-3 py-2 text-xs font-bold capitalize transition-all ${
                statusFilter === s
                  ? 'bg-[#E8A020] text-white'
                  : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-file-off text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">No exam results found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Paper</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Score</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">%</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Result</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Submitted</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((attempt, idx) => {
                  const paper = papers.find(p => p.id === attempt.paperId)
                  const passMark = paper?.passMark ?? 80
                  const passed = attempt.percentage >= passMark
                  return (
                    <tr key={attempt.id} className="border-b border-[#DDE3EC]/50 dark:border-white/[0.04] last:border-0 hover:bg-[#F5F7FB]/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0D1B2A] dark:text-white">{attempt.studentName}</p>
                        {attempt.studentCode && (
                          <p className="font-mono text-xs text-[#5A6A7A] dark:text-white/40">{attempt.studentCode}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#0D1B2A] dark:text-white">{attempt.paperTitle}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-[#0D1B2A] dark:text-white">
                        {attempt.score}/{attempt.totalQuestions}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                          passed
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {attempt.percentage}%
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          passed
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {passed ? '✓ Passed' : '✗ Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-[#5A6A7A] dark:text-white/40">
                        {formatTime(attempt.timeTaken)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5A6A7A] dark:text-white/40">
                        {formatDate(attempt.completedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailIndex(idx)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#0B3D6B]/30 dark:border-white/20 px-2.5 py-1.5 text-xs font-semibold text-[#0B3D6B] dark:text-white/70 hover:bg-[#0B3D6B]/[0.04] dark:hover:bg-white/[0.06]"
                        >
                          <span className="ti ti-eye" /> View Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEVEL 2 — per-student detail modal */}
      {detailIndex !== null && filtered[detailIndex] && (
        <AttemptQuestionReview
          attempt={filtered[detailIndex]}
          paper={papers.find(p => p.id === filtered[detailIndex].paperId)}
          onClose={() => setDetailIndex(null)}
          onPrev={() => setDetailIndex(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setDetailIndex(i => (i !== null && i < filtered.length - 1 ? i + 1 : i))}
          hasPrev={detailIndex > 0}
          hasNext={detailIndex < filtered.length - 1}
        />
      )}
    </div>
  )
}
