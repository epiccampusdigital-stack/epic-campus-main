'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useExamPortal } from '@/components/exam/ExamContext'
import { fetchExamPapers, getLevelBadgeColor } from '@/lib/exam/helpers'
import { db } from '@/lib/firebase/client'
import type { ExamPaper } from '@/types'

const SECTIONS = [
  { name: 'Reading', detail: '40 questions · 60 min', icon: '📖' },
  { name: 'Listening', detail: '40 questions · 30 min', icon: '🎧' },
  { name: 'Writing', detail: '2 tasks · 45 min', icon: '✏️' },
  { name: 'Speaking', detail: '3 prompts · 15 min', icon: '🎤' },
]

export default function ExamGreetingPage() {
  const params = useParams()
  const router = useRouter()
  const { user, student } = useExamPortal()
  const paperId = String(params.paperId ?? '')
  const [paper, setPaper] = useState<ExamPaper | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    fetchExamPapers().then((papers) => {
      setPaper(papers.find((p) => p.id === paperId) ?? null)
    })
  }, [paperId])

  const handleStart = async () => {
    if (!paper || starting) return
    setStarting(true)
    try {
      const ref = await addDoc(collection(db, 'examAttempts'), {
        studentId: student?.id ?? user.uid,
        studentName: student?.name ?? user.displayName,
        paperId: paper.id,
        paperCode: paper.code,
        startedAt: serverTimestamp(),
        status: 'in_progress',
        markingStatus: 'pending',
        createdAt: serverTimestamp(),
      })
      router.push(`/exams/${paperId}/reading?attemptId=${ref.id}`)
    } catch {
      setStarting(false)
    }
  }

  if (!paper) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-[#5A6A7A]">Paper not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/exams"
        className="mb-6 inline-flex text-sm font-medium text-[#0B3D6B] hover:underline"
      >
        ← Back to exams
      </Link>

      <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${getLevelBadgeColor(paper.level)}`}
          >
            {paper.level}
          </span>
          <span className="font-mono text-sm text-[#5A6A7A]">{paper.code}</span>
        </div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
          {paper.title}
        </h1>
        <p className="mt-3 font-inter text-[#5A6A7A]">{paper.description}</p>

        <div className="mt-6 rounded-lg bg-[#F5F7FB] p-4">
          <h2 className="font-jakarta font-semibold text-[#0D1B2A]">Instructions</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 font-inter text-sm text-[#5A6A7A]">
            <li>Complete all four sections in order without leaving the exam.</li>
            <li>Your answers autosave every 30 seconds.</li>
            <li>Listening audio cannot be rewound during the live exam.</li>
            <li>Writing is marked by AI; speaking is reviewed by a teacher.</li>
            <li>Ensure a quiet environment and working microphone for speaking.</li>
          </ul>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-3 rounded-lg border border-[#DDE3EC] p-4"
            >
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="font-jakarta font-semibold text-[#0D1B2A]">{s.name}</p>
                <p className="text-xs text-[#5A6A7A]">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={starting}
          onClick={handleStart}
          className="mt-8 w-full rounded-lg bg-[#E8A020] py-3 font-jakarta text-base font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-60"
        >
          {starting ? 'Starting…' : 'START EXAM'}
        </button>
      </div>
    </div>
  )
}
