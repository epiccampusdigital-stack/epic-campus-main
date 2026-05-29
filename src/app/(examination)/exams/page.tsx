'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useExamPortal } from '@/components/exam/ExamContext'
import {
  fetchExamPapers,
  getLevelBadgeColor,
  seedExamPapersIfEmpty,
} from '@/lib/exam/helpers'
import { db } from '@/lib/firebase/client'
import { parseAttempt } from '@/lib/exam/helpers'
import type { ExamAttempt, ExamPaper } from '@/types'

export default function ExamsPage() {
  const { user, student } = useExamPortal()
  const [papers, setPapers] = useState<ExamPaper[]>([])
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [loading, setLoading] = useState(true)

  const studentKey = user.role === 'student' ? student?.id ?? user.uid : user.uid

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await seedExamPapersIfEmpty()
        const list = await fetchExamPapers()
        if (cancelled) return
        setPapers(list.filter((p) => p.status === 'active'))

        const snap = await getDocs(
          query(collection(db, 'examAttempts'), where('studentId', '==', studentKey)),
        )
        if (cancelled) return
        setAttempts(
          snap.docs.map((d) =>
            parseAttempt(d.id, d.data() as Record<string, unknown>),
          ),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentKey])

  const bestByPaper = useMemo(() => {
    const map: Record<string, number> = {}
    attempts
      .filter((a) => a.status === 'completed' && a.totalScore != null)
      .forEach((a) => {
        const prev = map[a.paperId] ?? 0
        if ((a.totalScore ?? 0) > prev) map[a.paperId] = a.totalScore ?? 0
      })
    return map
  }, [attempts])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
          Japanese Language Exams
        </h1>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
          Irodori & JLPT practice papers — Reading, Listening, Writing & Speaking
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {papers.map((paper) => {
          const best = bestByPaper[paper.id]
          return (
            <article
              key={paper.id}
              className="flex flex-col rounded-xl border border-[#DDE3EC] bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getLevelBadgeColor(paper.level)}`}
                >
                  {paper.level}
                </span>
                <span className="font-mono text-xs text-[#5A6A7A]">{paper.code}</span>
              </div>
              <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A]">
                {paper.title}
              </h2>
              <p className="mt-2 flex-1 font-inter text-sm text-[#5A6A7A]">
                {paper.description}
              </p>
              <p className="mt-3 text-xs text-[#5A6A7A]">
                ⏱ Reading {paper.readingMinutes}m · Listening {paper.listeningMinutes}m
                · Writing {paper.writingMinutes}m · Speaking {paper.speakingMinutes}m
              </p>
              {best != null && (
                <p className="mt-2 text-sm font-semibold text-[#E8A020]">
                  Best score: {best}%
                </p>
              )}
              <Link
                href={`/exams/${paper.id}`}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#0B3D6B] px-4 py-2.5 font-jakarta text-sm font-bold text-white hover:bg-[#0a3560]"
              >
                {best != null ? 'Retake Exam' : 'Start Exam'}
              </Link>
            </article>
          )
        })}
      </div>
    </div>
  )
}
