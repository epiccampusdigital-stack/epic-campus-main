'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

interface ExamAttempt {
  id: string
  studentId: string
  studentName: string
  studentCode?: string
  paperId: string
  paperTitle: string
  score: number
  totalQuestions: number
  percentage: number
  timeTaken?: number
  completedAt: unknown
  status: string
}

interface ExamPaper {
  id: string
  title: string
  categoryId?: string
  passMark?: number
}

function formatDate(val: unknown): string {
  if (!val) return '—'
  try {
    if (typeof val === 'object' && val !== null && 'toDate' in val) {
      return (val as { toDate: () => Date }).toDate().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    }
    return new Date(String(val)).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  } catch { return '—' }
}

function formatTime(seconds?: number): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default function ExamResultsPage() {
  const { user } = useManagement()
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [papers, setPapers] = useState<ExamPaper[]>([])
  const [loading, setLoading] = useState(true)
  const [paperFilter, setPaperFilter] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [attSnap, paperSnap] = await Promise.all([
        getDocs(query(collection(db, 'examAttempts'), orderBy('completedAt', 'desc'))).catch(() =>
          getDocs(collection(db, 'examAttempts'))
        ),
        getDocs(collection(db, 'examPapers')),
      ])
      setAttempts(attSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt)))
      setPapers(paperSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamPaper)))
    } catch (err) {
      console.error('[ExamResults]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = attempts.filter(a => {
    if (paperFilter && a.paperId !== paperFilter) return false
    if (search && !a.studentName.toLowerCase().includes(search.toLowerCase()) &&
        !a.studentCode?.toLowerCase().includes(search.toLowerCase())) return false
    const paper = papers.find(p => p.id === a.paperId)
    const passMark = paper?.passMark ?? 80
    if (statusFilter === 'passed' && a.percentage < passMark) return false
    if (statusFilter === 'failed' && a.percentage >= passMark) return false
    return true
  })

  const totalAttempts = filtered.length
  const passed = filtered.filter(a => {
    const paper = papers.find(p => p.id === a.paperId)
    return a.percentage >= (paper?.passMark ?? 80)
  }).length
  const avgScore = totalAttempts > 0
    ? Math.round(filtered.reduce((s, a) => s + a.percentage, 0) / totalAttempts)
    : 0

  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Exam Results</h1>
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">All student exam attempts and scores</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 hover:border-[#0B3D6B]"
        >
          <span className="ti ti-refresh" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4 text-center">
          <p className="font-jakarta text-2xl font-black text-[#0B3D6B] dark:text-white">{totalAttempts}</p>
          <p className="text-xs text-[#5A6A7A] dark:text-white/50">Total Attempts</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-center">
          <p className="font-jakarta text-2xl font-black text-emerald-700 dark:text-emerald-400">{passed}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Passed</p>
        </div>
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4 text-center">
          <p className="font-jakarta text-2xl font-black text-[#E8A020]">{avgScore}%</p>
          <p className="text-xs text-[#5A6A7A] dark:text-white/50">Avg Score</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search student name or code..."
          className="flex-1 min-w-48 rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-4 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
        />
        <select
          value={paperFilter}
          onChange={e => setPaperFilter(e.target.value)}
          className="rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none"
        >
          <option value="">All Papers</option>
          {papers.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <div className="flex gap-2">
          {(['all', 'passed', 'failed'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl px-3 py-2 text-xs font-bold capitalize transition-all ${
                statusFilter === s
                  ? 'bg-[#E8A020] text-white'
                  : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-file-off text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">No exam results found</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Paper</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Score</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Result</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(attempt => {
                  const paper = papers.find(p => p.id === attempt.paperId)
                  const passMark = paper?.passMark ?? 80
                  const passed = attempt.percentage >= passMark
                  return (
                    <tr key={attempt.id} className="border-b border-[#DDE3EC]/50 dark:border-white/[0.04] last:border-0 hover:bg-[#F5F7FB]/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0D1B2A] dark:text-white">{attempt.studentName}</p>
                        {attempt.studentCode && (
                          <p className="text-xs font-mono text-[#5A6A7A] dark:text-white/40">{attempt.studentCode}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#0D1B2A] dark:text-white">{attempt.paperTitle}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                          passed
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {attempt.percentage}%
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                          passed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                        }`}>
                          {passed ? '✓ Passed' : '✗ Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-[#5A6A7A] dark:text-white/40">
                        {formatTime(attempt.timeTaken)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5A6A7A] dark:text-white/40">
                        {formatDate(attempt.completedAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
