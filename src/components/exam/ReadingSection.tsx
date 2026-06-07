'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExamTimer from '@/components/exam/ExamTimer'
import QuestionPalette from '@/components/exam/QuestionPalette'
import { getAttempt, loadAnswers, markSection, saveAnswer } from '@/lib/exam/helpers'
import type { ReadingQuestion } from '@/types'

const PER_PAGE = 5

interface ReadingSectionProps {
  paperId: string
  attemptId: string
  questions: ReadingQuestion[]
  timeLimitMinutes: number
}

export default function ReadingSection({
  paperId,
  attemptId,
  questions,
  timeLimitMinutes,
}: ReadingSectionProps) {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [startedAt, setStartedAt] = useState<Date>(new Date())
  const [submitting, setSubmitting] = useState(false)

  const pageQuestions = questions.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)
  const totalPages = Math.ceil(questions.length / PER_PAGE) || 1

  const questionKey = useMemo(() => {
    const key: Record<string, string> = {}
    questions.forEach((q) => {
      key[q.id] = q.correctAnswer
    })
    return key
  }, [questions])

  useEffect(() => {
    getAttempt(attemptId).then((a) => {
      if (a?.startedAt) setStartedAt(new Date(a.startedAt))
    })
    loadAnswers(attemptId, 'reading').then(setAnswers)
  }, [attemptId])

  useEffect(() => {
    const interval = setInterval(() => {
      Object.entries(answers).forEach(([id, val]) => {
        if (val) {
          const q = questions.find((x) => x.id === id)
          saveAnswer(attemptId, id, val, 'reading', q?.correctAnswer).catch(console.error)
        }
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [answers, attemptId, questions])

  const answeredIndices = useMemo(() => {
    const set = new Set<number>()
    questions.forEach((q, i) => {
      if (answers[q.id]) set.add(i)
    })
    return set
  }, [answers, questions])

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    const q = questions.find((x) => x.id === questionId)
    saveAnswer(attemptId, questionId, value, 'reading', q?.correctAnswer).catch(console.error)
  }

  const finishSection = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      for (const q of questions) {
        const val = answers[q.id]
        if (val) await saveAnswer(attemptId, q.id, val, 'reading', q.correctAnswer)
      }
      await markSection(attemptId, 'reading', questionKey)
      router.push(`/exams/${paperId}/listening?attemptId=${attemptId}`)
    } finally {
      setSubmitting(false)
    }
  }, [answers, attemptId, paperId, questionKey, questions, router, submitting])

  const handleExpire = useCallback(() => {
    finishSection()
  }, [finishSection])

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="mb-2 text-lg font-semibold text-[#0B3D6B]">No questions available for this section yet.</p>
        <p className="mb-6 text-sm text-[#5A6A7A]">
          An admin needs to import questions using the JSON importer in Admin &gt; Exams.
        </p>
        <a
          href="/exams"
          className="inline-block rounded-lg border border-[#DDE3EC] px-6 py-2.5 text-sm font-semibold text-[#0B3D6B]"
        >
          Return to Exam List
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-jakarta text-xl font-bold text-[#0B3D6B]">Reading</h1>
        <ExamTimer
          startedAt={startedAt}
          timeLimitMinutes={timeLimitMinutes}
          onExpire={handleExpire}
        />
      </div>

      <div className="mb-4">
        <QuestionPalette
          total={questions.length}
          currentIndex={page * PER_PAGE}
          answered={answeredIndices}
          onSelect={(i) => setPage(Math.floor(i / PER_PAGE))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
          <p className="mb-2 font-inter text-xs uppercase text-[#5A6A7A]">Passage</p>
          {pageQuestions.map((q) => (
            <p
              key={q.id}
              className="mb-4 font-inter text-lg leading-relaxed text-[#0D1B2A]"
            >
              {q.passageText}
            </p>
          ))}
        </div>

        <div className="space-y-6">
          {pageQuestions.map((q) => (
            <div key={q.id} className="rounded-xl border border-[#DDE3EC] bg-white p-5">
              <p className="mb-1 font-inter text-xs text-[#5A6A7A]">
                Question {q.questionNumber}
              </p>
              <p className="mb-4 font-jakarta font-semibold text-[#0D1B2A]">
                {q.questionText}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx)
                  return (
                    <label
                      key={letter}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        answers[q.id] === letter
                          ? 'border-[#0B3D6B] bg-[#0B3D6B]/5'
                          : 'border-[#DDE3EC] hover:bg-[#F5F7FB]'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={letter}
                        checked={answers[q.id] === letter}
                        onChange={() => handleAnswer(q.id, letter)}
                        className="text-[#0B3D6B]"
                      />
                      <span className="font-medium text-[#0B3D6B]">{letter}.</span>
                      <span className="text-[#0D1B2A]">{opt}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-lg border border-[#DDE3EC] px-4 py-2 text-sm font-semibold text-[#5A6A7A] disabled:opacity-40"
        >
          Previous
        </button>
        {page < totalPages - 1 ? (
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg bg-[#0B3D6B] px-6 py-2 font-jakarta text-sm font-bold text-white"
          >
            Next Page
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={finishSection}
            className="rounded-lg bg-[#E8A020] px-6 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Next Section → Listening'}
          </button>
        )}
      </div>
    </div>
  )
}
