'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { doc, setDoc } from 'firebase/firestore'
import ExamTimer from '@/components/exam/ExamTimer'
import { countWords, getAttempt } from '@/lib/exam/helpers'
import { db } from '@/lib/firebase/client'
import type { WritingTask } from '@/types'

interface WritingSectionProps {
  paperId: string
  attemptId: string
  tasks: WritingTask[]
  level: string
  timeLimitMinutes: number
}

export default function WritingSection({
  paperId,
  attemptId,
  tasks,
  level,
  timeLimitMinutes,
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

  const activeTask = phase === 1 ? task1 : task2
  const activeText = phase === 1 ? task1Text : task2Text
  const setActiveText = phase === 1 ? setTask1Text : setTask2Text

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
    attemptId,
    level,
    paperId,
    router,
    submitting,
    task1,
    task1Text,
    task2,
    task2Text,
  ])

  const handleNext = async () => {
    if (task1) await saveSubmission(task1, task1Text)
    setPhase(2)
  }

  if (!activeTask) {
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
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-jakarta text-xl font-bold text-[#0B3D6B]">
          Writing — Task {phase}
        </h1>
        <ExamTimer
          startedAt={startedAt}
          timeLimitMinutes={timeLimitMinutes}
          onExpire={phase === 2 ? submitAll : handleNext}
        />
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
        <p className="mb-4 font-inter text-[#0D1B2A]">{activeTask.prompt}</p>
        <textarea
          value={activeText}
          onChange={(e) => setActiveText(e.target.value)}
          spellCheck={false}
          className="min-h-[280px] w-full resize-y rounded-lg border border-[#DDE3EC] p-4 font-inter text-[#0D1B2A] focus:border-[#0B3D6B] focus:outline-none focus:ring-1 focus:ring-[#0B3D6B]"
          placeholder="Type your response here…"
        />
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#5A6A7A]">
          <span>
            Characters:{' '}
            <span className="font-semibold text-[#0B3D6B]">{activeText.length}</span>
            {activeTask.minWords ? (
              <span> / minimum {activeTask.minWords}</span>
            ) : null}
          </span>
          <span>
            Words:{' '}
            <span className="font-semibold text-[#0B3D6B]">{countWords(activeText)}</span>
          </span>
        </div>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        {phase === 1 && task2 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-[#0B3D6B] px-6 py-2 font-jakarta text-sm font-bold text-white"
          >
            Next → Task 2
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={submitAll}
            className="rounded-lg bg-[#E8A020] px-6 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit → Speaking'}
          </button>
        )}
      </div>
    </div>
  )
}
