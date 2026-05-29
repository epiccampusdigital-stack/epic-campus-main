'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExamTimer from '@/components/exam/ExamTimer'
import QuestionPalette from '@/components/exam/QuestionPalette'
import { getAttempt, loadAnswers, markSection, saveAnswer } from '@/lib/exam/helpers'
import type { ListeningQuestion } from '@/types'

interface ListeningSectionProps {
  paperId: string
  attemptId: string
  questions: ListeningQuestion[]
  timeLimitMinutes: number
}

export default function ListeningSection({
  paperId,
  attemptId,
  questions,
  timeLimitMinutes,
}: ListeningSectionProps) {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastPositionRef = useRef(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [startedAt, setStartedAt] = useState<Date>(new Date())
  const [currentQ, setCurrentQ] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const active = questions[currentQ]
  const hasAudio = active?.audioUrl

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
    loadAnswers(attemptId, 'listening').then(setAnswers)
  }, [attemptId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      lastPositionRef.current = audio.currentTime
    }
    const onSeeking = () => {
      if (audio.currentTime > lastPositionRef.current) {
        audio.currentTime = lastPositionRef.current
      }
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('seeking', onSeeking)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('seeking', onSeeking)
    }
  }, [active?.audioUrl])

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
    saveAnswer(attemptId, questionId, value, 'listening', q?.correctAnswer).catch(console.error)
  }

  const finishSection = useCallback(async () => {
    if (submitting) return
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

  if (questions.length === 0) {
    return (
      <div className="p-8 text-center text-[#5A6A7A]">No listening questions available.</div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-jakarta text-xl font-bold text-[#0B3D6B]">Listening</h1>
        <ExamTimer
          startedAt={startedAt}
          timeLimitMinutes={timeLimitMinutes}
          onExpire={finishSection}
        />
      </div>

      <div className="mb-6 rounded-xl border border-[#DDE3EC] bg-white p-5">
        {hasAudio ? (
          <audio ref={audioRef} controls className="w-full" src={active.audioUrl!}>
            <track kind="captions" />
          </audio>
        ) : (
          <p className="text-center font-inter text-sm text-amber-700">
            Audio not available — practice mode
          </p>
        )}
      </div>

      <div className="mb-4">
        <QuestionPalette
          total={questions.length}
          currentIndex={currentQ}
          answered={answeredIndices}
          onSelect={setCurrentQ}
        />
      </div>

      {active && (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <p className="mb-1 font-inter text-xs text-[#5A6A7A]">
            Question {active.questionNumber}
          </p>
          <p className="mb-4 font-jakarta font-semibold text-[#0D1B2A]">
            {active.questionText}
          </p>
          <div className="space-y-2">
            {active.options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx)
              return (
                <label
                  key={letter}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
                    answers[active.id] === letter
                      ? 'border-[#0B3D6B] bg-[#0B3D6B]/5'
                      : 'border-[#DDE3EC]'
                  }`}
                >
                  <input
                    type="radio"
                    name={active.id}
                    checked={answers[active.id] === letter}
                    onChange={() => handleAnswer(active.id, letter)}
                  />
                  <span className="font-medium text-[#0B3D6B]">{letter}.</span>
                  <span>{opt}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          disabled={currentQ === 0}
          onClick={() => setCurrentQ((q) => q - 1)}
          className="rounded-lg border border-[#DDE3EC] px-4 py-2 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        {currentQ < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentQ((q) => q + 1)}
            className="rounded-lg bg-[#0B3D6B] px-6 py-2 text-sm font-bold text-white"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={finishSection}
            className="rounded-lg bg-[#E8A020] px-6 py-2 font-jakarta text-sm font-bold text-[#0B3D6B]"
          >
            Next Section → Writing
          </button>
        )}
      </div>
    </div>
  )
}
