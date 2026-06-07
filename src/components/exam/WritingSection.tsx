'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { doc, setDoc } from 'firebase/firestore'
import ExamTopbar from '@/components/exam/ExamTopbar'
import { countWords, getAttempt } from '@/lib/exam/helpers'
import { db } from '@/lib/firebase/client'
import type { WritingTask } from '@/types'

interface WritingSectionProps {
  paperId: string
  attemptId: string
  tasks: WritingTask[]
  level: string
  timeLimitMinutes: number
  paperCode?: string
}

export default function WritingSection({
  paperId,
  attemptId,
  tasks,
  level,
  timeLimitMinutes,
  paperCode = '',
}: WritingSectionProps) {
  const router = useRouter()
  const sorted = [...tasks].sort((a, b) => a.taskNumber - b.taskNumber)
  const task1 = sorted.find((t) => t.taskNumber === 1) ?? sorted[0]
  const task2 = sorted.find((t) => t.taskNumber === 2) ?? sorted[1]

  const [phase, setPhase] = useState<1 | 2>(1)
  const [task1Text, setTask1Text] = useState('')
  const [task2Text, setTask2Text] = useState('')
  const [startedAt, setStartedAt] = useState<Date>(new Date())
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const activeTask = phase === 1 ? task1 : task2
  const activeText = phase === 1 ? task1Text : task2Text
  const setActiveText = phase === 1 ? setTask1Text : setTask2Text
  const charCount = activeText.length

  useEffect(() => {
    getAttempt(attemptId).then((a) => {
      if (a?.startedAt) setStartedAt(new Date(a.startedAt))
    })
  }, [attemptId])

  const saveSubmission = async (task: WritingTask, response: string) => {
    await setDoc(doc(db, 'examAttempts', attemptId, 'writingSubmissions', task.id), {
      taskNumber: task.taskNumber,
      response,
      wordCount: countWords(response),
      score: null,
      feedback: '',
      markingStatus: 'pending',
    })
  }

  const submitAll = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (task1) await saveSubmission(task1, task1Text)
      if (task2) await saveSubmission(task2, task2Text)

      fetch('/api/exam/mark-writing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          task1Id: task1?.id,
          task2Id: task2?.id,
          task1Response: task1Text,
          task1Prompt: task1?.prompt ?? '',
          task2Response: task2Text,
          task2Prompt: task2?.prompt ?? '',
          level,
        }),
      }).catch(console.error)

      router.push(`/exams/${paperId}/speaking?attemptId=${attemptId}`)
    } finally {
      setSubmitting(false)
    }
  }, [
    attemptId, level, paperId, router, submitting,
    task1, task1Text, task2, task2Text,
  ])

  const handleNext = async () => {
    if (task1) await saveSubmission(task1, task1Text)
    setPhase(2)
  }

  // Timer
  const finishRef = useRef(submitAll)
  useEffect(() => { finishRef.current = submitAll })

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

  if (!activeTask) {
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

  const minChars = (activeTask.minWords ?? 0) * 3
  const charClass =
    charCount < minChars && minChars > 0
      ? 'text-red-500'
      : charCount > 500
        ? 'text-amber-600'
        : 'text-green-600'

  return (
    <div className="flex flex-col min-h-screen">
      <ExamTopbar
        paperCode={paperCode}
        section="writing"
        timeLeft={timeLeft ?? undefined}
      />

      <div className="max-w-2xl mx-auto px-5 py-6 w-full">
        <div className="mb-5">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[11px] font-semibold text-[#0B3D6B] bg-[#0B3D6B]/[0.07] px-2 py-0.5 rounded">
              Task {phase}
            </span>
            <span className="text-[11px] text-gray-400">
              {phase === 1 ? 'Short response' : 'Extended response'}
            </span>
          </div>

          {/* Instruction box */}
          <div className="bg-[#E8A020]/[0.06] border border-[#E8A020]/20 rounded-lg px-4 py-3 mb-4">
            <p className="text-[13px] text-gray-700 leading-relaxed">{activeTask.prompt}</p>
            {activeTask.minWords > 0 && (
              <p className="text-[11px] text-gray-400 mt-2">
                📝 Write at least {activeTask.minWords} words in Japanese
              </p>
            )}
          </div>

          {/* Textarea */}
          <textarea
            value={activeText}
            onChange={(e) => setActiveText(e.target.value)}
            spellCheck={false}
            placeholder="ここに日本語で書いてください..."
            className="w-full min-h-[200px] border border-gray-200 rounded-[8px]
                       px-4 py-3 text-[14px] font-['Noto_Sans_JP'] leading-[2.2] resize-none
                       focus:outline-none focus:border-[#1A6BAD] focus:ring-1
                       focus:ring-[#1A6BAD]/20 bg-white placeholder-gray-300 transition-colors"
          />

          {/* Character / word count */}
          <div className="flex justify-between text-[11px] mt-1.5">
            <span className="text-gray-400">Words: {countWords(activeText)}</span>
            <span className={charClass}>{charCount} characters</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {phase === 1 && task2 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 bg-[#0B3D6B] text-white rounded-[7px] text-sm font-medium
                         hover:bg-[#0B3D6B]/90 transition-colors"
            >
              Next → Task 2
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={submitAll}
              className="px-5 py-2 bg-[#E8A020] text-white rounded-[7px] text-sm font-medium
                         hover:bg-[#E8A020]/90 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit → Speaking'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
