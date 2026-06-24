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

// ── Types ─────────────────────────────────────────────────────────────────────
interface Paper {
  id: string
  title: string
  timeLimitSeconds: number
  passMark: number
  totalQuestions: number
  hasAudioCheck?: boolean
  scoringScale?: number
}

interface Section {
  id: string
  name: string
  order: number
  sectionType?: string
}

interface Question {
  id: string
  sectionId: string
  order: number
  questionText: string
  questionTextJP?: string
  questionTextEN?: string
  languageMode?: 'en' | 'jp' | 'both'
  questionImageUrl?: string
  questionAudioUrl?: string
  audioPlayLimit?: number
  options: { index: number; text: string; imageUrl?: string }[]
  correctIndex: number
}

// ── Audio check component ─────────────────────────────────────────────────────
function AudioCheck({ onPass }: { onPass: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [played, setPlayed] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B3D6B]">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl mx-4">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0B3D6B] text-4xl">
          🎧
        </div>
        <h2 className="font-jakarta text-xl font-bold text-[#0B3D6B]">
          Audio Check
        </h2>
        <p className="mt-2 text-sm text-[#5A6A7A]">
          Please put on your headphones and click play to test your audio before starting the exam.
        </p>

        <div className="mt-6 rounded-xl bg-[#F5F7FB] p-4">
          <audio
            ref={audioRef}
            controls
            onPlay={() => setPlayed(true)}
            className="w-full"
            src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
          />
        </div>

        <div className="mt-4 flex items-center gap-2 justify-center">
          <input
            type="checkbox"
            id="audioOk"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            disabled={!played}
            className="h-4 w-4 accent-[#E8A020]"
          />
          <label
            htmlFor="audioOk"
            className={`text-sm font-medium ${played ? 'text-[#0D1B2A]' : 'text-[#5A6A7A]'}`}
          >
            I can hear the audio clearly
          </label>
        </div>

        {!played && (
          <p className="mt-2 text-xs text-amber-600">
            ⚠️ Please play the audio first before continuing
          </p>
        )}

        <button
          type="button"
          disabled={!confirmed}
          onClick={onPass}
          className="mt-6 w-full rounded-2xl bg-[#E8A020] py-4 font-jakarta font-bold text-[#0B3D6B] disabled:opacity-40 hover:bg-[#d4911c] transition-all"
        >
          Audio is working — Continue
        </button>
      </div>
    </div>
  )
}

