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

      if (p.isUnlocked !== true) {
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
      setQuestions(qsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamQuestion)))

      setPhase('start')
    } catch (err) {
      console.error('[ExamPage load]', err)
      setError('Failed to load exam.')
      setPhase('start')
    }
  }, [paperId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (phase !== 'exam') return
    if (timeLeft <= 0) { void handleSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  })

  async function handleSubmit() {
    if (!paper) return
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
    } catch (err) {
      console.error('[ExamPage submit]', err)
    } finally {
      setPhase('results')
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
          <button
            type="button"
            onClick={() => { setAnswers({}); setFlagged(new Set()); setCurrentQ(0); setTimeLeft(paper?.timeLimitSeconds ?? 3600); setScore(null); setPhase('start') }}
            className="flex-1 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B]"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  )

  // ── EXAM ──
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F5F7FB] dark:bg-[#04090f]">
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
                {/* Question image — above question text */}
                {(q.questionImageUrl || q.imageUrl) && (
                  <div className="mb-4 overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-white/20">
                    <img
                      src={q.questionImageUrl ?? q.imageUrl}
                      alt="Question"
                      className="max-h-[280px] w-full object-contain bg-white dark:bg-white/[0.04]"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                )}

                {/* Question text */}
                {q.questionText && (
                  <p className="text-base leading-relaxed font-semibold text-[#0D1B2A] dark:text-white">{q.questionText}</p>
                )}
                {q.questionTextJP && (
                  <p className="mt-2 text-sm text-blue-600 dark:text-blue-300">{q.questionTextJP}</p>
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
                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: Number(opt.index) }))}
                    className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      selected
                        ? 'border-[#E8A020] bg-[#FEF3E2] dark:bg-[#0B3D6B]/40 text-gray-900 dark:text-white'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
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
            onClick={() => setCurrentQ(i => i - 1)}
            className="flex items-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 disabled:opacity-40"
          >
            <span className="ti ti-arrow-left" /> Previous
          </button>
          <span className="whitespace-nowrap text-xs text-[#5A6A7A] dark:text-white/50">{answered} of {questions.length} answered</span>
          <button
            type="button"
            disabled={currentQ === questions.length - 1}
            onClick={() => setCurrentQ(i => i + 1)}
            className="flex items-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 disabled:opacity-40"
          >
            Next <span className="ti ti-arrow-right" />
          </button>
        </div>

        {/* Question number pills */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {questions.map((qs, i) => {
            const isAnswered = answers[qs.id] !== undefined
            const isCurrent = i === currentQ
            return (
              <button
                key={qs.id}
                type="button"
                onClick={() => setCurrentQ(i)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors ${
                  isCurrent
                    ? 'border-[#E8A020] bg-[#E8A020] text-[#0B3D6B]'
                    : isAnswered
                    ? 'border-[#0B3D6B] bg-[#0B3D6B] text-white'
                    : 'border-gray-300 bg-transparent text-[#5A6A7A] dark:border-gray-600 dark:text-white/50'
                } ${flagged.has(qs.id) ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900' : ''}`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
