'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import ReadingSection from '@/components/exam/ReadingSection'
import { fetchExamPapers, fetchReadingQuestions } from '@/lib/exam/helpers'
import type { ExamPaper, ReadingQuestion } from '@/types'

export default function ReadingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const paperId = String(params.paperId ?? '')
  const attemptId = searchParams.get('attemptId')
  const [paper, setPaper] = useState<ExamPaper | null>(null)
  const [questions, setQuestions] = useState<ReadingQuestion[]>([])

  useEffect(() => {
    if (!attemptId) {
      router.replace(`/exams/${paperId}`)
      return
    }
    fetchExamPapers().then((papers) => setPaper(papers.find((p) => p.id === paperId) ?? null))
    fetchReadingQuestions(paperId).then(setQuestions)
  }, [attemptId, paperId, router])

  if (!attemptId || !paper) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0B3D6B] border-t-transparent" />
      </div>
    )
  }

  return (
    <ReadingSection
      paperId={paperId}
      attemptId={attemptId}
      questions={questions}
      timeLimitMinutes={paper.readingMinutes}
    />
  )
}
