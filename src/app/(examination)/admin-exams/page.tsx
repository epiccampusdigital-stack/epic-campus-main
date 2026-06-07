'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import AttemptDetailPanel from '@/components/exam/AttemptDetailPanel'
import JsonImporter from '@/components/exam/JsonImporter'
import ListeningQuestionsEditor from '@/components/exam/ListeningQuestionsEditor'
import PaperForm from '@/components/exam/PaperForm'
import QuestionEditor from '@/components/exam/QuestionEditor'
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

type Tab = 'papers' | 'results' | 'import' | 'resources'

// ── Irodori topics ────────────────────────────────────────────────────────────

const IRODORI_TOPICS = [
  { id: 'topic1', jp: 'はじめての日本語', en: 'Greetings, hiragana', lessons: 'L1–2' },
  { id: 'topic2', jp: '私のこと', en: 'Self-introduction, family', lessons: 'L3–4' },
  { id: 'topic3', jp: '好きな食べ物', en: 'Food preferences, ordering', lessons: 'L5–6' },
  { id: 'topic4', jp: '家と職場', en: 'Home and workplace', lessons: 'L7–8' },
  { id: 'topic5', jp: '毎日の生活', en: 'Daily life, schedule', lessons: 'L9–10' },
  { id: 'topic6', jp: '私の好きなこと', en: 'Hobbies, invitations', lessons: 'L11–12' },
  { id: 'topic7', jp: '街を歩く', en: 'Transport, directions', lessons: 'L13–14' },
  { id: 'topic8', jp: '店で', en: 'Shopping, prices', lessons: 'L15–16' },
  { id: 'topic9', jp: '休みの日に', en: 'Holidays, past/future', lessons: 'L17–18' },
]

const GRAMMAR_N5 = [
  'は / が (topic vs. subject particles)',
  'です / ます (polite form)',
  'て-form (connecting verbs)',
  'ない-form (negative)',
  '〜たい (want to do)',
  '〜ている (ongoing action)',
  'ことができる (can do)',
  '〜てください (please do)',
  '〜てもいいですか (may I?)',
  '〜なければなりません (must do)',
  '〜ないでください (please don\'t)',
  'と思います (I think that…)',
  'から (because / from)',
  'まで (until / to)',
  'より (than)',
  'いちばん (the most)',
  'どんな (what kind of)',
  'どうやって (how to)',
  'どのくらい (how long/much)',
  '〜たことがあります (have done before)',
  '〜ましょう (let\'s)',
  '〜ませんか (won\'t you?)',
  '〜すぎる (too much)',
  '〜やすい / 〜にくい (easy / hard to)',
  '〜ながら (while doing)',
  '〜でしょう (probably)',
  '〜かもしれません (might)',
  '〜はずです (should be)',
  '〜ようです (seems like)',
  '〜そうです (looks like / I heard)',
]

const VOCAB_CATEGORIES = [
  'Greetings & daily expressions',
  'Numbers & counting',
  'Time — hours, minutes, days',
  'Days of the week & months',
  'Family members',
  'Body parts',
  'Food & drink',
  'Transport (bus, train, car)',
  'Location words (here, there, left, right)',
  'Colors',
  'Basic い-adjectives & な-adjectives',
  'Core verbs (top 50 — eat, go, see, do…)',
]

const WRITING_TIPS = [
  'Keep passages under 50 characters for A1 level',
  'Use bilingual instructions for beginner students',
  'Include romaji alongside hiragana for early learners',
  '4 options: 1 correct answer + 3 plausible distractors',
  'Avoid double negatives in question stems',
  'Test exactly one grammar/vocabulary concept per question',
  'Listening audio should be under 30 seconds for A1',
  'Speaking prompts should be simple, everyday situations',
  'Writing tasks should use vocabulary students have studied',
  'Always test comprehension, not just memory',
]

// ── AI generator state type ───────────────────────────────────────────────────

