'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseAttempt } from '@/lib/exam/helpers'
import { parseStudent } from '@/lib/students/helpers'
import {
  computeTeacherStatCounts,
  TEACHER_STAT_LABELS,
  type TeacherStatFilter,
} from '@/lib/dashboard/teacherStats'
import TeacherSessionsWidget from '@/components/sessions/TeacherSessionsWidget'
import TeacherRiskWatchWidget from '@/components/risk/TeacherRiskWatchWidget'
import { useManagement } from '@/components/layout/ManagementContext'
import type { ExamAttempt, ExamResult, Student } from '@/types'

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#DDE3EC] bg-white p-6 dark:border-white/[0.08] dark:bg-white/[0.04]">
      <div className="mb-3 h-3 w-24 rounded bg-[#DDE3EC] dark:bg-white/10" />
      <div className="h-8 w-16 rounded bg-[#DDE3EC] dark:bg-white/10" />
    </div>
  )
}

function parseExamResult(id: string, data: Record<string, unknown>): ExamResult {
  return {
    id,
    examId: String(data.examId ?? ''),
    studentId: String(data.studentId ?? ''),
    score: data.score != null ? Number(data.score) : undefined,
    band: data.band ? String(data.band) : undefined,
    level: data.level ? String(data.level) : undefined,
    status: (data.status as ExamResult['status']) ?? 'pending',
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    createdBy: String(data.createdBy ?? ''),
  }
}

const STAT_KEYS: TeacherStatFilter[] = ['active', 'passed', 'failed', 'dropped', 'repeats']

export default function TeacherDashboard() {
  const { user } = useManagement()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsSnap, resultsSnap, attemptsSnap] = await Promise.all([
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'examResults')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'examAttempts')).catch(() => ({ docs: [] })),
      ])
      setStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setExamResults(
        resultsSnap.docs.map((d) =>
          parseExamResult(d.id, d.data() as Record<string, unknown>),
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

  const counts = useMemo(
    () => computeTeacherStatCounts(students, examResults, examAttempts),
    [students, examResults, examAttempts],
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          Teacher Dashboard
        </h2>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/50">
          Student progress and one-on-one sessions — no financial data shown here.
        </p>
      </div>

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
