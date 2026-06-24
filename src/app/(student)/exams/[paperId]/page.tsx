'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'

interface Paper {
  id: string
  title: string
  timeLimitSeconds: number
  passMark: number
  totalQuestions: number
}

interface Section {
  id: string
  name: string
  order: number
}

interface Question {
  id: string
  sectionId: string
  order: number
  questionText: string
  questionImageUrl?: string
  questionAudioUrl?: string
  options: { index: number; text: string; imageUrl?: string }[]
  correctIndex: number
}

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [plays, setPlays] = useState(0)
  const [hidden, setHidden] = useState(false)
  const MAX = 3

  function handlePlay() {
    if (plays >= MAX - 1) setTimeout(() => setHidden(true), 500)
    setPlays((p) => p + 1)
  }

  if (hidden) return (
    <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-xs text-red-600 dark:text-red-400">
      <span className="ti ti-volume-off" />
      Audio play limit reached (3 plays max)
    </div>
  )

  return (
    <div className="rounded-xl bg-[#F5F7FB] dark:bg-white/[0.06] border border-[#DDE3EC] dark:border-white/20 p-3">
      <div className="flex items-center gap-3">
        <span className="ti ti-volume text-[#0B3D6B] dark:text-[#E8A020] text-lg" />
        <audio ref={audioRef} src={url} controls onPlay={handlePlay} className="h-8 flex-1" style={{ minWidth: 0 }} />
        <span className={`text-xs font-bold ${plays >= MAX ? 'text-red-500' : 'text-[#5A6A7A] dark:text-white/50'}`}>
          {MAX - plays} left
        </span>
      </div>
    </div>
  )
}

