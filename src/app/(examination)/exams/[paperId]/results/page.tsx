'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import ResultCard, { GradeBadge } from '@/components/exam/ResultCard'
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-6 sm:p-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-sm text-[#5A6A7A]">{attempt.paperCode}</p>
            <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
              Exam Results
            </h1>
            <p className="mt-1 text-sm text-[#5A6A7A]">{attempt.studentName}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <GradeBadge grade={attempt.grade ?? 'D'} />
            <p className="font-jakarta text-lg font-bold text-[#0B3D6B]">
              {attempt.totalScore ?? 0}%
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ResultCard label="Reading" score={attempt.readingScore} />
          <ResultCard label="Listening" score={attempt.listeningScore} />
          <ResultCard
            label="Writing"
            score={attempt.writingScore}
            pending={attempt.writingScore == null && pollCount < 20}
          />
          <ResultCard label="Speaking" score={attempt.speakingScore} pending={speakingPending} />
        </div>

        {writingFeedback && (
          <div className="mt-8 rounded-lg bg-[#F5F7FB] p-5">
            <h2 className="font-jakarta font-semibold text-[#0B3D6B]">Writing feedback</h2>
            {writingFeedback.strengths && writingFeedback.strengths.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase text-green-700">Strengths</p>
                <ul className="mt-1 list-inside list-disc text-sm text-[#0D1B2A]">
                  {writingFeedback.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {writingFeedback.improvements && writingFeedback.improvements.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase text-amber-700">Improvements</p>
                <ul className="mt-1 list-inside list-disc text-sm text-[#0D1B2A]">
                  {writingFeedback.improvements.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {speakingPending && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Speaking: Pending teacher review
          </p>
        )}

        <div className="mt-8">
          <h2 className="font-jakarta font-semibold text-[#0B3D6B]">Answer review</h2>
          <div className="mt-4 space-y-4">
            {readingQs.map((q) => {
              const ans = answers[q.id]
              const correct = ans?.toUpperCase() === q.correctAnswer.toUpperCase()
              return (
                <div
                  key={q.id}
                  className={`rounded-lg border p-4 ${correct ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}
                >
                  <p className="text-xs text-[#5A6A7A]">Reading Q{q.questionNumber}</p>
                  <p className="font-medium text-[#0D1B2A]">{q.questionText}</p>
                  <p className="mt-1 text-sm">
                    Your answer: <strong>{ans ?? '—'}</strong> · Correct:{' '}
                    <strong>{q.correctAnswer}</strong>
                  </p>
                  {q.explanation && (
                    <p className="mt-1 text-xs text-[#5A6A7A]">{q.explanation}</p>
                  )}
                </div>
              )
            })}
            {listeningQs.map((q) => {
              const ans = answers[q.id]
              const correct = ans?.toUpperCase() === q.correctAnswer.toUpperCase()
              return (
                <div
                  key={q.id}
                  className={`rounded-lg border p-4 ${correct ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}
                >
                  <p className="text-xs text-[#5A6A7A]">Listening Q{q.questionNumber}</p>
                  <p className="font-medium text-[#0D1B2A]">{q.questionText}</p>
                  <p className="mt-1 text-sm">
                    Your answer: <strong>{ans ?? '—'}</strong> · Correct:{' '}
                    <strong>{q.correctAnswer}</strong>
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/exams/${paperId}`}
            className="rounded-lg bg-[#E8A020] px-6 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B]"
          >
            Take again
          </Link>
          <Link
            href="/exams"
            className="rounded-lg border border-[#DDE3EC] px-6 py-2.5 font-jakarta text-sm font-semibold text-[#0B3D6B]"
          >
            All exams
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <Leaderboard
          paperId={paperId}
          currentStudentId={
            user.role === 'student' ? student?.id ?? user.uid : undefined
          }
          title="Paper leaderboard"
        />
      </div>
    </div>
  )
}
