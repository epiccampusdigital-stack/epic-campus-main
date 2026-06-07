'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import ExamTopbar from '@/components/exam/ExamTopbar'
import Leaderboard from '@/components/exam/Leaderboard'
import { useExamPortal } from '@/components/exam/ExamContext'
import {
  fetchListeningQuestions,
  fetchReadingQuestions,
  getAttempt,
  loadAnswers,
} from '@/lib/exam/helpers'
import { db } from '@/lib/firebase/client'
import type { ExamAttempt, ListeningQuestion, ReadingQuestion } from '@/types'

interface WritingFeedback {
  strengths?: string[]
  improvements?: string[]
}

export default function ExamResultsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, student } = useExamPortal()
  const paperId = String(params.paperId ?? '')
  const attemptId = searchParams.get('attemptId')
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null)
  const [readingQs, setReadingQs] = useState<ReadingQuestion[]>([])
  const [listeningQs, setListeningQs] = useState<ListeningQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [writingFeedback, setWritingFeedback] = useState<WritingFeedback | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const loadData = useCallback(async () => {
    if (!attemptId) return
    const a = await getAttempt(attemptId)
    setAttempt(a)
    if (a) {
      const snap = await getDoc(doc(db, 'examAttempts', attemptId))
      const raw = snap.data()
      if (raw?.writingFeedback) {
        setWritingFeedback(raw.writingFeedback as WritingFeedback)
      }
    }
    setReadingQs(await fetchReadingQuestions(paperId))
    setListeningQs(await fetchListeningQuestions(paperId))
    setAnswers(await loadAnswers(attemptId))
  }, [attemptId, paperId])

  useEffect(() => {
    if (!attemptId) {
      router.replace(`/exams/${paperId}`)
      return
    }
    loadData()
  }, [attemptId, loadData, paperId, router])

  useEffect(() => {
    if (!attemptId || attempt?.writingScore != null || pollCount >= 20) return
    const t = setInterval(async () => {
      setPollCount((c) => c + 1)
      setElapsedSeconds((s) => s + 3)
      const a = await getAttempt(attemptId)
      setAttempt(a)
      if (a?.writingScore != null) {
        const snap = await getDoc(doc(db, 'examAttempts', attemptId))
        const raw = snap.data()
        if (raw?.writingFeedback) {
          setWritingFeedback(raw.writingFeedback as WritingFeedback)
        }
      }
    }, 3000)
    return () => clearInterval(t)
  }, [attempt?.writingScore, attemptId, pollCount])

  if (!attemptId || !attempt) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0B3D6B] border-t-transparent" />
      </div>
    )
  }

  const speakingPending = attempt.speakingScore == null
  const writingPending = attempt.writingScore == null && pollCount < 20
  const grade = attempt.grade ?? 'D'
  const overallScore = attempt.totalScore ?? 0

  const gradeColor =
    grade === 'S' ? 'bg-purple-50 text-purple-600 border-purple-200'
    : grade === 'A' ? 'bg-green-50 text-green-600 border-green-200'
    : grade === 'B' ? 'bg-blue-50 text-[#0B3D6B] border-blue-200'
    : grade === 'C' ? 'bg-amber-50 text-amber-600 border-amber-200'
    : 'bg-red-50 text-red-500 border-red-200'

  return (
    <div className="flex flex-col min-h-screen">
      <ExamTopbar paperCode={attempt.paperCode} section="results" />

      <div className="max-w-2xl mx-auto px-4 py-8 w-full">

        {/* Top 2-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

          {/* Grade card */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 text-center shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.06em] text-gray-400 mb-4">Overall Grade</div>
            <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center
                            text-3xl font-bold border-2 ${gradeColor}`}>
              {grade}
            </div>
            <div className="text-[32px] font-bold text-[#0B3D6B] tabular-nums">{overallScore}%</div>
            <div className="text-[12px] text-gray-400 mb-5">
              {attempt.paperCode} · {attempt.studentName}
            </div>

            {/* 4-section score bars */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Reading',   score: attempt.readingScore,   color: 'bg-green-500' },
                { label: 'Listening', score: attempt.listeningScore, color: 'bg-[#0B3D6B]' },
                { label: 'Writing',   score: attempt.writingScore,   color: 'bg-[#E8A020]' },
                { label: 'Speaking',  score: attempt.speakingScore,  color: 'bg-purple-500' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{s.label}</div>
                  <div className="text-[18px] font-semibold text-gray-800 tabular-nums">
                    {s.score != null ? s.score : '—'}
                  </div>
                  <div className="h-[3px] bg-gray-100 rounded-full mt-1">
                    <div
                      className={`h-[3px] ${s.color} rounded-full transition-all`}
                      style={{ width: `${s.score ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI feedback card */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
            <div className="text-[13px] font-medium text-gray-800 mb-3">AI Feedback</div>
            {writingPending || speakingPending ? (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                ⏳ AI is marking your writing/speaking…
                {elapsedSeconds >= 60 && (
                  <p className="text-xs mt-1 text-amber-700">
                    This may take a few minutes. Partial results shown above.
                  </p>
                )}
              </div>
            ) : writingFeedback ? (
              <>
                {writingFeedback.strengths && writingFeedback.strengths.length > 0 && (
                  <>
                    <div className="text-[11px] font-semibold text-green-600 mb-1">✓ Strengths</div>
                    <p className="text-[12px] text-gray-500 mb-3">
                      {writingFeedback.strengths.join(' · ')}
                    </p>
                  </>
                )}
                {writingFeedback.improvements && writingFeedback.improvements.length > 0 && (
                  <>
                    <div className="text-[11px] font-semibold text-[#E8A020] mb-1">↑ To improve</div>
                    <p className="text-[12px] text-gray-500">
                      {writingFeedback.improvements.join(' · ')}
                    </p>
                  </>
                )}
              </>
            ) : (
              <p className="text-[12px] text-gray-400 italic">
                Feedback will appear here once marking is complete.
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center mb-8">
          <button
            onClick={() => router.push('/exams')}
            className="px-5 py-2 border border-gray-200 rounded-[7px] text-sm text-gray-600
                       hover:bg-gray-50 transition-colors"
          >
            ← Back to exams
          </button>
          <button
            onClick={() => router.push(`/exams/${paperId}`)}
            className="px-5 py-2 bg-[#0B3D6B] text-white rounded-[7px] text-sm font-medium
                       hover:bg-[#0B3D6B]/90 transition-colors"
          >
            Try again →
          </button>
        </div>

        {/* Answer review */}
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.08em] text-gray-400 font-semibold
                          bg-gray-50 px-4 py-2 border-y border-gray-100 mb-0">
            Answer Review
          </div>
          <div className="bg-white border-x border-b border-gray-100 rounded-b-xl overflow-hidden">
            {[...readingQs.map((q, i) => ({ q, section: 'Reading', i })),
              ...listeningQs.map((q, i) => ({ q, section: 'Listening', i }))
            ].map(({ q, section, i }) => {
              const ans = answers[q.id]
              const correct = ans?.toUpperCase() === q.correctAnswer.toUpperCase()
              return (
                <div
                  key={q.id}
                  className={`px-4 py-3 border-b border-gray-100 text-[13px]
                              ${correct ? 'bg-green-50/40' : 'bg-red-50/40'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-2">
                        {section} Q{i + 1}
                      </span>
                      <span className="text-gray-700">{q.questionText}</span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-xs font-semibold ${correct ? 'text-green-600' : 'text-red-500'}`}>
                        {ans ?? '—'}
                      </span>
                      {!correct && (
                        <span className="text-xs text-gray-400 ml-1">
                          / {q.correctAnswer}
                        </span>
                      )}
                    </div>
                  </div>
                  {'explanation' in q && q.explanation && (
                    <p className="text-[11px] text-gray-400 mt-1">{q.explanation}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <Leaderboard
          paperId={paperId}
          currentStudentId={user.role === 'student' ? student?.id ?? user.uid : undefined}
          title="Paper leaderboard"
        />
      </div>
    </div>
  )
}
