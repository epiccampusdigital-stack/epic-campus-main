'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import WritingSection from '@/components/exam/WritingSection'
import { fetchExamPapers, fetchWritingTasks } from '@/lib/exam/helpers'
import type { ExamPaper, WritingTask } from '@/types'

export default function WritingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const paperId = String(params.paperId ?? '')
  const attemptId = searchParams.get('attemptId')
  const [paper, setPaper] = useState<ExamPaper | null>(null)
  const [tasks, setTasks] = useState<WritingTask[]>([])

  useEffect(() => {
    if (!attemptId) {
      router.replace(`/exams/${paperId}`)
      return
    }
    fetchExamPapers().then((papers) => setPaper(papers.find((p) => p.id === paperId) ?? null))
    fetchWritingTasks(paperId).then(setTasks)
  }, [attemptId, paperId, router])

  if (!attemptId || !paper) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0B3D6B] border-t-transparent" />
      </div>
    )
  }

  return (
    <WritingSection
      paperId={paperId}
      attemptId={attemptId}
      tasks={tasks}
      level={paper.level}
      timeLimitMinutes={paper.writingMinutes}
      paperCode={paper.code}
    />
  )
}