interface GeneratedQuestion {
  questionNumber?: number
  taskNumber?: number
  partNumber?: number
  passageText?: string
  passageContext?: string
  questionText?: string
  transcript?: string
  instruction?: string
  promptText?: string
  options?: string[]
  correctAnswer?: string
  explanation?: string
  taskType?: string
  promptType?: string
  minimumCharacters?: number
  maximumCharacters?: number
  exampleAnswer?: string
  japaneseCue?: string
  preparationTime?: number
  speakingTime?: number
}

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
  const [questionEditorPaper, setQuestionEditorPaper] = useState<ExamPaper | null>(null)
  const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null)

  // AI generator state
  const [aiTopic, setAiTopic] = useState('topic1')
  const [aiLevel, setAiLevel] = useState('A1')
  const [aiSection, setAiSection] = useState('reading')
  const [aiCount, setAiCount] = useState(5)
  const [aiLanguage, setAiLanguage] = useState('bilingual')
  const [aiTargetPaper, setAiTargetPaper] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiResults, setAiResults] = useState<GeneratedQuestion[]>([])
  const [aiError, setAiError] = useState('')
  const [aiSavingIdx, setAiSavingIdx] = useState<number | null>(null)

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

  // ── AI generator ────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setAiGenerating(true)
    setAiError('')
    setAiResults([])
    try {
      const res = await fetch('/api/exam/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, level: aiLevel, section: aiSection, count: aiCount, language: aiLanguage }),
      })
      const data = await res.json() as { questions?: GeneratedQuestion[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Generation failed')
      setAiResults(data.questions ?? [])
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setAiGenerating(false)
    }
  }

  async function handleAddToPaper(q: GeneratedQuestion, idx: number) {
    if (!aiTargetPaper) { alert('Select a paper first'); return }
    setAiSavingIdx(idx)
    try {
      const id = `ai-${aiSection}-${Date.now()}`
      const sub =
        aiSection === 'reading' ? 'readingQuestions' :
        aiSection === 'listening' ? 'listeningQuestions' :
        aiSection === 'writing' ? 'writingTasks' : 'speakingPrompts'
      await setDoc(doc(db, 'examPapers', aiTargetPaper, sub, id), { id, ...q })
      setAiResults((prev) => prev.filter((_, i) => i !== idx))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setAiSavingIdx(null)
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
      <div className="mb-6">
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Exam Administration</h1>
        <p className="mt-1 text-sm text-[#5A6A7A]">
          Manage papers, review results, and import JSON content
        </p>
      </div>

      <div className="flex gap-0 border-b border-gray-200 bg-white mb-6">
        {(
          [
            ['papers', 'Papers'],
            ['results', 'Results'],
            ['import', 'Import JSON'],
            ['resources', 'Resources'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer
              ${tab === key
                ? 'border-[#E8A020] text-[#0B3D6B]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Papers tab ─────────────────────────────────────────────────────── */}
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
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => { setEditPaper(null); setFormOpen(true) }}
              className="bg-[#0B3D6B] text-white rounded-[7px] px-4 py-2 text-sm font-medium hover:bg-[#0B3D6B]/90 transition-colors"
            >
              Create New Paper
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
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
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getLevelBadgeColor(p.level)}`}>
                        {p.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">{p.title}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                        p.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{questionCounts[p.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setEditPaper(p); setFormOpen(true) }}
                          className="text-xs font-semibold text-[#0B3D6B] hover:underline">
                          Edit
                        </button>
                        <button type="button" onClick={() => setQuestionEditorPaper(p)}
                          className="text-xs font-semibold text-[#0B3D6B] hover:underline">
                          Edit Questions
                        </button>
                        <button type="button" onClick={() => setAudioPaper(p)}
                          className="text-xs font-semibold text-[#0B3D6B] hover:underline">
                          Listening Audio
                        </button>
                        <button type="button" onClick={() => handleToggleStatus(p.id)}
                          className="text-xs font-semibold text-[#0B3D6B] hover:underline">
                          {p.status === 'active' ? 'Unpublish' : 'Publish'}
                        </button>
                        <button type="button" onClick={() => handleDelete(p.id)}
                          className="text-xs font-semibold text-red-600 hover:underline">
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

      {/* ── Results tab ────────────────────────────────────────────────────── */}
      {tab === 'results' && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <select value={paperFilter} onChange={(e) => setPaperFilter(e.target.value)}
                className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
                <option value="">All papers</option>
                {papers.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </select>
              <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}
                className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
                <option value="">All grades</option>
                {['S', 'A', 'B', 'C', 'D'].map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
              <select value={markingFilter} onChange={(e) => setMarkingFilter(e.target.value)}
                className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
                <option value="">All marking status</option>
                <option value="complete">Complete</option>
                <option value="partial">Partial</option>
                <option value="pending_review">Pending review</option>
                <option value="pending_speaking">Pending speaking</option>
              </select>
            </div>
            <button type="button" onClick={handleExport}
              className="bg-[#0B3D6B] text-white rounded-[7px] px-4 py-2 text-sm font-medium hover:bg-[#0B3D6B]/90 transition-colors">
              Export Excel
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                <tr>
                  {['Student','Paper','R','L','W','S','Total','Grade','Date','Status'].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold text-[#0B3D6B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((a) => {
                  const pendingSpeaking = a.speakingScore == null && a.status === 'completed'
                  return (
                    <tr key={a.id} onClick={() => setSelectedAttempt(a)}
                      className={`cursor-pointer border-b border-[#DDE3EC] hover:bg-[#F5F7FB] ${pendingSpeaking ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-4 py-3">{a.studentName}</td>
                      <td className="px-4 py-3">{a.paperCode}</td>
                      <td className="px-4 py-3">{a.readingScore ?? '—'}</td>
                      <td className="px-4 py-3">{a.listeningScore ?? '—'}</td>
                      <td className="px-4 py-3">{a.writingScore ?? '—'}</td>
                      <td className="px-4 py-3">
                        {a.speakingScore != null ? a.speakingScore : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">{a.totalScore ?? '—'}</td>
                      <td className="px-4 py-3">{a.grade ?? '—'}</td>
                      <td className="px-4 py-3">{new Date(a.startedAt).toLocaleDateString()}</td>
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

      {/* ── Resources tab ──────────────────────────────────────────────────── */}
      {tab === 'resources' && (
        <div className="space-y-8">

          {/* Reference cards grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* Card 1: N5 Grammar */}
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">📖</span>
                <h3 className="font-jakarta font-bold text-[#0B3D6B]">JLPT N5 Grammar Points</h3>
              </div>
              <p className="mb-3 text-xs text-[#5A6A7A]">30 most common N5 grammar patterns</p>
              <ul className="space-y-1.5">
                {GRAMMAR_N5.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#0B3D6B]/10 text-[9px] font-bold text-[#0B3D6B]">
                      {i + 1}
                    </span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2: N5 Vocabulary */}
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">📝</span>
                <h3 className="font-jakarta font-bold text-[#0B3D6B]">JLPT N5 Vocabulary Categories</h3>
              </div>
              <p className="mb-3 text-xs text-[#5A6A7A]">Essential vocabulary groups for N5 preparation</p>
              <ul className="space-y-2">
                {VOCAB_CATEGORIES.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-[#E8A020]">✦</span>
                    {c}
                  </li>
                ))}
              </ul>

              <div className="mt-5 border-t border-[#DDE3EC] pt-4">
                <h4 className="mb-2 text-xs font-semibold text-[#0B3D6B]">Question Writing Tips</h4>
                <ul className="space-y-1.5">
                  {WRITING_TIPS.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="mt-0.5 text-green-500 flex-shrink-0">✓</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Card 3: Irodori Topics */}
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">🎌</span>
                <h3 className="font-jakarta font-bold text-[#0B3D6B]">Irodori A1 — Book 1 Topics</h3>
              </div>
              <p className="mb-3 text-xs text-[#5A6A7A]">9 topics · 18 lessons · Starter A1</p>
              <div className="space-y-2">
                {IRODORI_TOPICS.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border border-[#DDE3EC] px-3 py-2">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#0B3D6B]/10 text-[11px] font-bold text-[#0B3D6B]">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 font-['Noto_Sans_JP']">{t.jp}</p>
                      <p className="text-[11px] text-gray-400">{t.en} · {t.lessons}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 4: Question Writing Tips (standalone) */}
            <div className="rounded-xl border border-[#E8A020]/30 bg-[#E8A020]/[0.04] p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">💡</span>
                <h3 className="font-jakarta font-bold text-[#0B3D6B]">Question Writing Tips</h3>
              </div>
              <p className="mb-3 text-xs text-[#5A6A7A]">Best practices for A1-level exam questions</p>
              <ul className="space-y-2.5">
                {WRITING_TIPS.map((tip, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-lg bg-white px-3 py-2.5 text-sm text-gray-700">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#E8A020]/20 text-[10px] font-bold text-[#E8A020]">
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* AI Question Generator */}
          <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <h3 className="font-jakarta font-bold text-[#0B3D6B]">Generate Questions with AI</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-4">
              <div>
                <label className="text-xs font-medium text-[#5A6A7A]">Topic</label>
                <select value={aiTopic} onChange={(e) => setAiTopic(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
                  {IRODORI_TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>Topic {t.id.replace('topic', '')} — {t.en.split(',')[0]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5A6A7A]">Level</label>
                <select value={aiLevel} onChange={(e) => setAiLevel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
                  {['A1', 'A2', 'B1'].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5A6A7A]">Section</label>
                <select value={aiSection} onChange={(e) => setAiSection(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
                  {['reading', 'listening', 'writing', 'speaking'].map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5A6A7A]">Questions</label>
                <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
                  {[3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5A6A7A]">Language</label>
                <select value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
                  <option value="bilingual">Bilingual</option>
                  <option value="japanese">Japanese only</option>
                </select>
              </div>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <div className="flex-1 max-w-xs">
                <label className="text-xs font-medium text-[#5A6A7A]">Add to paper (optional)</label>
                <select value={aiTargetPaper} onChange={(e) => setAiTargetPaper(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
                  <option value="">— select a paper —</option>
                  {papers.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={aiGenerating}
                className="mt-5 flex items-center gap-2 rounded-[7px] bg-[#E8A020] px-5 py-2 text-sm font-medium text-white hover:bg-[#E8A020]/90 disabled:opacity-50 transition-colors"
              >
                {aiGenerating ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Generating…</>
                ) : (
                  <>✨ Generate</>
                )}
              </button>
            </div>

            {aiError && (
              <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{aiError}</p>
            )}

            {aiResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#0B3D6B]">{aiResults.length} questions generated</p>
                  {!aiTargetPaper && (
                    <p className="text-xs text-amber-600">Select a paper above to add questions</p>
                  )}
                </div>
                {aiResults.map((q, idx) => (
                  <div key={idx} className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {q.passageText && (
                          <p className="text-xs text-gray-400 font-['Noto_Sans_JP'] mb-1 truncate">{q.passageText}</p>
                        )}
                        <p className="text-sm text-gray-800">
                          {q.questionText ?? q.instruction ?? q.promptText}
                        </p>
                        {q.options && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {q.options.map((opt, i) => (
                              <span key={i}
                                className={`text-[11px] px-2 py-0.5 rounded border ${
                                  q.correctAnswer === ['A','B','C','D'][i]
                                    ? 'border-green-400 bg-green-50 text-green-700 font-medium'
                                    : 'border-gray-200 text-gray-500'
                                }`}>
                                {['A','B','C','D'][i]}: {opt}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.transcript && (
                          <p className="mt-2 text-xs text-gray-400 italic truncate">Audio: {q.transcript}</p>
                        )}
                        {q.exampleAnswer && (
                          <p className="mt-1 text-xs text-gray-400 truncate">Example: {q.exampleAnswer}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!aiTargetPaper || aiSavingIdx === idx}
                        onClick={() => handleAddToPaper(q, idx)}
                        className="flex-shrink-0 rounded-[7px] border border-[#0B3D6B] px-3 py-1.5 text-xs font-medium text-[#0B3D6B] hover:bg-[#0B3D6B]/10 disabled:opacity-40 transition-colors"
                      >
                        {aiSavingIdx === idx ? 'Adding…' : 'Add to Paper'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Slide-overs ─────────────────────────────────────────────────────── */}
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

      {questionEditorPaper && (
        <QuestionEditor
          paper={questionEditorPaper}
          open={!!questionEditorPaper}
          onClose={() => setQuestionEditorPaper(null)}
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