function ZoomImage({ src, alt = '' }: { src: string; alt?: string }) {
  const [zoomed, setZoomed] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setZoomed(true)} className="block w-full">
        <img src={src} alt={alt} className="max-h-64 w-full cursor-zoom-in rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] object-contain" />
        <p className="mt-1 text-center text-xs text-[#5A6A7A] dark:text-white/40">
          <span className="ti ti-zoom-in mr-1" />Tap to zoom
        </p>
      </button>
      {zoomed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setZoomed(false)}>
          <button type="button" className="absolute right-4 top-4 text-white" onClick={() => setZoomed(false)}>
            <span className="ti ti-x text-2xl" />
          </button>
          <img src={src} alt={alt} className="max-h-screen max-w-screen-lg object-contain p-4" />
        </div>
      )}
    </>
  )
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatDuration(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export default function ExamTakingPage() {
  const { paperId } = useParams<{ paperId: string }>()
  const router = useRouter()
  const { student, user } = useStudentPortal()

  const [paper, setPaper] = useState<Paper | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)
  const [startedAt] = useState(() => new Date())

  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number | null>>({})
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [timeLeft, setTimeLeft] = useState(3600)
  const [timeUp, setTimeUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<{
    correctCount: number
    totalQuestions: number
    percentage: number
    marks250: number
    durationSeconds: number
    passed: boolean
  } | null>(null)

  useEffect(() => {
    if (!paperId || !user) return
    async function load() {
      const [paperSnap, sectionsSnap, questionsSnap] = await Promise.all([
        getDocs(query(collection(db, 'examPapers'), where('__name__', '==', paperId))),
        getDocs(query(collection(db, 'examSections'), where('paperId', '==', paperId), orderBy('order', 'asc'))),
        getDocs(query(collection(db, 'examQuestions'), where('paperId', '==', paperId), orderBy('order', 'asc'))),
      ])
      if (paperSnap.empty) { router.push('/exams'); return }
      const p = { id: paperSnap.docs[0].id, ...paperSnap.docs[0].data() } as Paper
      setPaper(p)
      setTimeLeft(p.timeLimitSeconds ?? 3600)
      setSections(sectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Section)))
      setQuestions(questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)))
      setLoading(false)
    }
    void load()
  }, [paperId, user, router])

  useEffect(() => {
    if (!started || done || timeUp) return
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); setTimeUp(true); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [started, done, timeUp])

  async function handleSubmit() {
    if (!user || !paper || submitting) return
    setSubmitting(true)
    const finishedAt = new Date()
    const durationSeconds = Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000)

    let correctCount = 0
    const answerRows = questions.map((q, idx) => {
      const selected = answers[q.id] ?? null
      const isCorrect = selected !== null && selected === q.correctIndex
      if (isCorrect) correctCount++
      return { questionId: q.id, selectedIndex: selected, isCorrect, order: idx }
    })

    const total = questions.length
    const marks250 = Math.round((correctCount / total) * 250)
    const percentage = Math.round((correctCount / total) * 100)
    const passed = percentage >= (paper.passMark ?? 80)

    try {
      const attemptRef = await addDoc(collection(db, 'examAttempts'), {
        studentId: user.uid,
        studentName: student?.name ?? user.displayName ?? 'Student',
        paperId: paper.id,
        paperTitle: paper.title,
        totalQuestions: total,
        correctCount,
        marks250,
        percentage,
        durationSeconds,
        startedAt: serverTimestamp(),
        finishedAt: serverTimestamp(),
        status: 'completed',
        skippedIndexes: Array.from(skipped),
      })

      const batch = writeBatch(db)
      answerRows.forEach((row) => {
        const ansRef = doc(collection(db, 'examAttemptAnswers'))
        batch.set(ansRef, { attemptId: attemptRef.id, ...row })
      })
      await batch.commit()

      setResult({ correctCount, totalQuestions: total, percentage, marks250, durationSeconds, passed })
      setDone(true)
    } catch (err) {
      console.error('[ExamTaking] submit error', err)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (timeUp && !done && !submitting) void handleSubmit()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  const currentQ = questions[currentIdx]
  const currentSection = sections.find((s) => s.id === currentQ?.sectionId)

  function selectAnswer(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
    setSkipped((prev) => { const next = new Set(prev); next.delete(currentIdx); return next })
  }

  function goNext() {
    if (currentIdx < questions.length - 1) {
      if (answers[currentQ.id] === undefined || answers[currentQ.id] === null) {
        setSkipped((prev) => new Set(prev).add(currentIdx))
      }
      setCurrentIdx((i) => i + 1)
    } else {
      void handleSubmit()
    }
  }

  function goBack() {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1)
  }

  if (!user) return null

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#E8A020] border-t-transparent" />
        <p className="mt-4 text-sm text-[#5A6A7A] dark:text-white/50">Loading exam paper…</p>
      </div>
    </div>
  )

  // ── START SCREEN ──────────────────────────────────────────────────────────
  if (!started && paper) return (
    <div className="flex min-h-[70vh] items-center justify-center pb-24">
      <div className="w-full max-w-md rounded-3xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD] text-4xl shadow-lg">
          📝
        </div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">{paper.title}</h1>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { icon: 'ti-list-numbers', label: 'Questions', val: String(paper.totalQuestions ?? questions.length) },
            { icon: 'ti-clock', label: 'Time Limit', val: `${Math.round((paper.timeLimitSeconds ?? 3600) / 60)}m` },
            { icon: 'ti-target', label: 'Pass Mark', val: `${paper.passMark ?? 80}%` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[#F5F7FB] dark:bg-white/[0.06] p-3">
              <span className={`ti ${item.icon} text-xl text-[#0B3D6B] dark:text-[#E8A020]`} />
              <p className="mt-1 text-lg font-bold text-[#0D1B2A] dark:text-white">{item.val}</p>
              <p className="text-xs text-[#5A6A7A] dark:text-white/50">{item.label}</p>
            </div>
          ))}
        </div>
        {sections.length > 0 && (
          <div className="mt-4 rounded-xl bg-[#F5F7FB] dark:bg-white/[0.06] p-3 text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/50">Sections</p>
            <div className="space-y-1">
              {sections.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm text-[#0D1B2A] dark:text-white">
                  <span className="ti ti-circle-dot text-[#E8A020]" />
                  {s.name}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-left text-xs text-amber-700 dark:text-amber-400">
          <p className="mb-1 font-bold">⚠️ Before you start:</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>Timer starts immediately when you begin</li>
            <li>Audio can be played maximum 3 times</li>
            <li>You can go back and change answers</li>
            <li>Submit before time runs out</li>
          </ul>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#5A6A7A]/60 dark:text-white/30">
          <span className="ti ti-award text-[#E8A020]" />
          Powered by <span className="font-bold text-[#E8A020]">SSW Guide</span>
        </div>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-6 w-full rounded-2xl bg-[#E8A020] py-4 font-jakarta text-base font-bold text-[#0B3D6B] shadow-lg transition-all hover:bg-[#d4911c]"
        >
          Begin Exam
          <span className="ti ti-arrow-right ml-2" />
        </button>
      </div>
    </div>
  )

  // ── RESULT SCREEN ─────────────────────────────────────────────────────────
  if (done && result) return (
    <div className="flex min-h-[70vh] items-center justify-center pb-24">
      <div className="w-full max-w-md space-y-4">
        <div className={`rounded-3xl p-8 text-center text-white shadow-xl ${
          result.passed
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
            : 'bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD]'
        }`}>
          <div className="text-5xl">{result.passed ? '🎉' : '💪'}</div>
          <h2 className="mt-3 font-jakarta text-3xl font-black">
            {result.passed ? 'Passed!' : 'Keep Going!'}
          </h2>
          <div className="mt-4 text-6xl font-black">{result.percentage}<span className="text-3xl">/100</span></div>
          <p className="mt-1 text-white/70">
            {result.passed
              ? 'Congratulations — you cleared the pass mark!'
              : `You need ${(paper?.passMark ?? 80) - result.percentage}% more to pass`}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Correct', val: `${result.correctCount}/${result.totalQuestions}` },
              { label: 'Score /250', val: String(result.marks250) },
              { label: 'Time', val: formatDuration(result.durationSeconds) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-white/10 p-3">
                <p className="text-lg font-bold">{item.val}</p>
                <p className="text-xs text-white/60">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/exams')}
            className="flex-1 rounded-2xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] py-3 font-jakarta font-bold text-[#0B3D6B] dark:text-white"
          >
            <span className="ti ti-arrow-left mr-2" />
            All Papers
          </button>
          <button
            type="button"
            onClick={() => {
              setDone(false)
              setStarted(false)
              setCurrentIdx(0)
              setAnswers({})
              setSkipped(new Set())
              setTimeLeft(paper?.timeLimitSeconds ?? 3600)
              setResult(null)
            }}
            className="flex-1 rounded-2xl bg-[#E8A020] py-3 font-jakarta font-bold text-[#0B3D6B]"
          >
            Try Again
            <span className="ti ti-refresh ml-2" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-[#5A6A7A]/50 dark:text-white/20">
          <span className="ti ti-stars" />
          Powered by SSW Guide · sswguide.com
        </div>
      </div>
    </div>
  )

  // ── EXAM UI ───────────────────────────────────────────────────────────────
  if (!started || !currentQ) return null

  const sectionQuestions = questions.filter((q) => q.sectionId === currentQ.sectionId)
  const sectionStart = questions.findIndex((q) => q.sectionId === currentQ.sectionId)
  const qNumInSection = currentIdx - sectionStart + 1
  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== undefined).length

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-[#0d1a2e] px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/exams')}
            className="rounded-lg p-1.5 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]"
          >
            <span className="ti ti-x text-lg" />
          </button>
          <div>
            <p className="max-w-[140px] truncate font-jakarta text-sm font-bold text-[#0D1B2A] dark:text-white sm:max-w-xs">
              {paper?.title}
            </p>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50">
              {currentSection?.name} · Q{qNumInSection}/{sectionQuestions.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold ${
            timeLeft < 300
              ? 'animate-pulse bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : timeLeft < 600
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
              : 'bg-[#F5F7FB] dark:bg-white/[0.06] text-[#0B3D6B] dark:text-white'
          }`}>
            <span className="ti ti-clock" />
            {formatTime(timeLeft)}
          </div>
          <div className="hidden items-center gap-1.5 rounded-xl bg-[#F5F7FB] dark:bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-[#5A6A7A] dark:text-white/50 sm:flex">
            <span className="ti ti-check text-emerald-500" />
            {answeredCount}/{questions.length}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#DDE3EC] dark:bg-white/[0.08]">
        <div
          className="h-full bg-[#E8A020] transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      {timeUp && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-bold text-white">
          ⏰ Time&apos;s up! Submitting your answers…
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Section sidebar — desktop only */}
        <div className="hidden w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.02] p-3 md:flex">
          <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/40">Sections</p>
          {sections.map((section) => {
            const secQs = questions.filter((q) => q.sectionId === section.id)
            const secStart = questions.findIndex((q) => q.sectionId === section.id)
            const secAnswered = secQs.filter((q) => answers[q.id] !== undefined && answers[q.id] !== null).length
            const isCurrent = section.id === currentQ.sectionId
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setCurrentIdx(secStart)}
                className={`rounded-xl px-3 py-2.5 text-left transition-all ${
                  isCurrent ? 'bg-[#0B3D6B] text-white' : 'text-[#5A6A7A] dark:text-white/60 hover:bg-[#DDE3EC]/50 dark:hover:bg-white/[0.06]'
                }`}
              >
                <p className="text-xs font-bold">{section.name}</p>
                <div className="mt-1.5 h-1 rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-[#E8A020]"
                    style={{ width: `${secQs.length > 0 ? (secAnswered / secQs.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] opacity-70">{secAnswered}/{secQs.length}</p>
              </button>
            )
          })}
          <div className="mt-auto pt-4 text-center">
            <p className="text-[9px] text-[#5A6A7A]/40 dark:text-white/20">Powered by</p>
            <p className="text-[9px] font-bold text-[#E8A020]/60">SSW Guide</p>
          </div>
        </div>

        {/* Question area */}
        <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
          <div className="mx-auto w-full max-w-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-bold text-white">
                {currentIdx + 1}
              </div>
              <div className="h-px flex-1 bg-[#DDE3EC] dark:bg-white/[0.08]" />
              <span className="text-xs text-[#5A6A7A] dark:text-white/40">{currentIdx + 1} of {questions.length}</span>
            </div>

            <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
              <p className="font-noto-jp text-base leading-relaxed text-[#0D1B2A] dark:text-white">
                {currentQ.questionText}
              </p>
              {currentQ.questionImageUrl && (
                <div className="mt-4"><ZoomImage src={currentQ.questionImageUrl} /></div>
              )}
              {currentQ.questionAudioUrl && (
                <div className="mt-4"><AudioPlayer url={currentQ.questionAudioUrl} /></div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentQ.options.map((opt) => {
                const selected = answers[currentQ.id] === opt.index
                return (
                  <button
                    key={opt.index}
                    type="button"
                    onClick={() => selectAnswer(currentQ.id, opt.index)}
                    className={`flex flex-col items-start rounded-2xl border-2 p-4 text-left transition-all ${
                      selected
                        ? 'border-[#E8A020] bg-[#E8A020]/10 dark:bg-[#E8A020]/20'
                        : 'border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] hover:border-[#0B3D6B]/40 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                        selected
                          ? 'border-[#E8A020] bg-[#E8A020] text-white'
                          : 'border-[#DDE3EC] dark:border-white/30 text-[#5A6A7A] dark:text-white/50'
                      }`}>
                        {(['A', 'B', 'C', 'D'] as const)[opt.index - 1] ?? opt.index}
                      </div>
                      <span className={`font-noto-jp text-sm font-medium leading-relaxed ${
                        selected ? 'text-[#0B3D6B] dark:text-[#E8A020]' : 'text-[#0D1B2A] dark:text-white'
                      }`}>
                        {opt.text}
                      </span>
                    </div>
                    {opt.imageUrl && (
                      <div className="mt-3 w-full"><ZoomImage src={opt.imageUrl} /></div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={goBack}
                disabled={currentIdx === 0}
                className="flex items-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2.5 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06] disabled:opacity-30"
              >
                <span className="ti ti-chevron-left" />
                Back
              </button>

              <div className="flex flex-1 gap-1 overflow-x-auto py-1 scrollbar-hide">
                {questions.map((q, idx) => {
                  const ans = answers[q.id]
                  const isAnswered = ans !== null && ans !== undefined
                  const isCurr = idx === currentIdx
                  const isSkip = skipped.has(idx)
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                        isCurr ? 'scale-110 bg-[#0B3D6B] text-white' :
                        isSkip ? 'bg-red-100 dark:bg-red-900/30 text-red-500' :
                        isAnswered ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                        'bg-[#DDE3EC] dark:bg-white/20 text-[#5A6A7A] dark:text-white/50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
                  currentIdx === questions.length - 1
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-[#E8A020] text-[#0B3D6B] hover:bg-[#d4911c]'
                }`}
              >
                {submitting ? 'Submitting…' : currentIdx === questions.length - 1 ? 'Finish' : 'Next'}
                <span className={`ti ${currentIdx === questions.length - 1 ? 'ti-check' : 'ti-chevron-right'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