// ── Start screen ──────────────────────────────────────────────────────────────
function StartScreen({
  paper,
  sections,
  questions,
  onStart,
}: {
  paper: Paper
  sections: Section[]
  questions: Question[]
  onStart: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0B3D6B]">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl mx-4">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B3D6B] text-3xl">
            📝
          </div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">{paper.title}</h1>
          <p className="mt-1 text-sm text-[#5A6A7A]">Japan Foundation Test for Basic Japanese</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: 'ti-list-numbers', label: 'Questions', val: String(paper.totalQuestions ?? questions.length) },
            { icon: 'ti-clock', label: 'Time', val: `${Math.round((paper.timeLimitSeconds ?? 3600) / 60)} min` },
            { icon: 'ti-target', label: 'Pass Mark', val: `${paper.passMark ?? 200}/${paper.scoringScale ?? 250}` },
          ].map(item => (
            <div key={item.label} className="rounded-xl bg-[#F5F7FB] p-3 text-center">
              <span className={`ti ${item.icon} text-xl text-[#0B3D6B]`} />
              <p className="mt-1 text-base font-bold text-[#0D1B2A]">{item.val}</p>
              <p className="text-xs text-[#5A6A7A]">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div className="mb-6 rounded-xl bg-[#F5F7FB] p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#5A6A7A]">Sections</p>
          <div className="space-y-2">
            {sections.map((s, i) => {
              const count = questions.filter(q => q.sectionId === s.id).length
              return (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B3D6B] text-[10px] font-bold text-white">
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium text-[#0D1B2A]">{s.name}</span>
                  </div>
                  <span className="text-xs text-[#5A6A7A]">{count}Q</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Rules */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-bold text-amber-700">⚠️ Exam Rules</p>
          <ul className="space-y-1 text-xs text-amber-800">
            <li>• Timer starts immediately and cannot be paused</li>
            <li>• You can flag questions to review later</li>
            <li>• You can move between sections freely</li>
            <li>• Audio can be played up to 2 times in listening section</li>
            <li>• Exam auto-submits when time runs out</li>
          </ul>
        </div>

        {/* Powered by */}
        <div className="mb-4 flex items-center justify-center gap-2 text-xs text-[#5A6A7A]/60">
          <span className="ti ti-award text-[#E8A020]" />
          Powered by <span className="font-bold text-[#E8A020]">SSW Guide</span>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-2xl bg-[#E8A020] py-4 font-jakarta text-base font-bold text-[#0B3D6B] shadow-lg hover:bg-[#d4911c] transition-all"
        >
          Begin Exam
          <span className="ti ti-arrow-right ml-2" />
        </button>
      </div>
    </div>
  )
}

// ── Audio player with play limit ──────────────────────────────────────────────
function AudioPlayer({ url, limit = 2 }: { url: string; limit?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [plays, setPlays] = useState(0)
  const [hidden, setHidden] = useState(false)

  function handlePlay() {
    const next = plays + 1
    setPlays(next)
    if (next >= limit) {
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
        setHidden(true)
      }, 500)
    }
  }

  if (hidden) return (
    <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-600">
      <span className="ti ti-volume-off" />
      Audio limit reached ({limit} plays maximum)
    </div>
  )

  return (
    <div className="rounded-xl bg-[#0B3D6B]/5 border border-[#0B3D6B]/20 p-3">
      <div className="flex items-center gap-3">
        <span className="ti ti-volume text-[#0B3D6B] text-lg" />
        <audio
          ref={audioRef}
          src={url}
          controls
          onPlay={handlePlay}
          className="flex-1 h-8"
          style={{ minWidth: 0 }}
        />
        <span className={`text-xs font-bold ${plays >= limit ? 'text-red-500' : 'text-[#5A6A7A]'}`}>
          {limit - plays} left
        </span>
      </div>
    </div>
  )
}

// ── Zoomable image ────────────────────────────────────────────────────────────
function ZoomImage({ src }: { src: string }) {
  const [zoomed, setZoomed] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setZoomed(true)} className="block w-full">
        <img
          src={src}
          alt=""
          className="w-full rounded-xl object-contain border border-[#DDE3EC] bg-white cursor-zoom-in max-h-72"
        />
      </button>
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setZoomed(false)}
        >
          <button type="button" className="absolute right-4 top-4 text-white" onClick={() => setZoomed(false)}>
            <span className="ti ti-x text-2xl" />
          </button>
          <img src={src} alt="" className="max-h-screen max-w-screen-lg object-contain p-4" />
        </div>
      )}
    </>
  )
}

