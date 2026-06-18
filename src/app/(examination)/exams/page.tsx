'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useExamPortal } from '@/components/exam/ExamContext'
import Leaderboard from '@/components/exam/Leaderboard'
import {
  fetchExamPapers,
  isStudentVisiblePaper,
  parseAttempt,
  seedExamPapersIfEmpty,
} from '@/lib/exam/helpers'
import { EXAM_MANAGEMENT_ROLES } from '@/lib/constants/roles'
import { db } from '@/lib/firebase/client'
import type { ExamAttempt, ExamPaper } from '@/types'

export default function ExamsPage() {
  const { user, student } = useExamPortal()
  const router = useRouter()
  const [papers, setPapers] = useState<ExamPaper[]>([])
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')

  const studentKey = user.role === 'student' ? student?.id ?? user.uid : user.uid
  const isAdmin = EXAM_MANAGEMENT_ROLES.includes(user.role)

  async function loadPapers(): Promise<ExamPaper[]> {
    await seedExamPapersIfEmpty()
    return fetchExamPapers()
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await loadPapers()
        if (cancelled) return
        setPapers(list.filter(isStudentVisiblePaper))

        const snap = await getDocs(
          query(collection(db, 'examAttempts'), where('studentId', '==', studentKey)),
        ).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] }))
        if (cancelled) return
        setAttempts(
          snap.docs.map((d) => parseAttempt(d.id, d.data() as Record<string, unknown>)),
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
    const map: Record<string, { score: number; grade: string }> = {}
    attempts
      .filter((a) => a.status === 'completed' && a.totalScore != null)
      .forEach((a) => {
        const prev = map[a.paperId]?.score ?? 0
        if ((a.totalScore ?? 0) > prev) {
          map[a.paperId] = { score: a.totalScore ?? 0, grade: a.grade ?? '' }
        }
      })
    return map
  }, [attempts])

  async function handleSeedPapers() {
    setSeeding(true)
    setSeedMessage('')
    try {
      const res = await fetch('/api/exam/seed-papers')
      const data = (await res.json()) as { message?: string; error?: string }
      setSeedMessage(data.message ?? data.error ?? 'Seed request completed')
      const list = await loadPapers()
      setPapers(list.filter(isStudentVisiblePaper))
    } catch {
      setSeedMessage('Failed to seed exam papers')
    } finally {
      setSeeding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  const totalTime = (p: ExamPaper) =>
    p.readingMinutes + p.listeningMinutes + p.writingMinutes + p.speakingMinutes

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#0B3D6B] mb-1">Japanese Examinations</h1>
        <p className="text-sm text-gray-400 font-['Noto_Sans_JP']">日本語試験 · Irodori Series</p>
      </div>

      {papers.length > 0 && (
        <div className="text-[10px] uppercase tracking-[0.08em] text-gray-400 font-semibold
                        bg-gray-50 px-4 py-2 border-y border-gray-100 mb-0">
          Book 1 · Starter A1 · Lessons 1–18
        </div>
      )}

      <div className="bg-white rounded-b-xl border-x border-b border-gray-100 overflow-hidden mb-8">
        {papers.length === 0 ? (
          <div className="text-center py-16 text-gray-400 px-6">
            <div className="text-4xl mb-3 font-['Noto_Sans_JP']">試験</div>
            <div className="text-sm text-[#0D1B2A]">No exam papers available yet.</div>
            <div className="text-xs mt-2 text-gray-500">
              Irodori papers J-001 to J-006 will appear here once published.
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => void handleSeedPapers()}
                disabled={seeding}
                className="mt-6 rounded-lg bg-[#E8A020] px-5 py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
              >
                {seeding ? 'Seeding…' : 'Seed Exam Papers'}
              </button>
            )}
            {seedMessage && (
              <p className="mt-3 text-xs text-emerald-600">{seedMessage}</p>
            )}
          </div>
        ) : (
          papers.map((paper) => {
            const best = bestByPaper[paper.id]
            const hasCompleted = best != null
            return (
              <div
                key={paper.id}
                className="flex items-center gap-4 px-5 py-4 border-b border-gray-100
                           hover:bg-gray-50/60 transition-colors cursor-pointer"
                onClick={() => !hasCompleted && router.push(`/exams/${paper.id}`)}
              >
                <div className="w-10 h-10 rounded-[10px] bg-[#0B3D6B]/[0.07] flex flex-col
                                items-center justify-center text-[#0B3D6B] text-[10px] font-semibold
                                font-['Noto_Sans_JP'] leading-tight flex-shrink-0">
                  <span>J</span>
                  <span>{paper.code.slice(-2)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-gray-800 truncate">{paper.title}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{paper.description}</div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#0B3D6B]/[0.07]
                                     text-[#0B3D6B] font-medium">{paper.level}</span>
                    {paper.status === 'active' && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700 font-medium">
                        Available
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                      {totalTime(paper)} min total
                    </span>
                  </div>
                </div>

                {hasCompleted ? (
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-green-600">✓ {best.score}%</div>
                    <div className="text-[11px] text-gray-400">
                      {best.grade ? `Grade ${best.grade}` : 'Completed'}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/exams/${paper.id}`)
                      }}
                      className="mt-1 text-[10px] text-[#0B3D6B] hover:underline"
                    >
                      Retake →
                    </button>
                  </div>
                ) : paper.status === 'active' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/exams/${paper.id}`)
                    }}
                    className="flex-shrink-0 px-4 py-2 bg-[#0B3D6B] text-white text-xs
                               font-medium rounded-[7px] hover:bg-[#0B3D6B]/90 transition-colors
                               whitespace-nowrap"
                  >
                    始める Start →
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-shrink-0 px-4 py-2 bg-gray-100 text-gray-400
                               text-xs rounded-[7px] cursor-not-allowed"
                  >
                    Locked
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {papers.length > 0 && (
        <Leaderboard
          paperId={papers[0].id}
          currentStudentId={user.role === 'student' ? studentKey : undefined}
          title={`Leaderboard — ${papers[0].code}`}
        />
      )}
    </div>
  )
}
