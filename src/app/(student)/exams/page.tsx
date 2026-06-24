'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'

interface ExamPaperDoc {
  id: string
  title: string
  description?: string
  categoryId?: string
  totalQuestions?: number
  timeLimitSeconds?: number
  passMark?: number
  isPublished?: boolean
  order?: number
}

function ScoreRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#E8A020' : '#ef4444'
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#DDE3EC" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize={size < 48 ? 9 : 11} fontWeight="700" fill={color}>
        {pct}%
      </text>
    </svg>
  )
}

export default function ExamsListPage() {
  const router = useRouter()
  const { user } = useStudentPortal()
  const [papers, setPapers] = useState<ExamPaperDoc[]>([])
  const [attempts, setAttempts] = useState<Record<string, { pct: number; count: number }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const uid = user.uid
    async function load() {
      const snap = await getDocs(
        query(
          collection(db, 'examPapers'),
          where('isPublished', '==', true),
          orderBy('order', 'asc'),
        ),
      )
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamPaperDoc))
      setPapers(list)

      const attSnap = await getDocs(
        query(
          collection(db, 'examAttempts'),
          where('studentId', '==', uid),
          where('status', '==', 'completed'),
        ),
      )
      const map: Record<string, { pct: number; count: number }> = {}
      attSnap.docs.forEach((d) => {
        const data = d.data()
        const pid = data.paperId as string
        const pct = data.percentage as number
        if (!map[pid]) map[pid] = { pct: 0, count: 0 }
        map[pid].count++
        if (pct > map[pid].pct) map[pid].pct = pct
      })
      setAttempts(map)
      setLoading(false)
    }
    void load()
  }, [user])

  const categoryGroups = papers.reduce<Record<string, ExamPaperDoc[]>>((acc, p) => {
    const cat = p.categoryId ?? 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  if (!user) return null

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD] p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-jakarta text-2xl font-bold">Practice Exams</h1>
            <p className="mt-1 text-sm text-white/70">
              JFT-Basic &amp; SSW preparation papers
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{Object.keys(attempts).length}</p>
            <p className="text-xs text-white/60">Papers attempted</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">
          <span className="ti ti-award text-[#E8A020]" />
          Exam content powered by{' '}
          <span className="font-bold text-[#E8A020]">SSW Guide</span>
          <span className="text-white/40">· sswguide.com</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-file-off text-4xl text-[#DDE3EC]" />
          <p className="mt-3 text-sm text-[#5A6A7A]">No exam papers published yet</p>
          <p className="mt-1 text-xs text-[#5A6A7A]/60">Check back soon — your teacher is preparing papers</p>
        </div>
      ) : (
        Object.entries(categoryGroups).map(([cat, catPapers]) => (
          <div key={cat}>
            <h2 className="mb-3 font-jakarta text-sm font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/50">
              {cat.replace(/-/g, ' ')}
            </h2>
            <div className="space-y-3">
              {catPapers.map((paper) => {
                const att = attempts[paper.id]
                const isPassed = att && att.pct >= (paper.passMark ?? 80)
                return (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => router.push(`/exams/${paper.id}`)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4 text-left transition-all hover:border-[#E8A020] hover:shadow-sm"
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${
                      isPassed ? 'bg-emerald-50 dark:bg-emerald-900/20' :
                      att ? 'bg-amber-50 dark:bg-amber-900/20' :
                      'bg-[#F5F7FB] dark:bg-white/[0.06]'
                    }`}>
                      {isPassed ? '🏆' : att ? '📝' : '📄'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">
                        {paper.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5A6A7A] dark:text-white/50">
                        <span className="ti ti-clock mr-0.5" />
                        {Math.round((paper.timeLimitSeconds ?? 3600) / 60)} min
                        <span>·</span>
                        <span className="ti ti-list-numbers mr-0.5" />
                        {paper.totalQuestions ?? 48} questions
                        <span>·</span>
                        Pass: {paper.passMark ?? 80}%
                        {att && (
                          <>
                            <span>·</span>
                            <span>{att.count} attempt{att.count > 1 ? 's' : ''}</span>
                          </>
                        )}
                      </div>
                      {paper.description && (
                        <p className="mt-1 truncate text-xs text-[#5A6A7A] dark:text-white/40">
                          {paper.description}
                        </p>
                      )}
                    </div>
                    {att ? (
                      <ScoreRing pct={Math.round(att.pct)} />
                    ) : (
                      <div className="flex items-center gap-1 rounded-xl bg-[#E8A020] px-3 py-1.5 text-xs font-bold text-[#0B3D6B]">
                        Start
                        <span className="ti ti-chevron-right" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))
      )}

      <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#5A6A7A]/50 dark:text-white/20">
        <span className="ti ti-stars" />
        Powered by SSW Guide · sswguide.com
      </div>
    </div>
  )
}
