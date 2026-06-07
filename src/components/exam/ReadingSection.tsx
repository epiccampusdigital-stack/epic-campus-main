'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExamTopbar from '@/components/exam/ExamTopbar'
import { getAttempt, loadAnswers, markSection, saveAnswer } from '@/lib/exam/helpers'
import type { ReadingQuestion } from '@/types'

interface ReadingSectionProps {
  paperId: string
  attemptId: string
  questions: ReadingQuestion[]
  timeLimitMinutes: number
  paperCode?: string
}

export default function ReadingSection({
  paperId,
  attemptId,
  questions,
  timeLimitMinutes,
  paperCode = '',
}: ReadingSectionProps) {
  const router = useRouter()
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [startedAt, setStartedAt] = useState<Date>(new Date())
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const questionKey = useMemo(() => {
    const key: Record<string, string> = {}
    questions.forEach((q) => { key[q.id] = q.correctAnswer })
    return key
  }, [questions])

  useEffect(() => {
    getAttempt(attemptId).then((a) => {
      if (a?.startedAt) setStartedAt(new Date(a.startedAt))
    })
    loadAnswers(attemptId, 'reading').then(setAnswers)
  }, [attemptId])

  // Auto-save every 30 s
  useEffect(() => {
    const interval = setInterval(() => {
      Object.entries(answers).forEach(([id, val]) => {
        if (val) {
          const q = questions.find((x) => x.id === id)
          saveAnswer(attemptId, id, val, 'reading', q?.correctAnswer).catch(console.error)
        }
      })
    }, 30_000)
    return () => clearInterval(interval)
  }, [answers, attemptId, questions])

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

  // Timer
  const finishRef = useRef(finishSection)
  useEffect(() => { finishRef.current = finishSection })

  useEffect(() => {
    const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000)
    const remaining = Math.max(0, timeLimitMinutes * 60 - elapsed)
    setTimeLeft(remaining)
    if (remaining === 0) { finishRef.current(); return }
    const t = setInterval(() => {
      setTimeLeft((p) => {
        const next = (p ?? 1) - 1
        if (next <= 0) { finishRef.current(); return 0 }
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [startedAt, timeLimitMinutes])

  const answeredIndices = useMemo(() => {
    const set = new Set<number>()
    questions.forEach((q, i) => { if (answers[q.id]) set.add(i) })
    return set
  }, [answers, questions])

  const handleAnswer = (questionId: string, letter: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: letter }))
    const q = questions.find((x) => x.id === questionId)
    saveAnswer(attemptId, questionId, letter, 'reading', q?.correctAnswer).catch(console.error)
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="mb-2 text-lg font-semibold text-[#0B3D6B]">No questions available for this section yet.</p>
        <p className="mb-6 text-sm text-gray-500">
          An admin needs to import questions using the JSON importer in Admin › Exams.
        </p>
        <a href="/exams" className="inline-block rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-semibold text-[#0B3D6B]">
          Return to Exam List
        </a>
      </div>
    )
  }

  const question = questions[currentQuestion]
  const selectedAnswer = question ? answers[question.id] : undefined
  const isLast = currentQuestion === questions.length - 1

  return (
    <div className="flex flex-col h-screen">
      <ExamTopbar
        paperCode={paperCode}
        section="reading"
        timeLeft={timeLeft ?? undefined}
        currentQ={currentQuestion + 1}
        totalQ={questions.length}
      />

      {/* 2-column body */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 52px - 56px)' }}>

        {/* Main question column */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Question header */}
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-[11px] font-semibold text-[#0B3D6B] bg-[#0B3D6B]/[0.07] px-2 py-0.5 rounded">
              Q{currentQuestion + 1}
            </span>
            <span className="text-[11px] text-gray-400">Multiple choice</span>
          </div>

          {/* Passage — amber left-border box */}
          {question?.passageText && (
            <div className="bg-gray-50 border-l-[3px] border-[#E8A020] rounded-r-lg px-4 py-3 mb-5">
              <p className="font-['Noto_Sans_JP'] text-[14px] leading-[2.2] text-gray-800">
                {question.passageText}
              </p>
            </div>
          )}

          {/* Question text */}
          <p className="text-[14px] font-medium text-gray-800 mb-4">
            {question?.questionText}
          </p>

          {/* Options */}
          {question?.options.map((opt, i) => {
            const letter = ['A', 'B', 'C', 'D'][i]
            const isSelected = selectedAnswer === letter
            return (
              <button
                key={i}
                onClick={() => handleAnswer(question.id, letter)}
                className={`w-full flex items-center gap-3 px-4 py-[10px] rounded-[8px]
                            border text-[13px] text-left mb-2 transition-all
                            ${isSelected
                              ? 'border-[#0B3D6B] bg-[#0B3D6B]/[0.05]'
                              : 'border-gray-200 hover:border-[#1A6BAD] hover:bg-blue-50/30'
                            }`}
              >
                <span className={`w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center
                                  justify-center text-[11px] font-semibold flex-shrink-0 transition-all
                                  ${isSelected
                                    ? 'border-[#0B3D6B] bg-[#0B3D6B] text-white'
                                    : 'border-gray-300 text-gray-400'
                                  }`}>
                  {letter}
                </span>
                <span className={isSelected ? 'text-gray-800' : 'text-gray-600'}>{opt}</span>
              </button>
            )
          })}
        </div>

        {/* Right sidebar */}
        <div className="w-[220px] flex-shrink-0 bg-white border-l border-gray-100 overflow-y-auto px-4 py-5">
          <div className="text-[11px] uppercase tracking-[0.06em] text-gray-400 font-semibold mb-3">
            Questions
          </div>

          {/* Question palette */}
          <div className="grid grid-cols-5 gap-1.5 mb-5">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQuestion(i)}
                className={`w-[30px] h-[30px] rounded-[6px] text-[11px] font-medium border transition-colors
                            ${i === currentQuestion
                              ? 'bg-[#E8A020] text-white border-[#E8A020]'
                              : answeredIndices.has(i)
                                ? 'bg-[#0B3D6B] text-white border-[#0B3D6B]'
                                : 'border-gray-200 text-gray-400 hover:border-gray-300'
                            }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="space-y-1.5 mb-5">
            {[
              { color: 'bg-[#0B3D6B]', label: 'Answered' },
              { color: 'bg-[#E8A020]', label: 'Current' },
              { color: 'bg-gray-100 border border-gray-200', label: 'Unanswered' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-[11px] text-gray-400">
                <div className={`w-[10px] h-[10px] rounded-[3px] ${l.color}`} />
                {l.label}
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-[11px] text-gray-400 mb-1.5">Progress</div>
            <div className="h-[3px] bg-gray-100 rounded-full">
              <div
                className="h-[3px] bg-[#E8A020] rounded-full transition-all"
                style={{ width: `${Math.round((answeredIndices.size / questions.length) * 100)}%` }}
              />
            </div>
            <div className="text-[11px] text-gray-400 mt-1.5 tabular-nums">
              {answeredIndices.size} / {questions.length} answered
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <div className="bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-40 flex-shrink-0">
        <button
          onClick={() => setCurrentQuestion((c) => Math.max(0, c - 1))}
          disabled={currentQuestion === 0}
          className="px-4 py-2 border border-gray-200 rounded-[7px] text-sm text-gray-500
                     hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>
        <span className="text-[12px] text-gray-400">Auto-saved</span>
        {!isLast ? (
          <button
            onClick={() => setCurrentQuestion((c) => Math.min(questions.length - 1, c + 1))}
            className="px-5 py-2 bg-[#0B3D6B] text-white rounded-[7px] text-sm font-medium
                       hover:bg-[#0B3D6B]/90 transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={finishSection}
            disabled={submitting}
            className="px-5 py-2 bg-[#E8A020] text-white rounded-[7px] text-sm font-medium
                       hover:bg-[#E8A020]/90 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Submit section →'}
          </button>
        )}
      </div>
    </div>
  )
}
