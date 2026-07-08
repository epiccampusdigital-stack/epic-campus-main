'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseAttempt } from '@/lib/exam/helpers'
import { parsePayment } from '@/lib/payments/helpers'
import { parseStudent } from '@/lib/students/helpers'
import { formatLKR } from '@/lib/utils/formatCurrency'
import {
  computeTeacherStatCounts,
  TEACHER_STAT_LABELS,
  type TeacherStatFilter,
} from '@/lib/dashboard/teacherStats'
import TeacherSessionsWidget from '@/components/sessions/TeacherSessionsWidget'
import TeacherRiskWatchWidget from '@/components/risk/TeacherRiskWatchWidget'
import { useManagement } from '@/components/layout/ManagementContext'
import type { ExamAttempt, Student } from '@/types'

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#DDE3EC] bg-white p-6 dark:border-white/[0.08] dark:bg-white/[0.04]">
      <div className="mb-3 h-3 w-24 rounded bg-[#DDE3EC] dark:bg-white/10" />
      <div className="h-8 w-16 rounded bg-[#DDE3EC] dark:bg-white/10" />
    </div>
  )
}

const STAT_KEYS: TeacherStatFilter[] = ['active', 'passed', 'failed', 'dropped', 'repeats']

interface FinanceSummary {
  monthIncome: number
  todayCollection: number
  pendingPayments: number
}

export default function TeacherDashboard({ showFinances = false }: { showFinances?: boolean }) {
  const { user } = useManagement()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([])
  const [finance, setFinance] = useState<FinanceSummary | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsSnap, attemptsSnap] = await Promise.all([
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'examAttempts')).catch(() => ({ docs: [] })),
      ])
      setStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setExamAttempts(
        attemptsSnap.docs.map((d) =>
          parseAttempt(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } catch (err) {
      console.error('[TeacherDashboard]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Finance summary only loads when the account has finance access enabled.
  useEffect(() => {
    if (!showFinances) {
      setFinance(null)
      return
    }
    let cancelled = false
    async function loadFinance() {
      try {
        const snap = await getDocs(collection(db, 'payments'))
        const monthKey = new Date().toISOString().slice(0, 7)
        const today = new Date().toISOString().slice(0, 10)
        let monthIncome = 0
        let todayCollection = 0
        let pendingPayments = 0
        snap.docs.forEach((d) => {
          const p = parsePayment(d.id, d.data() as Record<string, unknown>)
          if (p.status === 'pending' || p.status === 'partial') pendingPayments++
          if (p.status === 'paid' || p.status === 'partial') {
            const lkr = p.currency === 'USD' ? p.amount * 320 : p.amount
            if (p.paymentDate.slice(0, 7) === monthKey) {
              monthIncome += lkr
              if (p.paymentDate.slice(0, 10) === today) todayCollection += lkr
            }
          }
        })
        if (!cancelled) setFinance({ monthIncome, todayCollection, pendingPayments })
      } catch (err) {
        console.error('[TeacherDashboard] finance', err)
        if (!cancelled) setFinance(null)
      }
    }
    void loadFinance()
    return () => {
      cancelled = true
    }
  }, [showFinances])

  const counts = useMemo(
    () => computeTeacherStatCounts(students, [], examAttempts),
    [students, examAttempts],
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          Teacher Dashboard
        </h2>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/50">
          {showFinances
            ? 'Student progress, one-on-one sessions, and finance summary.'
            : 'Student progress and one-on-one sessions — no financial data shown here.'}
        </p>
      </div>

      {showFinances && finance && (
        <section>
          <p className="mb-3 font-inter text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30">
            Finance Summary
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="stat-card-glass p-6">
              <p className="font-inter text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/50">
                Month Income
              </p>
              <p className="font-jakarta mt-2 text-2xl font-black text-[#059669]">
                {formatLKR(finance.monthIncome)}
              </p>
            </div>
            <div className="stat-card-glass p-6">
              <p className="font-inter text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/50">
                Today&apos;s Collection
              </p>
              <p className="font-jakarta mt-2 text-2xl font-black text-[#0B3D6B] dark:text-[#E8A020]">
                {formatLKR(finance.todayCollection)}
              </p>
            </div>
            <div className="stat-card-glass p-6">
              <p className="font-inter text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/50">
                Pending Payments
              </p>
              <p className="font-jakarta mt-2 text-2xl font-black text-[#d97706]">
                {finance.pendingPayments}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading
          ? STAT_KEYS.map((k) => <StatSkeleton key={k} />)
          : STAT_KEYS.map((key) => (
              <Link
                key={key}
                href={`/students?teacherStat=${key}`}
                className="stat-card-glass card-hover p-6"
              >
                <p className="font-inter text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/50">
                  {TEACHER_STAT_LABELS[key]}
                </p>
                <p className="font-jakarta mt-2 text-[28px] font-black leading-tight text-[#0B3D6B] dark:text-[#E8A020]">
                  {counts[key]}
                </p>
                <p className="mt-1 font-inter text-xs font-medium text-[#0B3D6B] dark:text-white/40">View students →</p>
              </Link>
            ))}
      </section>

      {user && <TeacherSessionsWidget teacherId={user.uid} teacherName={user.displayName || user.email} />}

      {user && <TeacherRiskWatchWidget teacherId={user.uid} />}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/sessions"
          className="group card-hover rounded-2xl border border-[#DDE3EC] bg-white p-6 hover:border-[#E8A020] dark:border-white/[0.08] dark:bg-white/[0.04]"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#0B3D6B] text-white">
            <span className="ti ti-calendar-event text-lg" aria-hidden="true" />
          </div>
          <p className="font-jakarta font-semibold text-[#0D1B2A] dark:text-white">Sessions</p>
          <p className="mt-1 font-inter text-xs text-[#5A6A7A] dark:text-white/50">
            Schedule and manage one-on-one student discussions
          </p>
        </Link>
        <Link
          href="/students"
          className="group card-hover rounded-2xl border border-[#DDE3EC] bg-white p-6 hover:border-[#E8A020] dark:border-white/[0.08] dark:bg-white/[0.04]"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#0B3D6B] text-white">
            <span className="ti ti-users text-lg" aria-hidden="true" />
          </div>
          <p className="font-jakarta font-semibold text-[#0D1B2A] dark:text-white">Students</p>
          <p className="mt-1 font-inter text-xs text-[#5A6A7A] dark:text-white/50">
            View and search all student records
          </p>
        </Link>
      </section>
    </div>
  )
}