// ── Format time ───────────────────────────────────────────────────────────────
function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ── Result screen ─────────────────────────────────────────────────────────────
function ResultScreen({
  paper,
  sections,
  questions,
  answers,
  duration,
  onRetry,
  onExit,
}: {
  paper: Paper
  sections: Section[]
  questions: Question[]
  answers: Record<string, number | null>
  duration: number
  onRetry: () => void
  onExit: () => void
}) {
  const scale = paper.scoringScale ?? 250
  const passMark = paper.passMark ?? 200
  const total = questions.length
  const correct = questions.filter(q => answers[q.id] === q.correctIndex).length
  const score = Math.round((correct / total) * scale)
  const pct = Math.round((correct / total) * 100)
  const passed = score >= passMark

  const formatDur = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}m ${sec}s`
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#F5F7FB]">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Score card */}
        <div className={`rounded-3xl p-8 text-center text-white shadow-xl mb-6 ${
          passed
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
            : 'bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD]'
        }`}>
          <div className="text-5xl mb-3">{passed ? '🎉' : '💪'}</div>
          <h2 className="font-jakarta text-3xl font-black">
            {passed ? 'Passed!' : 'Keep Studying!'}
          </h2>
          <div className="mt-4 text-7xl font-black">
            {score}<span className="text-3xl">/{scale}</span>
          </div>
          <p className="mt-2 text-white/70">
            {passed
              ? 'Congratulations! You passed the JFT-Basic standard.'
              : `You need ${passMark - score} more points to pass`}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Correct', val: `${correct}/${total}` },
              { label: 'Percentage', val: `${pct}%` },
              { label: 'Time', val: formatDur(duration) },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-white/10 p-3">
                <p className="text-lg font-bold">{item.val}</p>
                <p className="text-xs text-white/60">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section breakdown */}
        <div className="rounded-2xl bg-white shadow-sm mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DDE3EC]">
            <h3 className="font-jakarta font-bold text-[#0B3D6B]">Section Breakdown</h3>
          </div>
          {sections.map(section => {
            const secQs = questions.filter(q => q.sectionId === section.id)
            const secCorrect = secQs.filter(q => answers[q.id] === q.correctIndex).length
            const secPct = secQs.length > 0 ? Math.round((secCorrect / secQs.length) * 100) : 0
            return (
              <div key={section.id} className="flex items-center gap-4 px-5 py-3 border-b border-[#DDE3EC] last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0D1B2A]">{section.name}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-[#DDE3EC] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${secPct >= 80 ? 'bg-emerald-500' : secPct >= 60 ? 'bg-[#E8A020]' : 'bg-red-500'}`}
                      style={{ width: `${secPct}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#0D1B2A]">{secCorrect}/{secQs.length}</p>
                  <p className="text-xs text-[#5A6A7A]">{secPct}%</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* SSW Guide tribute */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#5A6A7A]/50 mb-6">
          <span className="ti ti-stars" />
          Powered by SSW Guide · sswguide.com
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onExit}
            className="flex-1 rounded-2xl border border-[#DDE3EC] bg-white py-3 font-jakarta font-bold text-[#0B3D6B]"
          >
            <span className="ti ti-arrow-left mr-2" />
            All Papers
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-2xl bg-[#E8A020] py-3 font-jakarta font-bold text-[#0B3D6B]"
          >
            Try Again
            <span className="ti ti-refresh ml-2" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main exam page ─────────────────────────────────────────────────────────────
export default function ExamTakingPage() {
  const { paperId } = useParams<{ paperId: string }>()
  const router = useRouter()
  const { student, user } = useStudentPortal()

  const [paper, setPaper] = useState<Paper | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  // Exam flow state
  const [phase, setPhase] = useState<'audio-check' | 'start' | 'exam' | 'result'>('audio-check')
  const [startedAt] = useState(() => new Date())

  // Exam state
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number | null>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(3600)
  const [timeUp, setTimeUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [duration, setDuration] = useState(0)

  // Load paper
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
      setSections(sectionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Section)))
      setQuestions(questionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Question)))
      // Skip audio check if paper doesn't require it
      if (!p.hasAudioCheck) setPhase('start')
      setLoading(false)
    }
    void load()
  }, [paperId, user, router])

  // Timer
  useEffect(() => {
    if (phase !== 'exam' || timeUp) return
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); setTimeUp(true); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase, timeUp])

  // Auto-submit on time up
  useEffect(() => {
    if (timeUp && phase === 'exam' && !submitting) void handleSubmit()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  const currentQ = questions[currentIdx]
  const currentSection = sections.find(s => s.id === currentQ?.sectionId)

  function toggleFlag(qId: string) {
    setFlagged(prev => {
      const next = new Set(prev)
      if (next.has(qId)) next.delete(qId)
      else next.add(qId)
      return next
    })
  }

  async function handleSubmit() {
    if (!user || !paper || submitting) return
    setSubmitting(true)
    const finishedAt = new Date()
    const dur = Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000)
    setDuration(dur)

    const scale = paper.scoringScale ?? 250
    const total = questions.length
    let correct = 0
    const answerRows = questions.map((q, idx) => {
      const selected = answers[q.id] ?? null
      const isCorrect = selected !== null && selected === q.correctIndex
      if (isCorrect) correct++
      return { questionId: q.id, selectedIndex: selected, isCorrect, order: idx }
    })

    const score = Math.round((correct / total) * scale)
    const percentage = Math.round((correct / total) * 100)

    try {
      const attemptRef = await addDoc(collection(db, 'examAttempts'), {
        studentId: user.uid,
        studentName: student?.name ?? user.displayName ?? 'Student',
        paperId: paper.id,
        paperTitle: paper.title,
        totalQuestions: total,
        correctCount: correct,
        marks250: score,
        percentage,
        durationSeconds: dur,
        startedAt: serverTimestamp(),
        finishedAt: serverTimestamp(),
        status: 'completed',
        flaggedCount: flagged.size,
      })

      const batch = writeBatch(db)
      answerRows.forEach(row => {
        const ref = doc(collection(db, 'examAttemptAnswers'))
        batch.set(ref, { attemptId: attemptRef.id, ...row })
      })
      await batch.commit()
    } catch (err) {
      console.error('[Exam] submit error', err)
    } finally {
      setSubmitting(false)
      setPhase('result')
    }
  }

  if (loading || !paper) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0B3D6B]">
      <div className="text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E8A020] border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-white/60">Loading exam...</p>
      </div>
    </div>
  )

  // ── Phase: Audio check ──────────────────────────────────────────────────────
  if (phase === 'audio-check') {
    return <AudioCheck onPass={() => setPhase('start')} />
  }

  // ── Phase: Start screen ─────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <StartScreen
        paper={paper}
        sections={sections}
        questions={questions}
        onStart={() => setPhase('exam')}
      />
    )
  }

  // ── Phase: Result screen ────────────────────────────────────────────────────
  if (phase === 'result') {
    return (
      <ResultScreen
        paper={paper}
        sections={sections}
        questions={questions}
        answers={answers}
        duration={duration}
        onRetry={() => {
          setPhase('audio-check')
          setCurrentIdx(0)
          setAnswers({})
          setFlagged(new Set())
          setTimeLeft(paper.timeLimitSeconds ?? 3600)
          setDuration(0)
        }}
        onExit={() => router.push('/exams')}
      />
    )
  }

  // ── Phase: Exam ─────────────────────────────────────────────────────────────
  if (!currentQ) return null

  const answeredCount = Object.values(answers).filter(v => v !== null).length
  const sectionQs = questions.filter(q => q.sectionId === currentQ.sectionId)
  const sectionStart = questions.findIndex(q => q.sectionId === currentQ.sectionId)
  const qNumInSection = currentIdx - sectionStart + 1

  // Question text based on language mode
  const langMode = currentQ.languageMode ?? 'both'
  const showEN = langMode === 'en' || langMode === 'both'
  const showJP = langMode === 'jp' || langMode === 'both'

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F5F7FB] overflow-hidden">

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[#DDE3EC] bg-white px-4 py-2.5 shadow-sm shrink-0">
        {/* Left: Logo + exam title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B3D6B]">
            <span className="ti ti-pencil text-white text-sm" />
          </div>
          <div className="min-w-0">
            <p className="font-jakarta text-xs font-bold text-[#0B3D6B] truncate max-w-[140px] sm:max-w-xs">
              {paper.title}
            </p>
            <p className="text-[10px] text-[#5A6A7A]">
              {currentSection?.name} · Q{qNumInSection}/{sectionQs.length}
            </p>
          </div>
        </div>

        {/* Center: Timer */}
        <div className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 font-mono text-sm font-bold ${
          timeLeft < 300
            ? 'bg-red-100 text-red-600 animate-pulse'
            : timeLeft < 600
            ? 'bg-amber-100 text-amber-600'
            : 'bg-[#0B3D6B]/10 text-[#0B3D6B]'
        }`}>
          <span className="ti ti-clock" />
          {formatTime(timeLeft)}
        </div>

        {/* Right: Progress + submit */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:flex items-center gap-1 rounded-xl bg-[#F5F7FB] px-3 py-1.5 text-xs font-semibold text-[#5A6A7A]">
            <span className="ti ti-check text-emerald-500" />
            {answeredCount}/{questions.length}
          </span>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#DDE3EC] shrink-0">
        <div
          className="h-full bg-[#E8A020] transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Time up banner */}
      {timeUp && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-bold text-white shrink-0">
          ⏰ Time&apos;s up! Submitting your exam...
        </div>
      )}

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
        <div className="hidden md:flex w-52 shrink-0 flex-col border-r border-[#DDE3EC] bg-white overflow-y-auto">
          {sections.map((section, si) => {
            const secQs = questions.filter(q => q.sectionId === section.id)
            const secStart = questions.findIndex(q => q.sectionId === section.id)
            const secAnswered = secQs.filter(q => answers[q.id] !== null && answers[q.id] !== undefined).length
            const isCurrent = section.id === currentQ.sectionId
            const secPct = secQs.length > 0 ? (secAnswered / secQs.length) * 100 : 0

            return (
              <div key={section.id} className={`border-b border-[#DDE3EC] ${isCurrent ? 'bg-[#0B3D6B]/5' : ''}`}>
                {/* Section header */}
                <button
                  type="button"
                  onClick={() => setCurrentIdx(secStart)}
                  className="w-full px-3 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      isCurrent ? 'bg-[#0B3D6B] text-white' : 'bg-[#DDE3EC] text-[#5A6A7A]'
                    }`}>
                      {si + 1}
                    </div>
                    <p className={`text-xs font-bold truncate ${isCurrent ? 'text-[#0B3D6B]' : 'text-[#5A6A7A]'}`}>
                      {section.name}
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 ml-7 h-1 rounded-full bg-[#DDE3EC] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#E8A020] transition-all"
                      style={{ width: `${secPct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 ml-7 text-[9px] text-[#5A6A7A]">{secAnswered}/{secQs.length}</p>
                </button>

                {/* Question tiles */}
                {isCurrent && (
                  <div className="px-3 pb-2 flex flex-wrap gap-1">
                    {secQs.map((q, qi) => {
                      const globalIdx = secStart + qi
                      const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined
                      const isFlagged = flagged.has(q.id)
                      const isCurQ = globalIdx === currentIdx
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setCurrentIdx(globalIdx)}
                          className={`relative flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold transition-all ${
                            isCurQ
                              ? 'bg-[#0B3D6B] text-white'
                              : isAnswered
                              ? 'bg-emerald-500 text-white'
                              : 'bg-[#DDE3EC] text-[#5A6A7A] hover:bg-[#0B3D6B]/20'
                          }`}
                        >
                          {qi + 1}
                          {isFlagged && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#E8A020] text-[6px] text-white">
                              🚩
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* SSW Guide tribute */}
          <div className="mt-auto p-3 text-center border-t border-[#DDE3EC]">
            <p className="text-[9px] text-[#5A6A7A]/40">Powered by</p>
            <p className="text-[9px] font-bold text-[#E8A020]/60">SSW Guide</p>
          </div>
        </div>

        {/* ── QUESTION AREA ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl p-4 md:p-6 space-y-4">

            {/* Question header row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-bold text-white shrink-0">
                  {currentIdx + 1}
                </div>
                <span className="text-xs text-[#5A6A7A]">{currentIdx + 1} of {questions.length}</span>
              </div>
              {/* Flag button */}
              <button
                type="button"
                onClick={() => toggleFlag(currentQ.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  flagged.has(currentQ.id)
                    ? 'bg-[#E8A020] text-[#0B3D6B]'
                    : 'border border-[#DDE3EC] text-[#5A6A7A] hover:border-[#E8A020]'
                }`}
              >
                🚩 {flagged.has(currentQ.id) ? 'Flagged' : 'Flag'}
              </button>
            </div>

            {/* Question card */}
            <div className="rounded-2xl border border-[#DDE3EC] bg-white p-5 shadow-sm">
              {/* English text */}
              {showEN && currentQ.questionTextEN && (
                <p className="text-base leading-relaxed text-[#0D1B2A] mb-2">
                  {currentQ.questionTextEN}
                </p>
              )}
              {/* Fallback to questionText if no separate EN/JP */}
              {!currentQ.questionTextEN && !currentQ.questionTextJP && (
                <p className="text-base leading-relaxed text-[#0D1B2A] mb-2"
                  style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif" }}>
                  {currentQ.questionText}
                </p>
              )}
              {/* Japanese text */}
              {showJP && currentQ.questionTextJP && (
                <p className="text-base leading-relaxed text-[#0D1B2A]"
                  style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif", fontSize: '1.1rem', lineHeight: '1.9' }}>
                  {currentQ.questionTextJP}
                </p>
              )}

              {/* Question image */}
              {currentQ.questionImageUrl && (
                <div className="mt-4">
                  <ZoomImage src={currentQ.questionImageUrl} />
                </div>
              )}

              {/* Audio player */}
              {currentQ.questionAudioUrl && (
                <div className="mt-4">
                  <AudioPlayer
                    url={currentQ.questionAudioUrl}
                    limit={currentQ.audioPlayLimit ?? 2}
                  />
                </div>
              )}
            </div>

            {/* Answer options — large rectangles like real JFT */}
            <div className="space-y-3">
              {currentQ.options.map(opt => {
                const selected = answers[currentQ.id] === opt.index
                return (
                  <button
                    key={opt.index}
                    type="button"
                    onClick={() => setAnswers(prev => ({ ...prev, [currentQ.id]: opt.index }))}
                    className={`flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all ${
                      selected
                        ? 'border-[#0B3D6B] bg-[#0B3D6B] text-white shadow-md'
                        : 'border-[#DDE3EC] bg-white hover:border-[#0B3D6B]/40 hover:bg-[#F5F7FB]'
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black border-2 ${
                      selected
                        ? 'border-white/30 bg-white/20 text-white'
                        : 'border-[#DDE3EC] text-[#0B3D6B]'
                    }`}>
                      {['A', 'B', 'C', 'D'][opt.index - 1] ?? opt.index}
                    </div>
                    <span
                      className={`flex-1 text-base font-medium leading-relaxed ${selected ? 'text-white' : 'text-[#0D1B2A]'}`}
                      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif" }}
                    >
                      {opt.text}
                    </span>
                    {opt.imageUrl && (
                      <div className="w-32 shrink-0">
                        <img src={opt.imageUrl} alt="" className="w-full rounded-xl object-contain" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => currentIdx > 0 && setCurrentIdx(i => i - 1)}
                disabled={currentIdx === 0}
                className="flex items-center gap-2 rounded-xl border border-[#DDE3EC] bg-white px-4 py-2.5 text-sm font-semibold text-[#5A6A7A] disabled:opacity-30 hover:bg-[#F5F7FB]"
              >
                <span className="ti ti-chevron-left" />
                Back
              </button>

              {/* Mobile question dots */}
              <div className="flex flex-1 gap-1 overflow-x-auto py-1 scrollbar-hide md:hidden">
                {questions.map((q, idx) => {
                  const isAns = answers[q.id] !== null && answers[q.id] !== undefined
                  const isFl = flagged.has(q.id)
                  const isCurr = idx === currentIdx
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                        isCurr ? 'bg-[#0B3D6B] text-white scale-110' :
                        isFl ? 'bg-[#E8A020] text-white' :
                        isAns ? 'bg-emerald-500 text-white' :
                        'bg-[#DDE3EC] text-[#5A6A7A]'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1)
                  else void handleSubmit()
                }}
                disabled={submitting}
                className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold disabled:opacity-50 transition-all ${
                  currentIdx === questions.length - 1
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-[#0B3D6B] text-white hover:bg-[#1A6BAD]'
                }`}
              >
                {submitting ? 'Saving...' : currentIdx === questions.length - 1 ? 'Finish' : 'Next'}
                <span className={`ti ${currentIdx === questions.length - 1 ? 'ti-check' : 'ti-chevron-right'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
