'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExamTopbar from '@/components/exam/ExamTopbar'
import { getAttempt, loadAnswers, markSection, saveAnswer } from '@/lib/exam/helpers'
import type { ListeningQuestion } from '@/types'

interface ListeningSectionProps {
  paperId: string
  attemptId: string
  questions: ListeningQuestion[]
  timeLimitMinutes: number
  paperCode?: string
}

export default function ListeningSection({
  paperId,
  attemptId,
  questions,
  timeLimitMinutes,
  paperCode = '',
}: ListeningSectionProps) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [startedAt, setStartedAt] = useState<Date>(new Date())
  const [currentQ, setCurrentQ] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const active = questions[currentQ]

  const questionKey = useMemo(() => {
    const key: Record<string, string> = {}
    questions.forEach((q) => { key[q.id] = q.correctAnswer })
    return key
  }, [questions])

  const pauseAudioRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    getAttempt(attemptId).then((a) => {
      if (a?.startedAt) setStartedAt(new Date(a.startedAt))
    })
    loadAnswers(attemptId, 'listening').then(setAnswers)
  }, [attemptId])

  const goToQuestion = (index: number) => {
    setCurrentQ(index)
  }

  const answeredIndices = useMemo(() => {
    const set = new Set<number>()
    questions.forEach((q, i) => { if (answers[q.id]) set.add(i) })
    return set
  }, [answers, questions])

  const handleAnswer = (questionId: string, letter: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: letter }))
    const q = questions.find((x) => x.id === questionId)
    saveAnswer(attemptId, questionId, letter, 'listening', q?.correctAnswer).catch(console.error)
  }

  const finishSection = useCallback(async () => {
    if (submitting) return
    pauseAudioRef.current?.()
    setSubmitting(true)
    try {
      for (const q of questions) {
        const val = answers[q.id]
        if (val) await saveAnswer(attemptId, q.id, val, 'listening', q.correctAnswer)
      }
      await markSection(attemptId, 'listening', questionKey)
      router.push(`/exams/${paperId}/writing?attemptId=${attemptId}`)
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

  if (questions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">No listening questions available.</div>
    )
  }

  const isLast = currentQ === questions.length - 1

  return (
    <div className="flex flex-col h-screen">
      <ExamTopbar
        paperCode={paperCode}
        section="listening"
        timeLeft={timeLeft ?? undefined}
        currentQ={currentQ + 1}
        totalQ={questions.length}
      />

      {/* 2-column body */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 52px - 56px)' }}>

        {/* Main question column */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Question header */}
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-[11px] font-semibold text-[#0B3D6B] bg-[#0B3D6B]/[0.07] px-2 py-0.5 rounded">
              Q{currentQ + 1}
            </span>
            <span className="text-[11px] text-gray-400">Multiple choice</span>
          </div>

          {/* Audio player */}
          {active?.audioUrl ? (
            <audio
              controls
              src={active.audioUrl}
              className="w-full mb-3"
              preload="metadata"
            />
          ) : (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <span className="text-amber-600 text-sm">🎧 Audio for this question will be available soon.</span>
            </div>
          )}

          {active?.audioUrl && (
            <audio
              controls
              src={active.audioUrl}
              className="w-full mb-3"
              preload="metadata"
            />
          )}

          {/* Listening play limit warning */}
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
            <div className="text-[11px] text-amber-700 leading-relaxed">
              <span className="font-semibold">⚠️ Play limit:</span> Each audio can be played max 2 times.
            </div>
          </div>

          {/* Question text */}
          {active && (
            <>
              <p className="text-[14px] font-medium text-gray-800 mb-4">
                {active.questionText}
              </p>

              {/* Options */}
              {active.options.map((opt, i) => {
                const letter = ['A', 'B', 'C', 'D'][i]
                const isSelected = answers[active.id] === letter
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(active.id, letter)}
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
            </>
          )}
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
                onClick={() => goToQuestion(i)}
                className={`w-[30px] h-[30px] rounded-[6px] text-[11px] font-medium border transition-colors
                            ${i === currentQ
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
          onClick={() => goToQuestion(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="px-4 py-2 border border-gray-200 rounded-[7px] text-sm text-gray-500
                     hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>
        <span className="text-[12px] text-gray-400">Auto-saved</span>
        {!isLast ? (
          <button
            onClick={() => goToQuestion(Math.min(questions.length - 1, currentQ + 1))}
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
