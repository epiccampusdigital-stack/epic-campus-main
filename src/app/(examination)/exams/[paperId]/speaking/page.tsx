'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import SpeakingSection from '@/components/exam/SpeakingSection'
import { fetchExamPapers, fetchSpeakingPrompts } from '@/lib/exam/helpers'
import type { ExamPaper, SpeakingPrompt } from '@/types'

export default function SpeakingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const paperId = String(params.paperId ?? '')
  const attemptId = searchParams.get('attemptId')
  const [paper, setPaper] = useState<ExamPaper | null>(null)
  const [prompts, setPrompts] = useState<SpeakingPrompt[]>([])

  useEffect(() => {
    if (!attemptId) {
      router.replace(`/exams/${paperId}`)
      return
    }
    fetchExamPapers().then((papers) => setPaper(papers.find((p) => p.id === paperId) ?? null))
    fetchSpeakingPrompts(paperId).then(setPrompts)
  }, [attemptId, paperId, router])

  if (!attemptId || !paper) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0B3D6B] border-t-transparent" />
      </div>
    )
  }

  return (
    <SpeakingSection
      paperId={paperId}
      attemptId={attemptId}
      prompts={prompts}
      timeLimitMinutes={paper.speakingMinutes}
      paperCode={paper.code}
    />
  )
}
