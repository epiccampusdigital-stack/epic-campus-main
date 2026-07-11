'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useExamPortal } from '@/components/exam/ExamContext'

interface ExamPaper {
  id: string
  title: string
  description?: string
  categoryId?: string
  totalQuestions?: number
  timeLimitSeconds?: number
  passMark?: number
  hasAudioCheck?: boolean
  isPublished?: boolean
  isUnlocked?: boolean
  maxAttempts?: number
  shuffleEnabled?: boolean
}

interface ExamSection {
  id: string
  name: string
  order: number
  sectionType?: string
}

interface ExamQuestion {
  id: string
  sectionId: string
  order: number
  questionText?: string
  questionTextJP?: string
  questionTextEN?: string
  options: { index: number; text: string; imageUrl?: string }[]
  correctIndex: number
  audioUrl?: string
  imageUrl?: string
  questionAudioUrl?: string
  questionImageUrl?: string
  audioPlayLimit?: number
  languageMode?: 'en' | 'jp' | 'both'
}

type Phase = 'loading' | 'start' | 'locked' | 'audio-check' | 'exam' | 'submitting' | 'results'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// Fisher–Yates shuffle (returns a new array; does not mutate the input).
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function AudioPlayer({ src, playLimit }: { src: string; playLimit?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [playCount, setPlayCount] = useState(0)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const limit = playLimit ?? 99

  function handlePlay() {
    if (!audioRef.current) return
    if (playCount >= limit) return
    audioRef.current.currentTime = 0
    void audioRef.current.play()
  }

  return (
    <div className="mt-3 rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] p-3">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => { setPlaying(true); setPlayCount(c => c + 1) }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setProgress(audioRef.current.currentTime)
            setDuration(audioRef.current.duration || 0)
          }
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={playCount >= limit}
          onClick={handlePlay}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-all ${
            playing ? 'bg-[#E8A020]' : playCount >= limit ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-[#0B3D6B] hover:bg-[#1A6BAD]'
          }`}
        >
          <span className={`ti ${playing ? 'ti-player-pause' : 'ti-player-play'} text-sm`} />
        </button>
        <div className="flex-1 space-y-1">
          <div className="h-1.5 rounded-full bg-[#DDE3EC] dark:bg-white/20 overflow-hidden">
            <div
              className="h-full bg-[#E8A020] transition-all"
              style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#5A6A7A] dark:text-white/40">
            <span>{Math.floor(progress)}s</span>
            {limit < 99 && (
              <span className={playCount >= limit ? 'text-red-500' : ''}>
                {playCount}/{limit} plays {playCount >= limit ? '(limit reached)' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExamPage() {
  const { paperId } = useParams<{ paperId: string }>()
  const router = useRouter()
  const { user, student } = useExamPortal()

  const [phase, setPhase] = useState<Phase>('loading')
  const [paper, setPaper] = useState<ExamPaper | null>(null)
  const [sections, setSections] = useState<ExamSection[]>([])
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [currentQ, setCurrentQ] = useState(0)
  const [timeLeft, setTimeLeft] = useState(3600)
  const [audioChecked, setAudioChecked] = useState(false)
  const [score, setScore] = useState<{ correct: number; total: number; pct: number } | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [attemptCount, setAttemptCount] = useState(0)
  // Set when a student tries to advance without answering the current question.
  const [unansweredWarning, setUnansweredWarning] = useState(false)

  const load = useCallback(async () => {
    if (!paperId) return
    try {
      const paperSnap = await getDoc(doc(db, 'examPapers', paperId))
      if (!paperSnap.exists()) {
        setError('Exam paper not found.')
        setPhase('start')
        return
      }
      const p = { id: paperSnap.id, ...paperSnap.data() } as ExamPaper
      setPaper(p)
      setTimeLeft(p.timeLimitSeconds ?? 3600)

      // Only block papers explicitly locked. Legacy papers without the field are open.
      if (p.isUnlocked === false) {
        setPhase('locked')
        return
      }

      const secsSnap = await getDocs(
        query(collection(db, 'examSections'), where('paperId', '==', paperId), orderBy('order', 'asc'))
      ).catch(() => getDocs(query(collection(db, 'examSections'), where('paperId', '==', paperId))))
      setSections(secsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSection)))

      const qsSnap = await getDocs(
        query(collection(db, 'examQuestions'), where('paperId', '==', paperId), orderBy('order', 'asc'))
      ).catch(() => getDocs(query(collection(db, 'examQuestions'), where('paperId', '==', paperId))))
      const fetchedQs = qsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamQuestion))
      // Shuffle ONLY when the paper opts in (shuffleEnabled === true). Missing/undefined
      // → no shuffle, so existing papers are unchanged (backward compatible). When on,
      // both the question order AND each question's option order are randomised per
      // student. Answers are saved/scored by option .index, so shuffling options only
      // changes display order and never affects scoring. Firestore is never modified.
      const displayQs = p.shuffleEnabled ? shuffleArray(fetchedQs) : fetchedQs
      const processedQs = displayQs.map(qd => ({
        ...qd,
        options: p.shuffleEnabled ? shuffleArray(qd.options) : qd.options,
      }))
      setQuestions(processedQs)

      setPhase('start')
    } catch (err) {
      console.error('[ExamPage load]', err)
      setError('Failed to load exam.')
      setPhase('start')
    }
  }, [paperId])

  useEffect(() => { void load() }, [load])

  // Count this student's previous completed attempts for this paper — used to
  // enforce paper.maxAttempts on the "Try Again" button.
  useEffect(() => {
    const uid = user?.uid
    if (!paperId || !uid) return
    let cancelled = false
    async function loadAttempts() {
      try {
        const snap = await getDocs(
          query(collection(db, 'examAttempts'), where('studentId', '==', uid)),
        )
        if (cancelled) return
        setAttemptCount(snap.docs.filter(d => d.data().paperId === paperId).length)
      } catch (err) {
        console.error('[ExamPage attempts]', err)
      }
    }
    void loadAttempts()
    return () => { cancelled = true }
  }, [paperId, user])

  useEffect(() => {
    if (phase !== 'exam') return
    if (timeLeft <= 0) { void handleSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  })

  async function handleSubmit() {
    if (!paper) return
    setToast('')
    setPhase('submitting')
    try {
      const correct = questions.filter(q => Number(answers[q.id]) === Number(q.correctIndex)).length
      const total = questions.length
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0
      setScore({ correct, total, pct })
      await addDoc(collection(db, 'examAttempts'), {
        studentId: user.uid,
        studentName: student?.name ?? user.displayName ?? 'Student',
        studentCode: student?.studentCode ?? '',
        paperId: paper.id,
        paperTitle: paper.title,
        answers,
        score: correct,
        totalQuestions: total,
        percentage: pct,
        timeTaken: (paper.timeLimitSeconds ?? 3600) - timeLeft,
        status: 'completed',
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      })
      // Only advance to results after the attempt was actually saved.
      setAttemptCount(c => c + 1)
      setPhase('results')
    } catch (err) {
      console.error('[ExamPage submit]', err)
      // Keep the exam state so the student can retry submitting.
      setToast('Failed to save your results. Please check your connection and try again.')
      setPhase('exam')
    }
  }

  function toggleFlag(qId: string) {
    setFlagged(prev => {
      const next = new Set(prev)
      next.has(qId) ? next.delete(qId) : next.add(qId)
      return next
    })
  }

  const q = questions[currentQ]
  const section = q ? sections.find(s => s.id === q.sectionId) : null
  const answered = Object.keys(answers).length
  const timerWarn = timeLeft < 300
  const passed = score && paper && score.pct >= (paper.passMark ?? 80)
  const maxReached = paper?.maxAttempts != null && attemptCount >= paper.maxAttempts

  // ── LOADING ──
  if (phase === 'loading') return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#0B3D6B] border-t-transparent" />
        <p className="mt-4 text-sm text-[#5A6A7A]">Loading exam...</p>
      </div>
    </div>
  )

  // ── LOCKED ──
  if (phase === 'locked') return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-4">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0B3D6B]/10">
          <span className="ti ti-lock text-3xl text-[#0B3D6B]" />
        </div>
        <div>
          <h1 className="font-jakarta text-xl font-bold text-[#0B3D6B]">This exam is not currently available</h1>
          <p className="mt-2 text-sm text-[#5A6A7A]">Check back later or ask your teacher to unlock it.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/exams')}
          className="mx-auto flex items-center gap-2 rounded-xl border border-[#DDE3EC] bg-white px-6 py-3 text-sm font-semibold text-[#5A6A7A]"
        >
          <span className="ti ti-arrow-left" /> Back to exam list
        </button>
      </div>
    </div>
  )

  // ── START ──
  if (phase === 'start') return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-4">
      <div className="w-full max-w-lg space-y-5">
        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="rounded-2xl bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD] p-6 text-white">
          <h1 className="font-jakarta text-2xl font-bold">{paper?.title ?? 'Exam'}</h1>
          {paper?.description && <p className="mt-1 text-sm text-white/70">{paper.description}</p>}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xl font-bold">{questions.length}</p>
              <p className="text-xs text-white/60">Questions</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xl font-bold">{formatTime(paper?.timeLimitSeconds ?? 3600)}</p>
              <p className="text-xs text-white/60">Time</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xl font-bold">{paper?.passMark ?? 80}%</p>
              <p className="text-xs text-white/60">Pass Mark</p>
            </div>
          </div>
        </div>

        {sections.length > 0 && (
          <div className="rounded-2xl border border-[#DDE3EC] bg-white p-5">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] mb-3">Exam Sections</h2>
            <div className="space-y-2">
              {sections.map((sec, i) => (
                <div key={sec.id} className="flex items-center gap-3 text-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B3D6B]/10 text-xs font-bold text-[#0B3D6B]">{i + 1}</div>
                  <span className="text-[#0D1B2A]">{sec.name}</span>
                  <span className="ml-auto text-xs text-[#5A6A7A]">
                    {questions.filter(qs => qs.sectionId === sec.id).length} questions
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[#DDE3EC] bg-white p-5">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] mb-2">Before you begin</h2>
          <ul className="space-y-1 text-sm text-[#5A6A7A]">
            <li className="flex items-center gap-2"><span className="ti ti-check text-emerald-500" />Stable internet connection required</li>
            <li className="flex items-center gap-2"><span className="ti ti-check text-emerald-500" />Do not refresh or close the browser</li>
            <li className="flex items-center gap-2"><span className="ti ti-check text-emerald-500" />Timer starts immediately when you begin</li>
            <li className="flex items-center gap-2"><span className="ti ti-check text-emerald-500" />Flag questions to review before submitting</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="flex-1 rounded-xl border border-[#DDE3EC] bg-white py-3 text-sm font-semibold text-[#5A6A7A]">Back</button>
          <button
            type="button"
            disabled={questions.length === 0}
            onClick={() => paper?.hasAudioCheck ? setPhase('audio-check') : setPhase('exam')}
            className="flex-1 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B] disabled:opacity-40"
          >
            {questions.length === 0 ? 'No Questions Yet' : 'Begin Exam →'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── AUDIO CHECK ──
  if (phase === 'audio-check') return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#0B3D6B]/10">
          <span className="ti ti-volume text-4xl text-[#0B3D6B]" />
        </div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Audio Check</h1>
        <p className="text-sm text-[#5A6A7A]">This exam has listening questions. Confirm your audio is working.</p>
        <div className="rounded-2xl border border-[#DDE3EC] bg-white p-5 text-left">
          <p className="text-sm font-semibold text-[#0B3D6B] mb-3">Play the test sound:</p>
          <audio controls className="w-full" onPlay={() => setAudioChecked(true)}>
            <source src="/audio/test-tone.mp3" type="audio/mpeg" />
          </audio>
          {audioChecked && (
            <p className="mt-3 text-sm text-emerald-600 flex items-center gap-1">
              <span className="ti ti-check" />Audio confirmed!
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => setPhase('start')} className="flex-1 rounded-xl border border-[#DDE3EC] bg-white py-3 text-sm font-semibold text-[#5A6A7A]">Back</button>
          <button type="button" onClick={() => { setAudioChecked(true); setPhase('exam') }} className="flex-1 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B]">
            {audioChecked ? 'Start Exam →' : 'Skip & Start'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── SUBMITTING ──
  if (phase === 'submitting') return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#0B3D6B] border-t-transparent" />
        <p className="mt-4 text-sm text-[#5A6A7A]">Submitting your exam...</p>
      </div>
    </div>
  )

  // ── RESULTS ──
  if (phase === 'results') return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-4">
      <div className="w-full max-w-lg space-y-5">
        <div className={`rounded-2xl p-6 text-white text-center ${passed ? 'bg-gradient-to-br from-emerald-600 to-emerald-500' : 'bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD]'}`}>
          <div className="text-5xl mb-3">{passed ? '🏆' : '📚'}</div>
          <h1 className="font-jakarta text-2xl font-bold">{passed ? 'Congratulations!' : 'Keep Practising!'}</h1>
          <p className="mt-1 text-sm text-white/70">{paper?.title}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-2xl font-bold">{score?.pct ?? 0}%</p>
              <p className="text-xs text-white/60">Score</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-2xl font-bold">{score?.correct ?? 0}/{score?.total ?? 0}</p>
              <p className="text-xs text-white/60">Correct</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-2xl font-bold">{passed ? '✓' : '✗'}</p>
              <p className="text-xs text-white/60">{passed ? 'Passed' : 'Not Yet'}</p>
            </div>
          </div>
        </div>

        {/* Summary row + per-question status tiles (correct / wrong / skipped) */}
        <div className="rounded-2xl border border-[#DDE3EC] bg-white p-5">
          <p className="text-center text-sm font-semibold text-[#0D1B2A]">
            Answered: {Object.keys(answers).length} | Skipped: {questions.length - Object.keys(answers).length} | Total: {questions.length}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {questions.map((qs, i) => {
              const ua = answers[qs.id]
              const isSkipped = ua === undefined
              const isCorrect = !isSkipped && Number(ua) === Number(qs.correctIndex)
              return (
                <div
                  key={qs.id}
                  title={`Q${i + 1}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                    isSkipped
                      ? 'bg-gray-200 text-gray-500'
                      : isCorrect
                      ? 'bg-emerald-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {isSkipped ? '—' : isCorrect ? <span className="ti ti-check" /> : <span className="ti ti-x" />}
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[#5A6A7A]">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Correct</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Wrong</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gray-200" /> Skipped</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE3EC] bg-white p-5">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] mb-3">Question Review</h2>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {questions.map((qs, i) => {
              const userAns = answers[qs.id]
              const correct = Number(userAns) === Number(qs.correctIndex)
              const correctOption = qs.options.find(o => o.index === qs.correctIndex)
              return (
                <div key={qs.id} className={`rounded-xl p-3 text-sm ${correct ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 font-bold text-xs mt-0.5 ${correct ? 'text-emerald-600' : 'text-red-600'}`}>Q{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#5A6A7A] line-clamp-2">{qs.questionText ?? qs.questionTextJP}</p>
                      {!correct && correctOption && (
                        <p className="text-xs text-emerald-700 font-semibold mt-1">✓ {correctOption.text}</p>
                      )}
                    </div>
                    <span className={`shrink-0 ti ${correct ? 'ti-check text-emerald-600' : 'ti-x text-red-500'}`} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.push('/exams')} className="flex-1 rounded-xl border border-[#DDE3EC] bg-white py-3 text-sm font-semibold text-[#5A6A7A]">All Exams</button>
          {maxReached ? (
            <div className="flex-1 rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] py-3 text-center text-sm font-semibold text-[#5A6A7A]">
              Maximum attempts reached
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAnswers({}); setFlagged(new Set()); setCurrentQ(0)
                setTimeLeft(paper?.timeLimitSeconds ?? 3600); setScore(null)
                setUnansweredWarning(false)
                // Re-shuffle question order for the retry only when the paper opts in
                // (options keep their load-time order); otherwise leave order untouched.
                setQuestions(prev => (paper?.shuffleEnabled ? shuffleArray(prev) : prev))
                setPhase('start')
              }}
              className="flex-1 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B]"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )

  // ── EXAM ──
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F5F7FB] dark:bg-[#04090f]">
      {toast && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-xl bg-red-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
      {/* Top bar */}
      <div className={`flex shrink-0 items-center justify-between px-4 py-3 ${timerWarn ? 'bg-red-600' : 'bg-[#0B3D6B]'}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { if (confirm('Exit? Your progress will be lost.')) router.push('/exams') }}
            className="text-white/60 hover:text-white"
          >
            <span className="ti ti-x text-xl" />
          </button>
          <div>
            {section && <p className="text-xs text-white/60">{section.name}</p>}
            <p className="text-sm font-bold text-white">{currentQ + 1} / {questions.length}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono font-bold text-white ${timerWarn ? 'bg-red-700 animate-pulse' : 'bg-white/10'}`}>
          <span className="ti ti-clock" />{formatTime(timeLeft)}
        </div>
        <button
          type="button"
          onClick={() => { if (confirm(`Submit? ${answered}/${questions.length} answered.`)) void handleSubmit() }}
          className="rounded-xl bg-[#E8A020] px-3 py-1.5 text-xs font-bold text-[#0B3D6B]"
        >
          Submit
        </button>
      </div>

      {/* Progress */}
      <div className="h-1 shrink-0 bg-white/10">
        <div className="h-full bg-[#E8A020] transition-all" style={{ width: `${questions.length > 0 ? (answered / questions.length) * 100 : 0}%` }} />
      </div>

      {/* Split content — left: question, right: options */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Left panel — question content */}
        <div className="flex-[2] overflow-y-auto bg-gray-50 p-6 dark:bg-gray-900 md:w-[55%] md:flex-none md:p-8">
          {q ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Question text — always first (top) */}
                {q.questionText && (
                  <p className="text-base leading-relaxed font-semibold text-[#0D1B2A] dark:text-white">{q.questionText}</p>
                )}
                {q.questionTextJP && (
                  <p className="mt-2 text-sm text-blue-600 dark:text-blue-300">{q.questionTextJP}</p>
                )}

                {/* Question image — below the question text */}
                {(q.questionImageUrl || q.imageUrl) && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-white/20">
                    <img
                      src={q.questionImageUrl ?? q.imageUrl}
                      alt="Question"
                      className="max-h-[280px] w-full object-contain bg-white dark:bg-white/[0.04]"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                )}

                {/* Audio player */}
                {(q.questionAudioUrl || q.audioUrl) && (
                  <AudioPlayer
                    src={q.questionAudioUrl ?? q.audioUrl ?? ''}
                    playLimit={q.audioPlayLimit}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleFlag(q.id)}
                className={`shrink-0 rounded-xl p-2 ${flagged.has(q.id) ? 'bg-amber-100 text-amber-600' : 'bg-white dark:bg-white/[0.06] text-[#5A6A7A] dark:text-white/50'}`}
              >
                <span className="ti ti-flag text-lg" />
              </button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-[#5A6A7A]">No questions found</p>
            </div>
          )}
        </div>

        {/* Right panel — answer options */}
        <div className="flex-[3] overflow-y-auto border-t border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 md:w-[45%] md:flex-none md:border-l md:border-t-0 md:p-8">
          {q && (
            <div className="space-y-3">
              {q.options.map(opt => {
                const selected = answers[q.id] === opt.index
                return (
                  <button
                    key={opt.index}
                    type="button"
                    onClick={() => {
                      setAnswers(prev => ({ ...prev, [q.id]: Number(opt.index) }))
                      // As soon as an answer is chosen, clear the "answer required" warning.
                      setUnansweredWarning(false)
                      setToast('')
                    }}
                    className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      selected
                        ? 'border-[#E8A020] bg-[#FEF3E2] dark:bg-[#0B3D6B]/40 text-gray-900 dark:text-white'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600'
                    } ${unansweredWarning ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-gray-800' : ''}`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                      selected ? 'border-[#E8A020] bg-[#E8A020] text-white' : 'border-gray-300 dark:border-gray-500 text-[#5A6A7A] dark:text-white/60'
                    }`}>
                      {opt.index}
                    </div>
                    {opt.imageUrl ? (
                      <img src={opt.imageUrl} alt={`Option ${opt.index}`} className="h-16 w-auto rounded-lg object-contain" />
                    ) : (
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {opt.text}
                      </span>
                    )}
                  </button>
                )
              })}
              {unansweredWarning && (
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  ⚠ Please select an answer to continue
                </p>
              )}

              {/* Prominent Next / Submit — below the options, sticky on mobile. Reuses
                  the existing navigation + submit logic (handleSubmit unchanged). */}
              <div className="sticky bottom-4 z-10 mt-6 flex justify-center sm:static sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const isLast = currentQ === questions.length - 1
                    if (!isLast) {
                      // Force an answer before advancing (=== undefined so index 0/1 counts).
                      if (q && answers[q.id] === undefined) {
                        setUnansweredWarning(true)
                        setToast('Please answer this question before continuing')
                        return
                      }
                      setUnansweredWarning(false)
                      setToast('')
                      setCurrentQ(i => i + 1)
                    } else {
                      // Last question → same confirmed submit path as the top-bar Submit.
                      if (confirm(`Submit? ${answered}/${questions.length} answered.`)) void handleSubmit()
                    }
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-amber-400/40 transition-all duration-150 hover:scale-105 hover:bg-amber-500 sm:w-auto"
                >
                  {currentQ === questions.length - 1 ? 'Submit Exam' : 'Next Question'}
                  <span className="ti ti-chevron-right text-2xl" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-[#DDE3EC] bg-white px-4 py-2 dark:border-white/[0.08] dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentQ === 0}
            onClick={() => { setUnansweredWarning(false); setToast(''); setCurrentQ(i => i - 1) }}
            className="flex items-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 disabled:opacity-40"
          >
            <span className="ti ti-arrow-left" /> Previous
          </button>
          <span className="whitespace-nowrap text-xs text-[#5A6A7A] dark:text-white/50">{answered} of {questions.length} answered</span>
          {/* Next/Submit moved below the answer options (prominent button). */}
        </div>

        {/* Question number pills — green (answered) / gold (current) / gray (not answered).
            Forward jumps are only allowed to already-answered questions; back is free. */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {questions.map((qs, i) => {
            const isAnswered = answers[qs.id] !== undefined
            const isCurrent = i === currentQ
            const canNavigate = i <= currentQ || isAnswered
            return (
              <button
                key={qs.id}
                type="button"
                disabled={!canNavigate}
                onClick={() => {
                  if (!canNavigate) return
                  setUnansweredWarning(false)
                  setToast('')
                  setCurrentQ(i)
                }}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors ${
                  isCurrent
                    ? 'border-[#E8A020] bg-[#E8A020] text-[#0B3D6B] animate-pulse'
                    : isAnswered
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-gray-300 bg-transparent text-[#5A6A7A] dark:border-gray-600 dark:text-white/50'
                } ${!canNavigate ? 'cursor-not-allowed opacity-40' : ''} ${flagged.has(qs.id) ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900' : ''}`}
              >
                {isAnswered && !isCurrent ? <span className="ti ti-check" /> : i + 1}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[#5A6A7A] dark:text-white/50">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Answered</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#E8A020]" /> Current</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-gray-300 dark:border-gray-600" /> Not answered</span>
        </div>
      </div>
    </div>
  )
}
